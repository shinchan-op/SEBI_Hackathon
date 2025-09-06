import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { HttpModule } from '@nestjs/axios';

// Entities
import { Bond } from './entities/bond.entity';
import { User } from './entities/user.entity';
import { Order } from './entities/order.entity';
import { Trade } from './entities/trade.entity';
import { Portfolio } from './entities/portfolio.entity';
import { Position } from './entities/position.entity';
import { SipPlan } from './entities/sip-plan.entity';
import { SipPoolBalance } from './entities/sip-pool-balance.entity';
import { LendingOffer } from './entities/lending-offer.entity';
import { RepoPosition } from './entities/repo-position.entity';
import { AuditLog } from './entities/audit-log.entity';
import { MpiMetrics } from './entities/mpi-metrics.entity';
import { MarketMaker } from './entities/market-maker.entity';

// Services
import { BondsService } from './bonds/bonds.service';
import { PricingService } from './pricing/pricing.service';
import { SimpleOrderbookService } from './orderbook/simple-orderbook.service';
import { OrdersService } from './orders/orders.service';
import { PortfolioService } from './portfolio/portfolio.service';
import { SipService } from './sip/sip.service';
import { RepoService } from './repo/repo.service';
import { MarketMakerService } from './market-maker/market-maker.service';
import { ComplianceService } from './compliance/compliance.service';

// Controllers
import { BondsController } from './bonds/bonds.controller';
import { OrdersController } from './orders/orders.controller';
import { PortfolioController } from './portfolio/portfolio.controller';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      database: process.env.DB_DATABASE || 'sebi_marketplace',
      entities: [
        Bond,
        User,
        Order,
        Trade,
        Portfolio,
        Position,
        SipPlan,
        SipPoolBalance,
        LendingOffer,
        RepoPosition,
        AuditLog,
        MpiMetrics,
        MarketMaker,
      ],
      synchronize: process.env.NODE_ENV === 'development',
      logging: process.env.NODE_ENV === 'development',
    }),
    TypeOrmModule.forFeature([
      Bond,
      User,
      Order,
      Trade,
      Portfolio,
      Position,
      SipPlan,
      SipPoolBalance,
      LendingOffer,
      RepoPosition,
      AuditLog,
      MpiMetrics,
      MarketMaker,
    ]),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    HttpModule,
  ],
  controllers: [
    BondsController,
    OrdersController,
    PortfolioController,
    HealthController,
  ],
  providers: [
    BondsService,
    PricingService,
    SimpleOrderbookService,
    OrdersService,
    PortfolioService,
    SipService,
    RepoService,
    MarketMakerService,
    ComplianceService,
  ],
})
export class AppModule {}
