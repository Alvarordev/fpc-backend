import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { Enrollment } from './enrollment.entity';

@Entity('enrollment_family_talk_interests')
@Index('IDX_enrollment_family_talk_interests_enrollment_id', ['enrollmentId'])
export class EnrollmentFamilyTalkInterest {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' }) id!: string;
  @Column({ name: 'enrollment_id', type: 'uuid' }) enrollmentId!: string;
  @ManyToOne(() => Enrollment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'enrollment_id' }) enrollment!: Enrollment;
  @Column({ name: 'talk_name', type: 'varchar', length: 255 }) talkName!: string;
  @Column({ name: 'family_member_name', type: 'varchar', length: 255 })
  familyMemberName!: string;
  @Column({ name: 'family_member_phone', type: 'varchar', length: 50, nullable: true })
  familyMemberPhone!: string | null;
  @Column({ name: 'family_member_email', type: 'varchar', length: 255, nullable: true })
  familyMemberEmail!: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
}
