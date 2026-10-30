import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { User } from './user.entity';

/** Who exported patient data, with which filters and how many rows (X2). */
@Entity('export_logs')
@Index('IDX_export_logs_created_at', ['createdAt'])
export class ExportLog {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' }) id!: string;

  @Column({ name: 'user_id', type: 'uuid' }) userId!: string;
  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  filters!: Record<string, unknown>;

  @Column({ name: 'row_counts', type: 'jsonb', default: () => "'{}'::jsonb" })
  rowCounts!: Record<string, number>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
