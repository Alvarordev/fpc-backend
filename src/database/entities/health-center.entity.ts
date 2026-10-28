import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UbigeoDistrict } from './ubigeo.entity';

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

/** MINSA categories (NTS 021-MINSA). */
export const HEALTH_CENTER_CATEGORIES = [
  'I-1',
  'I-2',
  'I-3',
  'I-4',
  'II-1',
  'II-2',
  'II-E',
  'III-1',
  'III-2',
  'III-E',
] as const;
export type HealthCenterCategory = (typeof HEALTH_CENTER_CATEGORIES)[number];

export const HEALTH_CENTER_CARE_LEVELS = ['I', 'II', 'III'] as const;
export type HealthCenterCareLevel = (typeof HEALTH_CENTER_CARE_LEVELS)[number];

export const HEALTH_CENTER_INSTITUTIONS = [
  'MINSA',
  'ESSALUD',
  'FFAA_PNP',
  'PRIVADO',
  'GOBIERNO_REGIONAL',
  'OTRO',
] as const;
export type HealthCenterInstitution =
  (typeof HEALTH_CENTER_INSTITUTIONS)[number];

export function careLevelFor(
  category: HealthCenterCategory | null,
): HealthCenterCareLevel | null {
  return category ? (category.split('-')[0] as HealthCenterCareLevel) : null;
}

const quoted = (values: readonly string[]) =>
  values.map((value) => `'${value}'`).join(', ');

@Entity('health_centers')
@Check(`"department" IN (${quoted(PERU_DEPARTMENTS)})`)
@Check(`"care_category" IN (${quoted(HEALTH_CENTER_CATEGORIES)})`)
@Check(`"institution" IN (${quoted(HEALTH_CENTER_INSTITUTIONS)})`)
@Index('UQ_health_centers_renipress_code', ['renipressCode'], {
  unique: true,
  where: '"renipress_code" IS NOT NULL',
})
export class HealthCenter {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' }) id!: string;
  @Column({ type: 'varchar', length: 255 }) name!: string;
  @Column({ type: 'varchar', length: 255, unique: true }) slug!: string;
  @Column({ type: 'varchar', length: 50 }) department!: PeruDepartment;
  @Column({ name: 'care_category', type: 'varchar', length: 5, nullable: true })
  careCategory!: HealthCenterCategory | null;
  @Column({
    name: 'care_level',
    type: 'varchar',
    length: 3,
    nullable: true,
    generatedType: 'STORED',
    asExpression: `split_part("care_category", '-', 1)`,
    insert: false,
    update: false,
  })
  careLevel!: HealthCenterCareLevel | null;
  @Column({ type: 'varchar', length: 30, nullable: true })
  institution!: HealthCenterInstitution | null;
  @Column({
    name: 'ubigeo_district_code',
    type: 'varchar',
    length: 6,
    nullable: true,
  })
  ubigeoDistrictCode!: string | null;
  @ManyToOne(() => UbigeoDistrict, { nullable: true })
  @JoinColumn({ name: 'ubigeo_district_code' })
  ubigeoDistrict?: UbigeoDistrict | null;
  @Column({
    name: 'renipress_code',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  renipressCode!: string | null;
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;
  patientCount?: number;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
