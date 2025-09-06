import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Bond } from './bond.entity';

@Entity('mpi_metrics')
export class MpiMetrics {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  bondId: number;

  @Column({ default: 0 })
  pageViews: number;

  @Column({ default: 0 })
  watchlistCount: number;

  @Column({ default: 0 })
  orderDepth: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  executedVolumeVelocity: number;

  @Column({ type: 'decimal', precision: 5, scale: 4, default: 0 })
  computedMpi: number;

  @CreateDateColumn()
  timestamp: Date;

  @ManyToOne(() => Bond)
  @JoinColumn({ name: 'bondId' })
  bond: Bond;
}
