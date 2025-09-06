import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Bond } from './bond.entity';

@Entity('sip_pool_balances')
export class SipPoolBalance {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  bondId: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalSipAmount: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  reservedForRecycling: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  availableForRecycling: number;

  @CreateDateColumn()
  lastUpdated: Date;

  @ManyToOne(() => Bond)
  @JoinColumn({ name: 'bondId' })
  bond: Bond;
}
