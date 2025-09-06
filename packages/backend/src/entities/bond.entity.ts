import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('bonds')
export class Bond {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, length: 20 })
  isin: string;

  @Column({ length: 255 })
  issuer: string;

  @Column({ length: 500 })
  name: string;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  coupon: number;

  @Column({ type: 'date' })
  maturityDate: Date;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  faceValue: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  fractionSize: number;

  @Column({ length: 10 })
  rating: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  issueSize?: number;

  @Column({ length: 50, nullable: true })
  listingSource?: string;

  @Column({ type: 'decimal', precision: 8, scale: 4, nullable: true })
  lastTradedPrice?: number;

  @Column({ type: 'decimal', precision: 8, scale: 4, nullable: true })
  lastTradedYield?: number;

  @Column({ default: 0 })
  daysSinceLastTrade: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
