import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';
import { Bond } from './bond.entity';

@Entity('repo_positions')
export class RepoPosition {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  borrowerUserId: number;

  @Column()
  lenderUserId: number;

  @Column()
  bondId: number;

  @Column()
  qtyUnits: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  collateralAmount: number;

  @Column({ type: 'decimal', precision: 8, scale: 4 })
  feeRate: number;

  @Column({ type: 'date' })
  startDate: Date;

  @Column({ type: 'date' })
  endDate: Date;

  @Column({ length: 20, default: 'ACTIVE' })
  status: 'ACTIVE' | 'CLOSED' | 'DEFAULTED';

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'borrowerUserId' })
  borrower: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'lenderUserId' })
  lender: User;

  @ManyToOne(() => Bond)
  @JoinColumn({ name: 'bondId' })
  bond: Bond;
}
