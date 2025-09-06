import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';
import { Bond } from './bond.entity';

@Entity('lending_offers')
export class LendingOffer {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  lenderUserId: number;

  @Column()
  bondId: number;

  @Column()
  qtyUnits: number;

  @Column({ type: 'decimal', precision: 8, scale: 4 })
  feeRatePerAnnum: number;

  @Column()
  minTenorDays: number;

  @Column({ length: 20, default: 'CASH' })
  collateralType: 'CASH' | 'SECURITIES';

  @Column({ length: 20, default: 'ACTIVE' })
  status: 'ACTIVE' | 'FILLED' | 'CANCELLED';

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'lenderUserId' })
  lender: User;

  @ManyToOne(() => Bond)
  @JoinColumn({ name: 'bondId' })
  bond: Bond;
}
