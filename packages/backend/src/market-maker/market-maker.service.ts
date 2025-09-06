import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MarketMaker } from '../entities/market-maker.entity';
import { Order } from '../entities/order.entity';
import { Bond } from '../entities/bond.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';

export interface MmObligation {
  minSpreadBps: number;
  minSizeUnits: number;
  minHoursPerDay: number;
  maxGapMinutes: number;
}

export interface MmPerformance {
  mmId: number;
  period: string;
  obligationFulfillment: number;
  averageSpread: number;
  timeInQuote: number;
  volumeTraded: number;
  rebateEarned: number;
}

@Injectable()
export class MarketMakerService {
  private readonly logger = new Logger(MarketMakerService.name);

  constructor(
    @InjectRepository(MarketMaker)
    private marketMakerRepository: Repository<MarketMaker>,
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(Bond)
    private bondRepository: Repository<Bond>,
    private eventEmitter: EventEmitter2,
  ) {}

  async registerMarketMaker(
    userId: number,
    companyName: string,
    tier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' = 'BRONZE'
  ): Promise<MarketMaker> {
    const obligations = this.getObligationsByTier(tier);
    
    const marketMaker = this.marketMakerRepository.create({
      userId,
      companyName,
      tier,
      minSpreadBps: obligations.minSpreadBps,
      minSizeUnits: obligations.minSizeUnits,
      obligationHours: {
        start: '09:00',
        end: '17:00',
        timezone: 'IST',
      },
      status: 'PENDING',
    });

    await this.marketMakerRepository.save(marketMaker);
    
    this.logger.log(`Market maker ${companyName} registered with tier ${tier}`);
    this.eventEmitter.emit('marketmaker.registered', { marketMaker });
    
    return marketMaker;
  }

  async approveMarketMaker(marketMakerId: number): Promise<boolean> {
    const marketMaker = await this.marketMakerRepository.findOne({
      where: { id: marketMakerId },
    });

    if (!marketMaker || marketMaker.status !== 'PENDING') {
      return false;
    }

    marketMaker.status = 'APPROVED';
    await this.marketMakerRepository.save(marketMaker);

    this.logger.log(`Market maker ${marketMaker.companyName} approved`);
    this.eventEmitter.emit('marketmaker.approved', { marketMaker });

    return true;
  }

  async submitQuotes(
    marketMakerId: number,
    bondId: number,
    bidPrice: number,
    askPrice: number,
    bidSize: number,
    askSize: number
  ): Promise<{ success: boolean; orders: Order[] }> {
    const marketMaker = await this.marketMakerRepository.findOne({
      where: { id: marketMakerId, status: 'APPROVED' },
    });

    if (!marketMaker) {
      throw new Error('Market maker not found or not approved');
    }

    // Validate spread requirements
    const spreadBps = ((askPrice - bidPrice) / bidPrice) * 10000;
    if (spreadBps < marketMaker.minSpreadBps) {
      throw new Error(`Spread ${spreadBps.toFixed(0)} bps below minimum ${marketMaker.minSpreadBps} bps`);
    }

    // Validate size requirements
    if (bidSize < marketMaker.minSizeUnits || askSize < marketMaker.minSizeUnits) {
      throw new Error(`Order size below minimum ${marketMaker.minSizeUnits} units`);
    }

    // Cancel existing quotes for this bond
    await this.cancelExistingQuotes(marketMakerId, bondId);

    // Create new bid order
    const bidOrder = this.orderRepository.create({
      userId: marketMaker.userId,
      bondId,
      side: 'BUY',
      orderType: 'LIMIT',
      priceLimit: bidPrice,
      qtyUnits: bidSize,
      status: 'OPEN',
    });

    // Create new ask order
    const askOrder = this.orderRepository.create({
      userId: marketMaker.userId,
      bondId,
      side: 'SELL',
      orderType: 'LIMIT',
      priceLimit: askPrice,
      qtyUnits: askSize,
      status: 'OPEN',
    });

    await this.orderRepository.save([bidOrder, askOrder]);

    this.logger.log(`Market maker ${marketMakerId} submitted quotes for bond ${bondId}`);
    this.eventEmitter.emit('marketmaker.quotes.submitted', { 
      marketMaker, 
      bondId, 
      bidOrder, 
      askOrder 
    });

    return {
      success: true,
      orders: [bidOrder, askOrder],
    };
  }

  @Cron(CronExpression.EVERY_HOUR) // Check every hour
  async monitorObligations(): Promise<void> {
    this.logger.log('Monitoring market maker obligations');

    const activeMMs = await this.marketMakerRepository.find({
      where: { status: 'APPROVED' },
    });

    for (const mm of activeMMs) {
      const performance = await this.calculatePerformance(mm.id);
      
      if (performance.obligationFulfillment < 0.8) { // Less than 80% fulfillment
        await this.handleObligationBreach(mm, performance);
      }
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_6PM) // End of trading day
  async calculateDailyRebates(): Promise<void> {
    this.logger.log('Calculating daily market maker rebates');

    const activeMMs = await this.marketMakerRepository.find({
      where: { status: 'APPROVED' },
    });

    for (const mm of activeMMs) {
      const rebate = await this.calculateRebate(mm.id);
      if (rebate > 0) {
        await this.processRebate(mm, rebate);
      }
    }
  }

  private async cancelExistingQuotes(marketMakerId: number, bondId: number): Promise<void> {
    const existingOrders = await this.orderRepository.find({
      where: {
        userId: (await this.marketMakerRepository.findOne({ where: { id: marketMakerId } })).userId,
        bondId,
        status: 'OPEN',
      },
    });

    for (const order of existingOrders) {
      order.status = 'CANCELLED';
    }

    await this.orderRepository.save(existingOrders);
  }

  private async calculatePerformance(marketMakerId: number): Promise<MmPerformance> {
    const mm = await this.marketMakerRepository.findOne({ where: { id: marketMakerId } });
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    // Get today's orders
    const orders = await this.orderRepository.find({
      where: {
        userId: mm.userId,
        createdAt: startOfDay,
      },
    });

    // Calculate metrics
    const totalOrders = orders.length;
    const filledOrders = orders.filter(o => o.status === 'EXECUTED').length;
    const obligationFulfillment = totalOrders > 0 ? filledOrders / totalOrders : 0;

    // Calculate average spread
    const bidOrders = orders.filter(o => o.side === 'BUY' && o.status === 'EXECUTED');
    const askOrders = orders.filter(o => o.side === 'SELL' && o.status === 'EXECUTED');
    let averageSpread = 0;
    
    if (bidOrders.length > 0 && askOrders.length > 0) {
      const avgBid = bidOrders.reduce((sum, o) => sum + o.priceLimit, 0) / bidOrders.length;
      const avgAsk = askOrders.reduce((sum, o) => sum + o.priceLimit, 0) / askOrders.length;
      averageSpread = ((avgAsk - avgBid) / avgBid) * 10000; // in bps
    }

    // Calculate time in quote (simplified)
    const timeInQuote = 0.85; // Mock - should calculate actual time

    // Calculate volume traded
    const volumeTraded = orders
      .filter(o => o.status === 'EXECUTED')
      .reduce((sum, o) => sum + o.qtyFilledUnits, 0);

    return {
      mmId: marketMakerId,
      period: today.toISOString().split('T')[0],
      obligationFulfillment,
      averageSpread,
      timeInQuote,
      volumeTraded,
      rebateEarned: 0, // Will be calculated separately
    };
  }

  private async calculateRebate(marketMakerId: number): Promise<number> {
    const performance = await this.calculatePerformance(marketMakerId);
    const mm = await this.marketMakerRepository.findOne({ where: { id: marketMakerId } });
    
    // Rebate calculation based on tier and performance
    const rebateRates = {
      'BRONZE': 0.001,   // 0.1%
      'SILVER': 0.002,   // 0.2%
      'GOLD': 0.003,     // 0.3%
      'PLATINUM': 0.005, // 0.5%
    };

    const baseRate = rebateRates[mm.tier];
    const performanceMultiplier = Math.min(performance.obligationFulfillment * 1.5, 1.0);
    
    return performance.volumeTraded * baseRate * performanceMultiplier;
  }

  private async processRebate(marketMaker: MarketMaker, rebateAmount: number): Promise<void> {
    // In production, this would credit the market maker's account
    this.logger.log(`Processing rebate of ₹${rebateAmount.toFixed(2)} for MM ${marketMaker.companyName}`);
    
    this.eventEmitter.emit('marketmaker.rebate.processed', { 
      marketMaker, 
      rebateAmount 
    });
  }

  private async handleObligationBreach(marketMaker: MarketMaker, performance: MmPerformance): Promise<void> {
    this.logger.warn(`Obligation breach for MM ${marketMaker.companyName}: ${(performance.obligationFulfillment * 100).toFixed(1)}% fulfillment`);
    
    // Send alert
    this.eventEmitter.emit('marketmaker.obligation.breach', { 
      marketMaker, 
      performance 
    });

    // If persistent breach, consider suspension
    if (performance.obligationFulfillment < 0.5) {
      marketMaker.status = 'SUSPENDED';
      await this.marketMakerRepository.save(marketMaker);
      
      this.logger.warn(`Market maker ${marketMaker.companyName} suspended due to obligation breach`);
    }
  }

  private getObligationsByTier(tier: string): MmObligation {
    const obligations = {
      'BRONZE': {
        minSpreadBps: 20,
        minSizeUnits: 1000,
        minHoursPerDay: 4,
        maxGapMinutes: 30,
      },
      'SILVER': {
        minSpreadBps: 15,
        minSizeUnits: 2000,
        minHoursPerDay: 6,
        maxGapMinutes: 20,
      },
      'GOLD': {
        minSpreadBps: 10,
        minSizeUnits: 5000,
        minHoursPerDay: 8,
        maxGapMinutes: 15,
      },
      'PLATINUM': {
        minSpreadBps: 5,
        minSizeUnits: 10000,
        minHoursPerDay: 10,
        maxGapMinutes: 10,
      },
    };

    return obligations[tier] || obligations['BRONZE'];
  }

  async getMarketMakerPerformance(marketMakerId: number): Promise<MmPerformance> {
    return this.calculatePerformance(marketMakerId);
  }

  async getActiveMarketMakers(): Promise<MarketMaker[]> {
    return this.marketMakerRepository.find({
      where: { status: 'APPROVED' },
      order: { tier: 'DESC' },
    });
  }
}
