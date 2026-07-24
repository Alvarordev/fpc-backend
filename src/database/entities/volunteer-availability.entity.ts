import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Unique,
} from 'typeorm';
import { Volunteer } from './volunteer.entity';
export enum AvailabilityStatus {
  AVAILABLE = 'AVAILABLE',
  RESERVED = 'RESERVED',
}
@Entity('volunteer_availability')
@Unique(['volunteerId', 'date', 'startTime'])
@Check(`"status" IN ('AVAILABLE','RESERVED')`)
export class VolunteerAvailability {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' }) id!: string;
  @Column({ name: 'volunteer_id', type: 'uuid' }) volunteerId!: string;
  @ManyToOne(() => Volunteer)
  @JoinColumn({ name: 'volunteer_id' })
  volunteer!: Volunteer;
  @Column({ type: 'date' }) date!: string;
  @Column({ name: 'start_time', type: 'time' }) startTime!: string;
  @Column({ name: 'end_time', type: 'time' }) endTime!: string;
  @Column({
    type: 'varchar',
    length: 20,
    default: AvailabilityStatus.AVAILABLE,
  })
  status!: AvailabilityStatus;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
