import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';
import { Bond } from './bond.entity';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  eventType: string;

  @Column({ type: 'jsonb' })
  payloadJson: any;

  @CreateDateColumn()
  timestamp: Date;

  @Column({ length: 50 })
  sourceService: string;

  @Column({ nullable: true })
  userId?: number;

  @Column({ nullable: true })
  bondId?: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Bond)
  @JoinColumn({ name: 'bondId' })
  bond: Bond;
}
