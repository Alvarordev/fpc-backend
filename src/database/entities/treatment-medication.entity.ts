import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { PatientTreatment } from './patient-treatment.entity';
import { Patient } from './patient.entity';
import { Duration } from './embedded/duration.embedded';
import { DoseUnit } from './dose-unit.enum';
import { MedicationRoute } from './medication-route.enum';

@Entity('treatment_medications')
@Check(
  `"dose_unit" IS NULL OR "dose_unit" IN ('MG','G','ML','UI','TABLET','DROP','OTHER')`,
)
@Check(
  `"route" IS NULL OR "route" IN ('ORAL','IV','IM','SUBCUTANEOUS','TOPICAL','OTHER')`,
)
@Index('IDX_treatment_medications_treatment_id', ['treatmentId'])
@Index('IDX_treatment_medications_patient_id', ['patientId'])
export class TreatmentMedication {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' }) id!: string;
  @Column({ name: 'treatment_id', type: 'uuid' }) treatmentId!: string;
  @ManyToOne(() => PatientTreatment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'treatment_id' })
  treatment!: PatientTreatment;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId!: string;
  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient!: Patient;
  @Column({ type: 'varchar', length: 255 }) name!: string;
  @Column({
    name: 'dose_amount',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  doseAmount!: string | null;
  @Column({ name: 'dose_unit', type: 'varchar', length: 20, nullable: true })
  doseUnit!: DoseUnit | null;
  @Column({
    name: 'dose_description',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  doseDescription!: string | null;
  @Column({ type: 'varchar', length: 20, nullable: true })
  route!: MedicationRoute | null;
  @Column(() => Duration, { prefix: 'frequency' })
  frequency!: Duration;
  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate!: string | null;
  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate!: string | null;
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;
  @Column({ type: 'text', nullable: true }) notes!: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
