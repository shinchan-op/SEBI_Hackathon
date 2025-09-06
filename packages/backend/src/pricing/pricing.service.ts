import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Bond } from '../entities/bond.entity';
import { MpiMetrics } from '../entities/mpi-metrics.entity';
import { Decimal } from 'decimal.js';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface PricingInputs {
  rfYield: number;
  ratingSpreadBps: number;
  liquidityPremBps: number;
  mpi: number;
  orderImbalance: number;
}

export interface PricingCaps {
  softLow: number;
  softHigh: number;
  hardLow: number;
  hardHigh: number;
}

export interface PredictiveBands {
  t7PriceMean: number;
  t7Low: number;
  t7High: number;
}

export interface BondQuote {
  bondId: number;
  priceCleanFair: number;
  priceCleanAdj: number;
  priceDirtyAdj: number;
  fractionQuote: number;
  yieldFair: number;
  inputs: PricingInputs;
  caps: PricingCaps;
  predictive: PredictiveBands;
}

@Injectable()
export class PricingService {
  private readonly logger = new Logger(PricingService.name);

  constructor(
    @InjectRepository(Bond)
    private bondRepository: Repository<Bond>,
    @InjectRepository(MpiMetrics)
    private mpiRepository: Repository<MpiMetrics>,
    private httpService: HttpService,
  ) {}

  async getBondQuote(bondId: number): Promise<BondQuote> {
    const bond = await this.bondRepository.findOne({ where: { id: bondId } });
    if (!bond) {
      throw new Error(`Bond with ID ${bondId} not found`);
    }

    // Get current MPI metrics
    const mpiMetrics = await this.getLatestMpiMetrics(bondId);
    
    // Get risk-free yield curve (mock for now - in production, fetch from RBI/NSE)
    const rfYield = await this.getRiskFreeYield(bond.maturityDate);
    
    // Calculate pricing inputs
    const inputs = this.calculatePricingInputs(bond, mpiMetrics, rfYield);
    
    // Calculate fair value using PV
    const priceCleanFair = this.calculateCleanPrice(
      bond.faceValue,
      bond.coupon,
      this.getYearsToMaturity(bond.maturityDate),
      inputs.rfYield + inputs.ratingSpreadBps / 10000 + inputs.liquidityPremBps / 10000
    );

    // Apply sentiment adjustment
    const sentimentDelta = this.calculateSentimentDelta(inputs.mpi, inputs.orderImbalance);
    const priceCleanAdj = priceCleanFair * (1 + sentimentDelta);

    // Calculate caps based on volatility
    const caps = this.calculatePricingCaps(bond, priceCleanFair);

    // Apply caps
    const finalPriceClean = Math.max(
      Math.min(priceCleanAdj, caps.softHigh),
      caps.softLow
    );

    // Calculate dirty price (clean + accrued interest)
    const accruedInterest = this.calculateAccruedInterest(bond);
    const priceDirtyAdj = finalPriceClean + accruedInterest;

    // Calculate fraction quote in rupees
    const fractionQuote = (priceDirtyAdj / 100) * (bond.faceValue / bond.fractionSize);

    // Get ML predictions
    const predictive = await this.getMlPredictions(bondId);

    return {
      bondId,
      priceCleanFair: Number(priceCleanFair.toFixed(4)),
      priceCleanAdj: Number(finalPriceClean.toFixed(4)),
      priceDirtyAdj: Number(priceDirtyAdj.toFixed(4)),
      fractionQuote: Number(fractionQuote.toFixed(2)),
      yieldFair: Number((inputs.rfYield + inputs.ratingSpreadBps / 10000 + inputs.liquidityPremBps / 10000).toFixed(4)),
      inputs,
      caps,
      predictive,
    };
  }

  private calculateCleanPrice(
    faceValue: number,
    couponPct: number,
    yearsRemaining: number,
    yieldPct: number,
    freq: number = 2
  ): Decimal {
    const c = new Decimal(couponPct).div(100);
    const y = new Decimal(yieldPct).div(100);
    const n = Math.max(1, Math.round(yearsRemaining * freq));
    const dt = new Decimal(1).div(freq);
    
    let pv = new Decimal(0);
    
    for (let k = 1; k <= n; k++) {
      const isLastPayment = k === n;
      const couponPayment = faceValue * c * dt;
      const principalPayment = isLastPayment ? faceValue : 0;
      const cashflow = new Decimal(couponPayment + principalPayment);
      
      const discountFactor = new Decimal(1).plus(y.mul(dt)).pow(k);
      pv = pv.plus(cashflow.div(discountFactor));
    }
    
    return pv.div(faceValue).mul(100);
  }

  private calculatePricingInputs(
    bond: Bond,
    mpiMetrics: MpiMetrics,
    rfYield: number
  ): PricingInputs {
    // Rating spread lookup table (in basis points)
    const ratingSpreads: Record<string, number> = {
      'AAA': 20,
      'AA+': 30,
      'AA': 40,
      'AA-': 50,
      'A+': 60,
      'A': 80,
      'A-': 100,
      'BBB+': 120,
      'BBB': 150,
      'BBB-': 200,
    };

    const ratingSpreadBps = ratingSpreads[bond.rating] || 200;

    // Liquidity premium based on issue size and days since last trade
    const baseLiquidityPrem = 20; // 20 bps base
    const sizeFactor = Math.max(0, 50 - Math.log10(bond.issueSize || 100)); // Larger issues = lower premium
    const stalenessFactor = Math.min(50, bond.daysSinceLastTrade * 2); // 2 bps per day stale
    const liquidityPremBps = baseLiquidityPrem + sizeFactor + stalenessFactor;

    return {
      rfYield,
      ratingSpreadBps,
      liquidityPremBps,
      mpi: mpiMetrics?.computedMpi || 0.5,
      orderImbalance: this.calculateOrderImbalance(bond.id), // Mock for now
    };
  }

  private calculateSentimentDelta(mpi: number, orderImbalance: number): number {
    const alpha = 0.3; // MPI weight
    const beta = 0.2; // Order imbalance weight
    const gamma = 0.015; // Max 1.5% price impact
    
    const sentimentDelta = alpha * mpi - beta * orderImbalance;
    return Math.max(-0.015, Math.min(0.015, gamma * sentimentDelta));
  }

  private calculatePricingCaps(bond: Bond, fairPrice: number): PricingCaps {
    // Mock volatility calculation - in production, use historical data
    const volatility = 0.02; // 2% daily volatility
    const softPct = Math.min(0.015, 2 * volatility); // 1.5% or 2σ
    const hardPct = Math.min(0.04, 3.5 * volatility); // 4% or 3.5σ

    return {
      softLow: fairPrice * (1 - softPct),
      softHigh: fairPrice * (1 + softPct),
      hardLow: fairPrice * (1 - hardPct),
      hardHigh: fairPrice * (1 + hardPct),
    };
  }

  private calculateAccruedInterest(bond: Bond): number {
    // Simplified accrued interest calculation
    // In production, use proper day count conventions
    const daysSinceLastCoupon = 30; // Mock - calculate actual days
    const couponPerDay = (bond.coupon / 100) * bond.faceValue / 365;
    return couponPerDay * daysSinceLastCoupon / bond.faceValue * 100; // As % of face
  }

  private getYearsToMaturity(maturityDate: Date): number {
    const now = new Date();
    const diffTime = maturityDate.getTime() - now.getTime();
    return diffTime / (1000 * 60 * 60 * 24 * 365.25);
  }

  private async getRiskFreeYield(maturityDate: Date): Promise<number> {
    // Mock implementation - in production, fetch from RBI/NSE
    const yearsToMaturity = this.getYearsToMaturity(maturityDate);
    
    // Simple yield curve approximation
    if (yearsToMaturity <= 1) return 6.5;
    if (yearsToMaturity <= 5) return 6.8;
    if (yearsToMaturity <= 10) return 7.0;
    return 7.2;
  }

  private async getLatestMpiMetrics(bondId: number): Promise<MpiMetrics | null> {
    return this.mpiRepository.findOne({
      where: { bondId },
      order: { timestamp: 'DESC' },
    });
  }

  private calculateOrderImbalance(bondId: number): number {
    // Mock implementation - in production, calculate from orderbook
    return Math.random() * 0.1 - 0.05; // Random between -0.05 and 0.05
  }

  private async getMlPredictions(bondId: number): Promise<PredictiveBands> {
    try {
      // Call ML service for predictions
      const response = await firstValueFrom(
        this.httpService.get(`http://localhost:8001/api/predict/${bondId}`)
      );
      return response.data;
    } catch (error) {
      this.logger.warn(`ML prediction failed for bond ${bondId}:`, error.message);
      // Return mock predictions if ML service is unavailable
      return {
        t7PriceMean: 100.0,
        t7Low: 99.0,
        t7High: 101.0,
      };
    }
  }
}
