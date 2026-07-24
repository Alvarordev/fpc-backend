import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('patient_summary_rate_limits')
export class PatientSummaryRateLimit {
  @PrimaryColumn({ type: 'varchar', length: 50 }) key!: string;

  @Column({ name: 'window_started_at', type: 'timestamptz' })
  windowStartedAt!: Date;

  @Column({ name: 'used_count', type: 'integer', default: 0 })
  usedCount!: number;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
