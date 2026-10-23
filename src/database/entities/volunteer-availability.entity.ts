import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Volunteer } from './volunteer.entity';
import { User } from './user.entity';
export enum AvailabilityStatus {
  AVAILABLE = 'AVAILABLE',
  RESERVED = 'RESERVED',
}
@Entity('volunteer_availability')
@Unique(['volunteerId', 'date', 'startTime'])
@Check(`"status" IN ('AVAILABLE','RESERVED')`)
@Index('IDX_volunteer_availability_volunteer_id', ['volunteerId'])
@Index('IDX_volunteer_availability_status', ['status'])
@Index('IDX_volunteer_availability_historical_loaded_by_id', [
  'historicalLoadedById',
])
export class VolunteerAvailability {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' }) id!: string;
  @Column({ name: 'volunteer_id', type: 'uuid' }) volunteerId!: string;
  @ManyToOne(() => Volunteer)
  @JoinColumn({ name: 'volunteer_id' })
  volunteer!: Volunteer;
  @Column({ type: 'date' }) date!: string;
  @Column({ name: 'start_time', type: 'time', nullable: true })
  startTime!: string | null;
  @Column({ name: 'end_time', type: 'time', nullable: true })
  endTime!: string | null;
  @Column({
    type: 'varchar',
    length: 20,
    default: AvailabilityStatus.AVAILABLE,
  })
  status!: AvailabilityStatus;
  @Column({ name: 'is_historical', type: 'boolean', default: false })
  isHistorical!: boolean;
  @Column({ name: 'historical_loaded_by_id', type: 'uuid', nullable: true })
  historicalLoadedById!: string | null;
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'historical_loaded_by_id' })
  historicalLoadedBy!: User | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
