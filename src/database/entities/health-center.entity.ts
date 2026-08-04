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

@Entity('health_centers')
@Check(
  `"department" IN (${PERU_DEPARTMENTS.map((department) => `'${department}'`).join(', ')})`,
)
export class HealthCenter {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' }) id!: string;
  @Column({ type: 'varchar', length: 255 }) name!: string;
  @Column({ type: 'varchar', length: 255, unique: true }) slug!: string;
  @Column({ type: 'varchar', length: 50 }) department!: PeruDepartment;
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;
  patientCount?: number;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
