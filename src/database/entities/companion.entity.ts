import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { IdentityDocumentType } from './identity-document-type.enum';
import { Patient } from './patient.entity';
import type { CompanionPatient } from './companion-patient.entity';

/**
 * A1: familiar o amigo que acompaña a uno o varios pacientes. No es un
 * paciente; si llega a serlo se crea un paciente aparte (convertedPatientId).
 */
@Entity('companions')
@Check(
  'CHK_companions_document_type',
  `"document_type" IS NULL OR "document_type" IN ('DNI', 'CE', 'CPP')`,
)
@Index('UQ_companions_dni', ['dni'], {
  unique: true,
  where: '"dni" IS NOT NULL',
})
export class Companion {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' })
  id!: string;

  @Column({ name: 'full_name', type: 'varchar', length: 255 })
  fullName!: string;

  @Column({
    name: 'document_type',
    type: 'varchar',
    length: 10,
    nullable: true,
  })
  documentType!: IdentityDocumentType | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  dni!: string | null;

  @Column({ name: 'birth_date', type: 'date', nullable: true })
  birthDate!: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  gender!: string | null;

  @Column({
    name: 'primary_phone',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  primaryPhone!: string | null;

  @Column({
    name: 'secondary_phone',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  secondaryPhone!: string | null;

  @Column({ name: 'has_whatsapp', type: 'boolean', default: false })
  hasWhatsapp!: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email!: string | null;

  /** Paciente creado desde este contacto ("enrolar desde este contacto"). */
  @Column({ name: 'converted_patient_id', type: 'uuid', nullable: true })
  convertedPatientId!: string | null;

  @ManyToOne(() => Patient, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'converted_patient_id' })
  convertedPatient!: Patient | null;

  @OneToMany('CompanionPatient', 'companion')
  links!: CompanionPatient[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
