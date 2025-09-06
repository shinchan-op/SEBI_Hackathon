import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('market_makers')
export class MarketMaker {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column({ length: 255 })
  companyName: string;

  @Column({ length: 20, default: 'BRONZE' })
  tier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';

  @Column({ default: 10 })
  minSpreadBps: number;

  @Column({ default: 1000 })
  minSizeUnits: number;

  @Column({ type: 'jsonb' })
  obligationHours: {
    start: string;
    end: string;
    timezone: string;
  };

  @Column({ length: 20, default: 'PENDING' })
  status: 'PENDING' | 'APPROVED' | 'SUSPENDED';

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;
}
