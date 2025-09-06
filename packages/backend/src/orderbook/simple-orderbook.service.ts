import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../entities/order.entity';
import { Trade } from '../entities/trade.entity';
import { Position } from '../entities/position.entity';
import { Portfolio } from '../entities/portfolio.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface OrderBookLevel {
  price: number;
  quantity: number;
  orders: Order[];
}

export interface OrderBook {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  lastPrice?: number;
  lastTradeTime?: Date;
}

@Injectable()
export class SimpleOrderbookService {
  private readonly logger = new Logger(SimpleOrderbookService.name);

  constructor(
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

  async addOrder(order: Order): Promise<{ order: Order; trades: Trade[] }> {
    this.logger.log(`Processing order ${order.id} for bond ${order.bondId}`);
    
    const trades: Trade[] = [];
    
    try {
      // Validate order
      await this.validateOrder(order);
      
      // Try to match immediately
      const matchResult = await this.matchOrder(order);
      trades.push(...matchResult.trades);
      
      // Update order status
      if (order.qtyFilledUnits === order.qtyUnits) {
        order.status = 'EXECUTED';
      } else if (order.qtyFilledUnits > 0) {
        order.status = 'PARTIAL';
      } else if (order.orderType === 'MARKET') {
        order.status = 'CANCELLED'; // Market order with no liquidity
      } else {
        order.status = 'OPEN';
      }
      
      // Save order
      await this.orderRepository.save(order);
      
      // Emit events
      this.eventEmitter.emit('order.processed', { order, trades });
      
      return { order, trades };
    } catch (error) {
      this.logger.error(`Error processing order ${order.id}:`, error);
      order.status = 'CANCELLED';
      await this.orderRepository.save(order);
      throw error;
    }
  }

  async getOrderBook(bondId: number): Promise<OrderBook> {
    const bids = await this.getOrderBookSide(bondId, 'BUY');
    const asks = await this.getOrderBookSide(bondId, 'SELL');
    
    // Get last trade info
    const lastTrade = await this.tradeRepository.findOne({
      where: { bondId },
      order: { executedAt: 'DESC' },
    });
    
    return {
      bids: bids.slice(0, 10), // Top 10 levels
      asks: asks.slice(0, 10),
      lastPrice: lastTrade?.pricePerUnit,
      lastTradeTime: lastTrade?.executedAt,
    };
  }

  async cancelOrder(orderId: number, userId: number): Promise<boolean> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId, userId },
    });
    
    if (!order || order.status !== 'OPEN') {
      return false;
    }
    
    order.status = 'CANCELLED';
    await this.orderRepository.save(order);
    
    this.eventEmitter.emit('order.cancelled', { order });
    return true;
  }

  private async validateOrder(order: Order): Promise<void> {
    // Check if user has sufficient balance/position
    if (order.side === 'BUY') {
      const portfolio = await this.portfolioRepository.findOne({
        where: { userId: order.userId },
      });
      
      const requiredAmount = (order.priceLimit || 0) * order.qtyUnits;
      
      if (portfolio.cashBalance < requiredAmount) {
        throw new Error('Insufficient cash balance');
      }
    } else {
      const position = await this.positionRepository.findOne({
        where: { 
          portfolio: { userId: order.userId },
          bondId: order.bondId 
        },
      });
      
      if (!position || position.qtyUnits < order.qtyUnits) {
        throw new Error('Insufficient bond position');
      }
    }
  }

  private async matchOrder(order: Order): Promise<{ trades: Trade[] }> {
    const trades: Trade[] = [];
    const oppositeSide = order.side === 'BUY' ? 'SELL' : 'BUY';
    
    // Get opposite side orders from database
    const oppositeOrders = await this.orderRepository.find({
      where: { 
        bondId: order.bondId,
        side: oppositeSide,
        status: 'OPEN'
      },
      order: { 
        priceLimit: oppositeSide === 'BUY' ? 'DESC' : 'ASC',
        createdAt: 'ASC'
      },
    });
    
    for (const oppositeOrder of oppositeOrders) {
      if (order.qtyFilledUnits >= order.qtyUnits) break;
      if (oppositeOrder.qtyFilledUnits >= oppositeOrder.qtyUnits) continue;
      
      // Check if orders can match
      if (this.canMatch(order, oppositeOrder)) {
        const trade = await this.executeTrade(order, oppositeOrder);
        trades.push(trade);
      }
    }
    
    return { trades };
  }

  private canMatch(order: Order, oppositeOrder: Order): boolean {
    if (order.orderType === 'MARKET') {
      return true; // Market orders match at any price
    }
    
    if (order.side === 'BUY') {
      return order.priceLimit >= oppositeOrder.priceLimit;
    } else {
      return order.priceLimit <= oppositeOrder.priceLimit;
    }
  }

  private async executeTrade(buyOrder: Order, sellOrder: Order): Promise<Trade> {
    const remainingBuyQty = buyOrder.qtyUnits - buyOrder.qtyFilledUnits;
    const remainingSellQty = sellOrder.qtyUnits - sellOrder.qtyFilledUnits;
    const tradeQty = Math.min(remainingBuyQty, remainingSellQty);
    
    // Use the limit price of the order that was placed first
    const tradePrice = buyOrder.createdAt <= sellOrder.createdAt 
      ? buyOrder.priceLimit 
      : sellOrder.priceLimit;
    
    // Create trade record
    const trade = this.tradeRepository.create({
      buyOrderId: buyOrder.id,
      sellOrderId: sellOrder.id,
      bondId: buyOrder.bondId,
      pricePerUnit: tradePrice,
      qtyUnits: tradeQty,
      tradeReceiptJson: this.generateTradeReceipt(buyOrder, sellOrder, tradePrice, tradeQty),
    });
    
    await this.tradeRepository.save(trade);
    
    // Update order quantities
    buyOrder.qtyFilledUnits += tradeQty;
    sellOrder.qtyFilledUnits += tradeQty;
    
    // Update positions
    await this.updatePositions(buyOrder, sellOrder, tradePrice, tradeQty);
    
    // Update portfolios
    await this.updatePortfolios(buyOrder, sellOrder, tradePrice, tradeQty);
    
    this.eventEmitter.emit('trade.executed', { trade, buyOrder, sellOrder });
    
    return trade;
  }

  private async updatePositions(
    buyOrder: Order, 
    sellOrder: Order, 
    price: number, 
    qty: number
  ): Promise<void> {
    // Update buyer position
    const buyerPortfolio = await this.portfolioRepository.findOne({
      where: { userId: buyOrder.userId },
    });
    
    let buyerPosition = await this.positionRepository.findOne({
      where: { 
        portfolioId: buyerPortfolio.id,
        bondId: buyOrder.bondId 
      },
    });
    
    if (!buyerPosition) {
      buyerPosition = this.positionRepository.create({
        portfolioId: buyerPortfolio.id,
        bondId: buyOrder.bondId,
        qtyUnits: 0,
        avgPricePerUnit: 0,
      });
    }
    
    // Calculate new average price
    const totalCost = buyerPosition.avgPricePerUnit * buyerPosition.qtyUnits + price * qty;
    const totalQty = buyerPosition.qtyUnits + qty;
    buyerPosition.avgPricePerUnit = totalCost / totalQty;
    buyerPosition.qtyUnits = totalQty;
    
    await this.positionRepository.save(buyerPosition);
    
    // Update seller position
    const sellerPortfolio = await this.portfolioRepository.findOne({
      where: { userId: sellOrder.userId },
    });
    
    const sellerPosition = await this.positionRepository.findOne({
      where: { 
        portfolioId: sellerPortfolio.id,
        bondId: sellOrder.bondId 
      },
    });
    
    if (sellerPosition) {
      sellerPosition.qtyUnits -= qty;
      if (sellerPosition.qtyUnits <= 0) {
        await this.positionRepository.remove(sellerPosition);
      } else {
        await this.positionRepository.save(sellerPosition);
      }
    }
  }

  private async updatePortfolios(
    buyOrder: Order, 
    sellOrder: Order, 
    price: number, 
    qty: number
  ): Promise<void> {
    const tradeAmount = price * qty;
    
    // Debit buyer
    const buyerPortfolio = await this.portfolioRepository.findOne({
      where: { userId: buyOrder.userId },
    });
    buyerPortfolio.cashBalance -= tradeAmount;
    await this.portfolioRepository.save(buyerPortfolio);
    
    // Credit seller
    const sellerPortfolio = await this.portfolioRepository.findOne({
      where: { userId: sellOrder.userId },
    });
    sellerPortfolio.cashBalance += tradeAmount;
    await this.portfolioRepository.save(sellerPortfolio);
  }

  private generateTradeReceipt(
    buyOrder: Order, 
    sellOrder: Order, 
    price: number, 
    qty: number
  ): any {
    return {
      tradeId: null, // Will be set after save
      buyOrderId: buyOrder.id,
      sellOrderId: sellOrder.id,
      bondId: buyOrder.bondId,
      pricePerUnit: price,
      qtyUnits: qty,
      executedAt: new Date().toISOString(),
      pricingBreakdown: {
        cleanPrice: price * 0.98, // Mock - should be calculated
        accruedInterest: price * 0.02,
        fairValue: price * 0.99,
        sentimentAdjustment: price * 0.01,
      },
      mlSnapshot: {
        modelId: 'v1.0',
        timestamp: new Date().toISOString(),
        features: {}, // Will be populated by ML service
        explainability: {}, // Will be populated by ML service
      },
    };
  }

  private async getOrderBookSide(bondId: number, side: 'BUY' | 'SELL'): Promise<OrderBookLevel[]> {
    const orders = await this.orderRepository.find({
      where: { 
        bondId,
        side,
        status: 'OPEN'
      },
      order: { 
        priceLimit: side === 'BUY' ? 'DESC' : 'ASC',
        createdAt: 'ASC'
      },
    });
    
    // Group by price and calculate quantities
    const levels = new Map<number, OrderBookLevel>();
    
    for (const order of orders) {
      const price = order.priceLimit;
      if (!levels.has(price)) {
        levels.set(price, {
          price,
          quantity: 0,
          orders: [],
        });
      }
      
      const level = levels.get(price);
      level.quantity += order.qtyUnits - order.qtyFilledUnits;
      level.orders.push(order);
    }
    
    // Sort by price
    const sortedLevels = Array.from(levels.values()).sort((a, b) => {
      return side === 'BUY' ? b.price - a.price : a.price - b.price;
    });
    
    return sortedLevels;
  }
}
