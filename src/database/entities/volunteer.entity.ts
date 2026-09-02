import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('volunteers')
export class Volunteer {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' })
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @OneToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'first_name', type: 'varchar', length: 255 })
  firstName!: string;

  @Column({ name: 'last_name', type: 'varchar', length: 255 })
  lastName!: string;

  @Column({ type: 'varchar', length: 255 })
  specialty!: string;

  @Column({ type: 'varchar', length: 255 })
  email!: string;

  @Column({ type: 'varchar', length: 50 })
  phone!: string;

  @Column({ name: 'birth_date', type: 'date', nullable: true })
  birthDate!: string | null;

  @Column({ name: 'commitment_start_at', type: 'date', nullable: true })
  commitmentStartAt!: string | null;

  @Column({ name: 'commitment_end_at', type: 'date', nullable: true })
  commitmentEndAt!: string | null;

  @Column({
    name: 'has_volunteer_certificate',
    type: 'boolean',
    default: false,
  })
  hasVolunteerCertificate!: boolean;

  @Column({ name: 'additional_comments', type: 'text', nullable: true })
  additionalComments!: string | null;

  @Column({
    name: 'completed_sustainability_module',
    type: 'boolean',
    default: false,
  })
  completedSustainabilityModule!: boolean;

  @Column({
    name: 'completed_design_thinking_module',
    type: 'boolean',
    default: false,
  })
  completedDesignThinkingModule!: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'is_anonymous', type: 'boolean', default: false })
  isAnonymous!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
