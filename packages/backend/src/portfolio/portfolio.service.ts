import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Portfolio } from '../entities/portfolio.entity';
import { Position } from '../entities/position.entity';
import { Bond } from '../entities/bond.entity';

@Injectable()
export class PortfolioService {
  constructor(
    @InjectRepository(Portfolio)
    private portfolioRepository: Repository<Portfolio>,
    @InjectRepository(Position)
    private positionRepository: Repository<Position>,
    @InjectRepository(Bond)
    private bondRepository: Repository<Bond>,
  ) {}

  async getPortfolio(userId: number) {
    const portfolio = await this.portfolioRepository.findOne({
      where: { userId },
    });

    if (!portfolio) {
      // Create portfolio if it doesn't exist
      const newPortfolio = this.portfolioRepository.create({
        userId,
        cashBalance: 0,
      });
      await this.portfolioRepository.save(newPortfolio);
      return {
        cash: 0,
        positions: [],
        totalValue: 0,
      };
    }

    const positions = await this.positionRepository.find({
      where: { portfolioId: portfolio.id },
      relations: ['bond'],
    });

    const positionsWithValue = positions.map(position => ({
      bondId: position.bondId,
      name: position.bond.name,
      qty: position.qtyUnits,
      avgPrice: position.avgPricePerUnit,
      currentPrice: position.bond.lastTradedPrice || 0,
      marketValue: position.qtyUnits * (position.bond.lastTradedPrice || 0),
      pnl: (position.bond.lastTradedPrice || 0) - position.avgPricePerUnit,
    }));

    const totalValue = positionsWithValue.reduce(
      (sum, pos) => sum + pos.marketValue,
      portfolio.cashBalance
    );

    return {
      cash: portfolio.cashBalance,
      positions: positionsWithValue,
      totalValue,
    };
  }

  async exportPortfolio(userId: number) {
    const portfolio = await this.getPortfolio(userId);
    
    // Generate CSV content
    const csvHeader = 'Bond Name,Quantity,Avg Price,Current Price,Market Value,P&L\n';
    const csvRows = portfolio.positions.map(pos => 
      `${pos.name},${pos.qty},${pos.avgPrice},${pos.currentPrice},${pos.marketValue},${pos.pnl}`
    ).join('\n');
    
    const csvContent = csvHeader + csvRows;
    
    return {
      content: csvContent,
      filename: `portfolio_${userId}_${new Date().toISOString().split('T')[0]}.csv`,
    };
  }
}
