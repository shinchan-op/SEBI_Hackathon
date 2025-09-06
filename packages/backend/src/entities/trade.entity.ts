import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Order } from './order.entity';
import { Bond } from './bond.entity';

@Entity('trades')
export class Trade {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  buyOrderId: number;

  @Column()
  sellOrderId: number;

  @Column()
  bondId: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  pricePerUnit: number;

  @Column()
  qtyUnits: number;

  @CreateDateColumn()
  executedAt: Date;

  @Column({ type: 'jsonb' })
  tradeReceiptJson: any;

  @ManyToOne(() => Order)
  @JoinColumn({ name: 'buyOrderId' })
  buyOrder: Order;

  @ManyToOne(() => Order)
  @JoinColumn({ name: 'sellOrderId' })
  sellOrder: Order;

  @ManyToOne(() => Bond)
  @JoinColumn({ name: 'bondId' })
  bond: Bond;
}
