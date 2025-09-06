import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LendingOffer } from '../entities/lending-offer.entity';
import { RepoPosition } from '../entities/repo-position.entity';
import { Position } from '../entities/position.entity';
import { Portfolio } from '../entities/portfolio.entity';
import { Bond } from '../entities/bond.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Decimal } from 'decimal.js';

export interface RepoMatchResult {
  success: boolean;
  repoPosition?: RepoPosition;
  error?: string;
}

export interface CollateralRequirement {
  type: 'CASH' | 'SECURITIES';
  amount: number;
  haircut: number;
  collateralFactor: number;
}

@Injectable()
export class RepoService {
  private readonly logger = new Logger(RepoService.name);
  
  // Haircut rates by bond rating
  private readonly HAIRCUT_RATES: Record<string, number> = {
    'AAA': 0.02, // 2%
    'AA+': 0.03,
    'AA': 0.04,
    'AA-': 0.05,
    'A+': 0.06,
    'A': 0.07,
    'A-': 0.08,
    'BBB+': 0.10,
    'BBB': 0.12,
    'BBB-': 0.15,
  };

  constructor(
    @InjectRepository(LendingOffer)
    private lendingOfferRepository: Repository<LendingOffer>,
    @InjectRepository(RepoPosition)
    private repoPositionRepository: Repository<RepoPosition>,
    @InjectRepository(Position)
    private positionRepository: Repository<Position>,
    @InjectRepository(Portfolio)
    private portfolioRepository: Repository<Portfolio>,
    @InjectRepository(Bond)
    private bondRepository: Repository<Bond>,
    private eventEmitter: EventEmitter2,
  ) {}

  async createLendingOffer(
    lenderUserId: number,
    bondId: number,
    qtyUnits: number,
    feeRatePerAnnum: number,
    minTenorDays: number,
    collateralType: 'CASH' | 'SECURITIES' = 'CASH'
  ): Promise<LendingOffer> {
    // Verify lender has sufficient position
    const lenderPortfolio = await this.portfolioRepository.findOne({
      where: { userId: lenderUserId },
    });
    
    const lenderPosition = await this.positionRepository.findOne({
      where: { 
        portfolioId: lenderPortfolio.id,
        bondId 
      },
    });
    
    if (!lenderPosition || lenderPosition.qtyUnits < qtyUnits) {
      throw new Error('Insufficient bond position for lending');
    }
    
    const lendingOffer = this.lendingOfferRepository.create({
      lenderUserId,
      bondId,
      qtyUnits,
      feeRatePerAnnum,
      minTenorDays,
      collateralType,
      status: 'ACTIVE',
    });
    
    await this.lendingOfferRepository.save(lendingOffer);
    
    this.logger.log(`Created lending offer ${lendingOffer.id} for bond ${bondId}`);
    this.eventEmitter.emit('lending.offer.created', { lendingOffer });
    
    return lendingOffer;
  }

  async createBorrowRequest(
    borrowerUserId: number,
    bondId: number,
    qtyUnits: number,
    tenorDays: number,
    collateralAmount: number,
    collateralType: 'CASH' | 'SECURITIES' = 'CASH'
  ): Promise<RepoMatchResult> {
    this.logger.log(`Processing borrow request for user ${borrowerUserId}, bond ${bondId}, qty ${qtyUnits}`);
    
    // Find matching lending offer
    const lendingOffer = await this.findMatchingLendingOffer(bondId, qtyUnits, tenorDays);
    
    if (!lendingOffer) {
      return {
        success: false,
        error: 'No matching lending offer found',
      };
    }
    
    // Calculate collateral requirements
    const collateralReq = await this.calculateCollateralRequirement(
      bondId,
      qtyUnits,
      collateralType
    );
    
    if (collateralAmount < collateralReq.amount) {
      return {
        success: false,
        error: `Insufficient collateral. Required: ₹${collateralReq.amount}, Provided: ₹${collateralAmount}`,
      };
    }
    
    // Verify borrower has sufficient collateral
    const borrowerPortfolio = await this.portfolioRepository.findOne({
      where: { userId: borrowerUserId },
    });
    
    if (collateralType === 'CASH' && borrowerPortfolio.cashBalance < collateralAmount) {
      return {
        success: false,
        error: 'Insufficient cash balance for collateral',
      };
    }
    
    // Create repo position
    const repoPosition = this.repoPositionRepository.create({
      borrowerUserId,
      lenderUserId: lendingOffer.lenderUserId,
      bondId,
      qtyUnits,
      collateralAmount,
      feeRate: lendingOffer.feeRatePerAnnum,
      startDate: new Date(),
      endDate: new Date(Date.now() + tenorDays * 24 * 60 * 60 * 1000),
      status: 'ACTIVE',
    });
    
    await this.repoPositionRepository.save(repoPosition);
    
    // Update positions
    await this.transferBondPosition(lendingOffer.lenderUserId, borrowerUserId, bondId, qtyUnits);
    
    // Update collateral
    await this.updateCollateral(borrowerUserId, collateralAmount, collateralType, 'DEBIT');
    
    // Mark lending offer as filled
    lendingOffer.status = 'FILLED';
    await this.lendingOfferRepository.save(lendingOffer);
    
    this.logger.log(`Created repo position ${repoPosition.id} for bond ${bondId}`);
    this.eventEmitter.emit('repo.position.created', { repoPosition });
    
    return {
      success: true,
      repoPosition,
    };
  }

  @Cron(CronExpression.EVERY_DAY_AT_9AM) // Run daily at 9 AM IST
  async processRepoMaturities(): Promise<void> {
    this.logger.log('Processing repo maturities');
    
    const today = new Date();
    const maturingPositions = await this.repoPositionRepository.find({
      where: { 
        status: 'ACTIVE',
        endDate: today.toISOString().split('T')[0],
      },
    });
    
    for (const position of maturingPositions) {
      await this.closeRepoPosition(position.id);
    }
    
    this.logger.log(`Processed ${maturingPositions.length} repo maturities`);
  }

  @Cron(CronExpression.EVERY_HOUR) // Run every hour
  async processMarginCalls(): Promise<void> {
    this.logger.log('Processing margin calls');
    
    const activePositions = await this.repoPositionRepository.find({
      where: { status: 'ACTIVE' },
    });
    
    for (const position of activePositions) {
      const marginStatus = await this.checkMarginStatus(position);
      
      if (marginStatus.breach) {
        await this.handleMarginBreach(position, marginStatus.shortfall);
      }
    }
  }

  async closeRepoPosition(repoPositionId: number): Promise<boolean> {
    const repoPosition = await this.repoPositionRepository.findOne({
      where: { id: repoPositionId },
    });
    
    if (!repoPosition || repoPosition.status !== 'ACTIVE') {
      return false;
    }
    
    try {
      // Calculate fees
      const daysHeld = Math.ceil(
        (repoPosition.endDate.getTime() - repoPosition.startDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      const feeAmount = new Decimal(repoPosition.collateralAmount)
        .mul(repoPosition.feeRate)
        .mul(daysHeld)
        .div(365)
        .toNumber();
      
      // Return bonds to lender
      await this.transferBondPosition(
        repoPosition.borrowerUserId,
        repoPosition.lenderUserId,
        repoPosition.bondId,
        repoPosition.qtyUnits
      );
      
      // Return collateral to borrower (minus fees)
      const netCollateral = repoPosition.collateralAmount - feeAmount;
      await this.updateCollateral(
        repoPosition.borrowerUserId,
        netCollateral,
        'CASH',
        'CREDIT'
      );
      
      // Pay fees to lender
      await this.updateCollateral(
        repoPosition.lenderUserId,
        feeAmount,
        'CASH',
        'CREDIT'
      );
      
      // Update repo position status
      repoPosition.status = 'CLOSED';
      await this.repoPositionRepository.save(repoPosition);
      
      this.logger.log(`Closed repo position ${repoPositionId}`);
      this.eventEmitter.emit('repo.position.closed', { repoPosition });
      
      return true;
    } catch (error) {
      this.logger.error(`Error closing repo position ${repoPositionId}:`, error);
      return false;
    }
  }

  private async findMatchingLendingOffer(
    bondId: number,
    qtyUnits: number,
    tenorDays: number
  ): Promise<LendingOffer | null> {
    return this.lendingOfferRepository.findOne({
      where: {
        bondId,
        status: 'ACTIVE',
        minTenorDays: tenorDays,
      },
      order: { feeRatePerAnnum: 'ASC' }, // Best rate first
    });
  }

  private async calculateCollateralRequirement(
    bondId: number,
    qtyUnits: number,
    collateralType: 'CASH' | 'SECURITIES'
  ): Promise<CollateralRequirement> {
    const bond = await this.bondRepository.findOne({
      where: { id: bondId },
    });
    
    const haircut = this.HAIRCUT_RATES[bond.rating] || 0.15; // Default 15%
    const collateralFactor = 1 + haircut;
    
    // Calculate bond value (simplified - should use current market price)
    const bondValue = qtyUnits * 1000; // Assuming ₹1000 per unit
    const requiredAmount = bondValue * collateralFactor;
    
    return {
      type: collateralType,
      amount: requiredAmount,
      haircut,
      collateralFactor,
    };
  }

  private async transferBondPosition(
    fromUserId: number,
    toUserId: number,
    bondId: number,
    qtyUnits: number
  ): Promise<void> {
    // Remove from lender
    const lenderPortfolio = await this.portfolioRepository.findOne({
      where: { userId: fromUserId },
    });
    
    const lenderPosition = await this.positionRepository.findOne({
      where: { 
        portfolioId: lenderPortfolio.id,
        bondId 
      },
    });
    
    if (lenderPosition) {
      lenderPosition.qtyUnits -= qtyUnits;
      if (lenderPosition.qtyUnits <= 0) {
        await this.positionRepository.remove(lenderPosition);
      } else {
        await this.positionRepository.save(lenderPosition);
      }
    }
    
    // Add to borrower
    const borrowerPortfolio = await this.portfolioRepository.findOne({
      where: { userId: toUserId },
    });
    
    let borrowerPosition = await this.positionRepository.findOne({
      where: { 
        portfolioId: borrowerPortfolio.id,
        bondId 
      },
    });
    
    if (!borrowerPosition) {
      borrowerPosition = this.positionRepository.create({
        portfolioId: borrowerPortfolio.id,
        bondId,
        qtyUnits: 0,
        avgPricePerUnit: 0,
      });
    }
    
    borrowerPosition.qtyUnits += qtyUnits;
    await this.positionRepository.save(borrowerPosition);
  }

  private async updateCollateral(
    userId: number,
    amount: number,
    type: 'CASH' | 'SECURITIES',
    operation: 'DEBIT' | 'CREDIT'
  ): Promise<void> {
    const portfolio = await this.portfolioRepository.findOne({
      where: { userId },
    });
    
    if (type === 'CASH') {
      if (operation === 'DEBIT') {
        portfolio.cashBalance -= amount;
      } else {
        portfolio.cashBalance += amount;
      }
      await this.portfolioRepository.save(portfolio);
    }
    // TODO: Handle securities collateral
  }

  private async checkMarginStatus(repoPosition: RepoPosition): Promise<{
    breach: boolean;
    shortfall?: number;
  }> {
    // Simplified margin check - in production, use real-time bond prices
    const currentBondValue = repoPosition.qtyUnits * 1000; // Mock current value
    const requiredCollateral = currentBondValue * 1.1; // 10% margin requirement
    
    if (repoPosition.collateralAmount < requiredCollateral) {
      return {
        breach: true,
        shortfall: requiredCollateral - repoPosition.collateralAmount,
      };
    }
    
    return { breach: false };
  }

  private async handleMarginBreach(
    repoPosition: RepoPosition,
    shortfall: number
  ): Promise<void> {
    this.logger.warn(`Margin breach for repo position ${repoPosition.id}, shortfall: ₹${shortfall}`);
    
    // In production, implement margin call logic
    // For now, just log the breach
    this.eventEmitter.emit('repo.margin.breach', { repoPosition, shortfall });
  }

  async getLendingOffers(bondId?: number): Promise<LendingOffer[]> {
    const whereClause = bondId ? { bondId, status: 'ACTIVE' } : { status: 'ACTIVE' };
    
    return this.lendingOfferRepository.find({
      where: whereClause,
      order: { feeRatePerAnnum: 'ASC' },
    });
  }

  async getUserRepoPositions(userId: number): Promise<RepoPosition[]> {
    return this.repoPositionRepository.find({
      where: [
        { borrowerUserId: userId },
        { lenderUserId: userId },
      ],
      order: { createdAt: 'DESC' },
    });
  }
}
