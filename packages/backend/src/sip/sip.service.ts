import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SipPlan } from '../entities/sip-plan.entity';
import { SipPoolBalance } from '../entities/sip-pool-balance.entity';
import { Order } from '../entities/order.entity';
import { Trade } from '../entities/trade.entity';
import { Position } from '../entities/position.entity';
import { Portfolio } from '../entities/portfolio.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Decimal } from 'decimal.js';

export interface SipExecutionResult {
  executedPlans: number;
  totalAmount: number;
  recycledBuys: number;
  recycledAmount: number;
}

@Injectable()
export class SipService {
  private readonly logger = new Logger(SipService.name);
  private readonly RECYCLING_BUFFER_PCT = 0.2; // 20% of SIP amount reserved for recycling

  constructor(
    @InjectRepository(SipPlan)
    private sipPlanRepository: Repository<SipPlan>,
    @InjectRepository(SipPoolBalance)
    private sipPoolRepository: Repository<SipPoolBalance>,
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(Trade)
    private tradeRepository: Repository<Trade>,
    @InjectRepository(Position)
    private positionRepository: Repository<Position>,
    @InjectRepository(Portfolio)
    private portfolioRepository: Repository<Portfolio>,
    private eventEmitter: EventEmitter2,
  ) {}

  async createSipPlan(
    userId: number,
    amountPerPeriod: number,
    frequency: 'WEEKLY' | 'MONTHLY',
    targetBondId?: number,
    targetBucketId?: string
  ): Promise<SipPlan> {
    const nextRunDate = this.calculateNextRunDate(frequency);
    
    const sipPlan = this.sipPlanRepository.create({
      userId,
      amountPerPeriod,
      frequency,
      targetBondId,
      targetBucketId,
      nextRunDate,
      status: 'ACTIVE',
    });
    
    await this.sipPlanRepository.save(sipPlan);
    
    this.logger.log(`Created SIP plan ${sipPlan.id} for user ${userId}`);
    this.eventEmitter.emit('sip.created', { sipPlan });
    
    return sipPlan;
  }

  async cancelSipPlan(sipId: number, userId: number): Promise<boolean> {
    const sipPlan = await this.sipPlanRepository.findOne({
      where: { id: sipId, userId },
    });
    
    if (!sipPlan || sipPlan.status !== 'ACTIVE') {
      return false;
    }
    
    sipPlan.status = 'CANCELLED';
    await this.sipPlanRepository.save(sipPlan);
    
    this.logger.log(`Cancelled SIP plan ${sipId} for user ${userId}`);
    this.eventEmitter.emit('sip.cancelled', { sipPlan });
    
    return true;
  }

  @Cron(CronExpression.EVERY_DAY_AT_2PM) // Run daily at 2 PM IST
  async executeSipPlans(): Promise<SipExecutionResult> {
    this.logger.log('Starting SIP execution cycle');
    
    const today = new Date();
    const activePlans = await this.sipPlanRepository.find({
      where: { 
        status: 'ACTIVE',
        nextRunDate: today.toISOString().split('T')[0],
      },
    });
    
    let executedPlans = 0;
    let totalAmount = 0;
    let recycledBuys = 0;
    let recycledAmount = 0;
    
    // Group SIP plans by target bond
    const plansByBond = new Map<number, SipPlan[]>();
    for (const plan of activePlans) {
      if (plan.targetBondId) {
        if (!plansByBond.has(plan.targetBondId)) {
          plansByBond.set(plan.targetBondId, []);
        }
        plansByBond.get(plan.targetBondId).push(plan);
      }
    }
    
    // Execute SIP for each bond
    for (const [bondId, plans] of plansByBond) {
      const result = await this.executeSipForBond(bondId, plans);
      executedPlans += result.executedPlans;
      totalAmount += result.totalAmount;
      recycledBuys += result.recycledBuys;
      recycledAmount += result.recycledAmount;
    }
    
    // Update next run dates for executed plans
    for (const plan of activePlans) {
      if (plan.status === 'ACTIVE') {
        plan.nextRunDate = this.calculateNextRunDate(plan.frequency);
        await this.sipPlanRepository.save(plan);
      }
    }
    
    this.logger.log(`SIP execution completed: ${executedPlans} plans, ₹${totalAmount} total`);
    this.eventEmitter.emit('sip.executed', { 
      executedPlans, 
      totalAmount, 
      recycledBuys, 
      recycledAmount 
    });
    
    return { executedPlans, totalAmount, recycledBuys, recycledAmount };
  }

  async processEarlyExitRequest(
    userId: number,
    bondId: number,
    qtyUnits: number,
    allowRecycling: boolean = true
  ): Promise<{ executed: boolean; recycled: boolean; tradeId?: number }> {
    this.logger.log(`Processing early exit request for user ${userId}, bond ${bondId}, qty ${qtyUnits}`);
    
    // Check if user has sufficient position
    const portfolio = await this.portfolioRepository.findOne({
      where: { userId },
    });
    
    const position = await this.positionRepository.findOne({
      where: { 
        portfolioId: portfolio.id,
        bondId 
      },
    });
    
    if (!position || position.qtyUnits < qtyUnits) {
      throw new Error('Insufficient position for early exit');
    }
    
    // Try recycling first if allowed
    if (allowRecycling) {
      const recyclingResult = await this.attemptSipRecycling(bondId, qtyUnits);
      if (recyclingResult.success) {
        return {
          executed: true,
          recycled: true,
          tradeId: recyclingResult.tradeId,
        };
      }
    }
    
    // Fall back to regular market order
    const sellOrder = this.orderRepository.create({
      userId,
      bondId,
      side: 'SELL',
      orderType: 'MARKET',
      qtyUnits,
      status: 'OPEN',
    });
    
    await this.orderRepository.save(sellOrder);
    
    return {
      executed: true,
      recycled: false,
    };
  }

  private async executeSipForBond(
    bondId: number,
    plans: SipPlan[]
  ): Promise<SipExecutionResult> {
    const totalSipAmount = plans.reduce((sum, plan) => sum + plan.amountPerPeriod, 0);
    const recyclingBuffer = totalSipAmount * this.RECYCLING_BUFFER_PCT;
    const availableForInvestment = totalSipAmount - recyclingBuffer;
    
    // Update SIP pool balance
    await this.updateSipPoolBalance(bondId, totalSipAmount, recyclingBuffer);
    
    // Create market buy orders for each SIP plan
    let executedPlans = 0;
    for (const plan of plans) {
      try {
        const investmentAmount = plan.amountPerPeriod * (1 - this.RECYCLING_BUFFER_PCT);
        const qtyUnits = Math.floor(investmentAmount / 1000); // Assuming ₹1000 per unit
        
        if (qtyUnits > 0) {
          const buyOrder = this.orderRepository.create({
            userId: plan.userId,
            bondId: plan.targetBondId,
            side: 'BUY',
            orderType: 'MARKET',
            qtyUnits,
            status: 'OPEN',
          });
          
          await this.orderRepository.save(buyOrder);
          executedPlans++;
        }
      } catch (error) {
        this.logger.error(`Error executing SIP plan ${plan.id}:`, error);
      }
    }
    
    return {
      executedPlans,
      totalAmount: availableForInvestment,
      recycledBuys: 0,
      recycledAmount: 0,
    };
  }

  private async attemptSipRecycling(
    bondId: number,
    qtyUnits: number
  ): Promise<{ success: boolean; tradeId?: number }> {
    const poolBalance = await this.sipPoolRepository.findOne({
      where: { bondId },
    });
    
    if (!poolBalance || poolBalance.availableForRecycling <= 0) {
      return { success: false };
    }
    
    // Calculate required amount for recycling
    const requiredAmount = qtyUnits * 1000; // Assuming ₹1000 per unit
    
    if (poolBalance.availableForRecycling < requiredAmount) {
      return { success: false };
    }
    
    // Create recycling buy order
    const recyclingOrder = this.orderRepository.create({
      userId: null, // System order
      bondId,
      side: 'BUY',
      orderType: 'MARKET',
      qtyUnits,
      status: 'OPEN',
    });
    
    await this.orderRepository.save(recyclingOrder);
    
    // Update pool balance
    poolBalance.availableForRecycling -= requiredAmount;
    poolBalance.reservedForRecycling += requiredAmount;
    await this.sipPoolRepository.save(poolBalance);
    
    this.logger.log(`SIP recycling executed for bond ${bondId}, qty ${qtyUnits}`);
    
    return { success: true, tradeId: recyclingOrder.id };
  }

  private async updateSipPoolBalance(
    bondId: number,
    totalAmount: number,
    recyclingBuffer: number
  ): Promise<void> {
    let poolBalance = await this.sipPoolRepository.findOne({
      where: { bondId },
    });
    
    if (!poolBalance) {
      poolBalance = this.sipPoolRepository.create({
        bondId,
        totalSipAmount: 0,
        reservedForRecycling: 0,
        availableForRecycling: 0,
      });
    }
    
    poolBalance.totalSipAmount += totalAmount;
    poolBalance.reservedForRecycling += recyclingBuffer;
    poolBalance.availableForRecycling += recyclingBuffer;
    
    await this.sipPoolRepository.save(poolBalance);
  }

  private calculateNextRunDate(frequency: 'WEEKLY' | 'MONTHLY'): Date {
    const now = new Date();
    
    if (frequency === 'WEEKLY') {
      const nextWeek = new Date(now);
      nextWeek.setDate(now.getDate() + 7);
      return nextWeek;
    } else {
      const nextMonth = new Date(now);
      nextMonth.setMonth(now.getMonth() + 1);
      return nextMonth;
    }
  }

  async getSipPoolStatus(bondId: number): Promise<SipPoolBalance> {
    return this.sipPoolRepository.findOne({
      where: { bondId },
    });
  }

  async getUserSipPlans(userId: number): Promise<SipPlan[]> {
    return this.sipPlanRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }
}
