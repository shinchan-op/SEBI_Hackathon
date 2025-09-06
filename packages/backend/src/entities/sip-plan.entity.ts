import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';
import { Bond } from './bond.entity';

@Entity('sip_plans')
export class SipPlan {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amountPerPeriod: number;

  @Column({ length: 10 })
  frequency: 'WEEKLY' | 'MONTHLY';

  @Column({ nullable: true })
  targetBondId?: number;

  @Column({ length: 50, nullable: true })
  targetBucketId?: string;

  @Column({ type: 'date' })
  nextRunDate: Date;

  @Column({ length: 20, default: 'ACTIVE' })
  status: 'ACTIVE' | 'PAUSED' | 'CANCELLED';

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Bond)
  @JoinColumn({ name: 'targetBondId' })
  targetBond: Bond;
}
