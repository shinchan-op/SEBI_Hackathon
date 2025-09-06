import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';
import { Bond } from './bond.entity';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column()
  bondId: number;

  @Column({ length: 4 })
  side: 'BUY' | 'SELL';

  @Column({ length: 6 })
  orderType: 'MARKET' | 'LIMIT';

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  priceLimit?: number;

  @Column()
  qtyUnits: number;

  @Column({ default: 0 })
  qtyFilledUnits: number;

  @Column({ length: 20, default: 'OPEN' })
  status: 'OPEN' | 'EXECUTED' | 'CANCELLED' | 'EXPIRED' | 'PARTIAL';

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Bond)
  @JoinColumn({ name: 'bondId' })
  bond: Bond;
}
