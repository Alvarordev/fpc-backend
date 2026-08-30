import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export const PERU_DEPARTMENTS = [
  'AMAZONAS',
  'ANCASH',
  'APURIMAC',
  'AREQUIPA',
  'AYACUCHO',
  'CAJAMARCA',
  'CALLAO',
  'CUSCO',
  'HUANCAVELICA',
  'HUANUCO',
  'ICA',
  'JUNIN',
  'LA_LIBERTAD',
  'LAMBAYEQUE',
  'LIMA',
  'LORETO',
  'MADRE_DE_DIOS',
  'MOQUEGUA',
  'PASCO',
  'PIURA',
  'PUNO',
  'SAN_MARTIN',
  'TACNA',
  'TUMBES',
  'UCAYALI',
] as const;
export type PeruDepartment = (typeof PERU_DEPARTMENTS)[number];

export const HEALTH_CENTER_CATEGORIES = [
  'I-1',
  'I-2',
  'I-3',
  'I-4',
  'II-1',
  'II-2',
  'II-E',
  'III-1',
  'III-E',
  'III-2',
] as const;
export type HealthCenterCategory = (typeof HEALTH_CENTER_CATEGORIES)[number];

@Entity('health_centers')
@Check(
  `"department" IN (${PERU_DEPARTMENTS.map((department) => `'${department}'`).join(', ')})`,
)
@Check(
  `"category" IS NULL OR "category" IN (${HEALTH_CENTER_CATEGORIES.map((category) => `'${category}'`).join(', ')})`,
)
export class HealthCenter {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' }) id!: string;
  @Column({ type: 'varchar', length: 255 }) name!: string;
  @Column({ type: 'varchar', length: 255, unique: true }) slug!: string;
  @Column({ type: 'varchar', length: 50 }) department!: PeruDepartment;
  @Column({ type: 'varchar', length: 10, nullable: true })
  category!: HealthCenterCategory | null;
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;
  patientCount?: number;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
