import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';
import { Trade } from '../entities/trade.entity';
import { Order } from '../entities/order.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';

export interface SurveillanceAlert {
  id: string;
  type: 'VOLUME_SPIKE' | 'PRICE_ANOMALY' | 'WASH_TRADE' | 'MM_BREACH' | 'CIRCUIT_BREAKER';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  bondId?: number;
  userId?: number;
  description: string;
  timestamp: Date;
  data: any;
  resolved: boolean;
}

export interface CircuitBreakerStatus {
  bondId: number;
  status: 'NORMAL' | 'SOFT_HALT' | 'HARD_HALT';
  reason?: string;
  triggeredAt?: Date;
  resetAt?: Date;
}

@Injectable()
export class ComplianceService {
  private readonly logger = new Logger(ComplianceService.name);
  private circuitBreakers = new Map<number, CircuitBreakerStatus>();
  private alerts: SurveillanceAlert[] = [];

  constructor(
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
    @InjectRepository(Trade)
    private tradeRepository: Repository<Trade>,
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    private eventEmitter: EventEmitter2,
  ) {}

  async logEvent(
    eventType: string,
    payload: any,
    sourceService: string,
    userId?: number,
    bondId?: number
  ): Promise<void> {
    const auditLog = this.auditLogRepository.create({
      eventType,
      payloadJson: payload,
      sourceService,
      userId,
      bondId,
    });

    await this.auditLogRepository.save(auditLog);
    
    // Trigger real-time surveillance
    await this.performSurveillance(eventType, payload, userId, bondId);
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async runSurveillanceChecks(): Promise<void> {
    this.logger.log('Running surveillance checks');

    // Check for volume spikes
    await this.checkVolumeSpikes();
    
    // Check for price anomalies
    await this.checkPriceAnomalies();
    
    // Check for wash trades
    await this.checkWashTrades();
    
    // Check circuit breakers
    await this.checkCircuitBreakers();
  }

  @Cron(CronExpression.EVERY_HOUR)
  async generateComplianceReport(): Promise<void> {
    this.logger.log('Generating compliance report');

    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    // Get today's activity
    const trades = await this.tradeRepository.find({
      where: { executedAt: startOfDay },
    });

    const orders = await this.orderRepository.find({
      where: { createdAt: startOfDay },
    });

    const alerts = this.alerts.filter(a => a.timestamp >= startOfDay);

    const report = {
      date: today.toISOString().split('T')[0],
      totalTrades: trades.length,
      totalVolume: trades.reduce((sum, t) => sum + (t.pricePerUnit * t.qtyUnits), 0),
      totalOrders: orders.length,
      alertsGenerated: alerts.length,
      criticalAlerts: alerts.filter(a => a.severity === 'CRITICAL').length,
      circuitBreakerTriggers: Array.from(this.circuitBreakers.values()).filter(cb => cb.status !== 'NORMAL').length,
    };

    this.eventEmitter.emit('compliance.report.generated', { report });
    this.logger.log(`Compliance report generated: ${JSON.stringify(report)}`);
  }

  private async performSurveillance(
    eventType: string,
    payload: any,
    userId?: number,
    bondId?: number
  ): Promise<void> {
    // Real-time surveillance based on event type
    switch (eventType) {
      case 'trade.executed':
        await this.analyzeTrade(payload, userId, bondId);
        break;
      case 'order.placed':
        await this.analyzeOrder(payload, userId, bondId);
        break;
      case 'price.updated':
        await this.analyzePriceMovement(payload, bondId);
        break;
    }
  }

  private async analyzeTrade(trade: Trade, userId?: number, bondId?: number): Promise<void> {
    // Check for unusual trade size
    const avgTradeSize = await this.getAverageTradeSize(bondId);
    if (trade.qtyUnits > avgTradeSize * 3) {
      await this.createAlert({
        type: 'VOLUME_SPIKE',
        severity: 'MEDIUM',
        bondId,
        userId,
        description: `Large trade detected: ${trade.qtyUnits} units`,
        data: { tradeId: trade.id, qtyUnits: trade.qtyUnits, avgSize: avgTradeSize },
      });
    }

    // Check for rapid consecutive trades
    const recentTrades = await this.getRecentTrades(bondId, 5); // Last 5 minutes
    if (recentTrades.length > 10) {
      await this.createAlert({
        type: 'VOLUME_SPIKE',
        severity: 'HIGH',
        bondId,
        description: `High trading frequency: ${recentTrades.length} trades in 5 minutes`,
        data: { tradeCount: recentTrades.length, period: '5m' },
      });
    }
  }

  private async analyzeOrder(order: Order, userId?: number, bondId?: number): Promise<void> {
    // Check for order manipulation patterns
    const recentOrders = await this.getRecentOrders(userId, 10); // Last 10 orders
    const cancelRate = recentOrders.filter(o => o.status === 'CANCELLED').length / recentOrders.length;
    
    if (cancelRate > 0.8) {
      await this.createAlert({
        type: 'WASH_TRADE',
        severity: 'HIGH',
        userId,
        description: `High order cancellation rate: ${(cancelRate * 100).toFixed(1)}%`,
        data: { cancelRate, recentOrders: recentOrders.length },
      });
    }
  }

  private async analyzePriceMovement(priceData: any, bondId?: number): Promise<void> {
    if (!bondId) return;

    const currentPrice = priceData.price;
    const previousPrice = priceData.previousPrice;
    
    if (!previousPrice) return;

    const priceChange = Math.abs((currentPrice - previousPrice) / previousPrice);
    
    // Check for significant price movement
    if (priceChange > 0.05) { // 5% change
      await this.createAlert({
        type: 'PRICE_ANOMALY',
        severity: 'HIGH',
        bondId,
        description: `Significant price movement: ${(priceChange * 100).toFixed(2)}%`,
        data: { currentPrice, previousPrice, change: priceChange },
      });

      // Trigger circuit breaker if movement is too large
      if (priceChange > 0.10) { // 10% change
        await this.triggerCircuitBreaker(bondId, 'HARD_HALT', 'Excessive price movement');
      } else if (priceChange > 0.07) { // 7% change
        await this.triggerCircuitBreaker(bondId, 'SOFT_HALT', 'Significant price movement');
      }
    }
  }

  private async checkVolumeSpikes(): Promise<void> {
    // Check for unusual volume patterns across all bonds
    const bonds = await this.getActiveBonds();
    
    for (const bondId of bonds) {
      const currentVolume = await this.getCurrentVolume(bondId);
      const avgVolume = await this.getAverageVolume(bondId);
      
      if (currentVolume > avgVolume * 2) {
        await this.createAlert({
          type: 'VOLUME_SPIKE',
          severity: 'MEDIUM',
          bondId,
          description: `Volume spike detected: ${currentVolume} vs avg ${avgVolume}`,
          data: { currentVolume, avgVolume },
        });
      }
    }
  }

  private async checkPriceAnomalies(): Promise<void> {
    // Check for price anomalies across all bonds
    const bonds = await this.getActiveBonds();
    
    for (const bondId of bonds) {
      const priceData = await this.getPriceData(bondId);
      if (priceData) {
        await this.analyzePriceMovement(priceData, bondId);
      }
    }
  }

  private async checkWashTrades(): Promise<void> {
    // Check for potential wash trades
    const recentTrades = await this.getRecentTrades(null, 60); // Last hour
    
    // Group trades by user and bond
    const tradeGroups = new Map<string, Trade[]>();
    
    for (const trade of recentTrades) {
      const key = `${trade.buyOrderId}-${trade.sellOrderId}`;
      if (!tradeGroups.has(key)) {
        tradeGroups.set(key, []);
      }
      tradeGroups.get(key).push(trade);
    }
    
    // Check for suspicious patterns
    for (const [key, trades] of tradeGroups) {
      if (trades.length > 5) { // Multiple trades between same parties
        await this.createAlert({
          type: 'WASH_TRADE',
          severity: 'HIGH',
          description: `Potential wash trading: ${trades.length} trades between same parties`,
          data: { tradeCount: trades.length, key },
        });
      }
    }
  }

  private async checkCircuitBreakers(): Promise<void> {
    // Check if circuit breakers should be reset
    const now = new Date();
    
    for (const [bondId, status] of this.circuitBreakers) {
      if (status.status === 'SOFT_HALT' && status.triggeredAt) {
        const elapsed = now.getTime() - status.triggeredAt.getTime();
        if (elapsed > 5 * 60 * 1000) { // 5 minutes
          await this.resetCircuitBreaker(bondId);
        }
      }
    }
  }

  private async triggerCircuitBreaker(
    bondId: number,
    status: 'SOFT_HALT' | 'HARD_HALT',
    reason: string
  ): Promise<void> {
    this.circuitBreakers.set(bondId, {
      bondId,
      status,
      reason,
      triggeredAt: new Date(),
    });

    await this.createAlert({
      type: 'CIRCUIT_BREAKER',
      severity: 'CRITICAL',
      bondId,
      description: `Circuit breaker triggered: ${reason}`,
      data: { status, reason },
    });

    this.eventEmitter.emit('circuit.breaker.triggered', { bondId, status, reason });
    this.logger.warn(`Circuit breaker triggered for bond ${bondId}: ${reason}`);
  }

  private async resetCircuitBreaker(bondId: number): Promise<void> {
    this.circuitBreakers.set(bondId, {
      bondId,
      status: 'NORMAL',
      resetAt: new Date(),
    });

    this.eventEmitter.emit('circuit.breaker.reset', { bondId });
    this.logger.log(`Circuit breaker reset for bond ${bondId}`);
  }

  private async createAlert(alertData: Omit<SurveillanceAlert, 'id' | 'timestamp' | 'resolved'>): Promise<void> {
    const alert: SurveillanceAlert = {
      ...alertData,
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      resolved: false,
    };

    this.alerts.push(alert);
    
    this.eventEmitter.emit('surveillance.alert', { alert });
    this.logger.warn(`Surveillance alert: ${alert.description}`);
  }

  // Helper methods (simplified implementations)
  private async getAverageTradeSize(bondId?: number): Promise<number> {
    // Mock implementation - in production, calculate from historical data
    return 1000;
  }

  private async getRecentTrades(bondId?: number, minutes: number): Promise<Trade[]> {
    const since = new Date(Date.now() - minutes * 60 * 1000);
    return this.tradeRepository.find({
      where: bondId ? { bondId, executedAt: since } : { executedAt: since },
      order: { executedAt: 'DESC' },
    });
  }

  private async getRecentOrders(userId: number, count: number): Promise<Order[]> {
    return this.orderRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: count,
    });
  }

  private async getActiveBonds(): Promise<number[]> {
    // Mock implementation - in production, get from bonds table
    return [1, 2, 3, 4, 5];
  }

  private async getCurrentVolume(bondId: number): Promise<number> {
    // Mock implementation
    return Math.random() * 10000;
  }

  private async getAverageVolume(bondId: number): Promise<number> {
    // Mock implementation
    return 5000;
  }

  private async getPriceData(bondId: number): Promise<any> {
    // Mock implementation
    return {
      price: 1000 + Math.random() * 100,
      previousPrice: 1000 + Math.random() * 100,
    };
  }

  async getAlerts(severity?: string, resolved?: boolean): Promise<SurveillanceAlert[]> {
    let filtered = this.alerts;
    
    if (severity) {
      filtered = filtered.filter(a => a.severity === severity);
    }
    
    if (resolved !== undefined) {
      filtered = filtered.filter(a => a.resolved === resolved);
    }
    
    return filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async getCircuitBreakerStatus(bondId: number): Promise<CircuitBreakerStatus | null> {
    return this.circuitBreakers.get(bondId) || null;
  }

  async getAllCircuitBreakers(): Promise<CircuitBreakerStatus[]> {
    return Array.from(this.circuitBreakers.values());
  }
}
