import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { Portfolio } from './portfolio.entity';
import { Bond } from './bond.entity';

@Entity('positions')
@Unique(['portfolioId', 'bondId'])
export class Position {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  portfolioId: number;

  @Column()
  bondId: number;

  @Column({ default: 0 })
  qtyUnits: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  avgPricePerUnit: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Portfolio)
  @JoinColumn({ name: 'portfolioId' })
  portfolio: Portfolio;

  @ManyToOne(() => Bond)
  @JoinColumn({ name: 'bondId' })
  bond: Bond;
}
