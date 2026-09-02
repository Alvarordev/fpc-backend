import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export const CATALOG_KINDS = [
  'cancer_stage',
  'education_level',
  'insurance_type',
  'eps_provider',
  'native_language',
  'medical_specialty',
  'cancer_diagnosis',
  'entry_source',
  'entry_sub_source',
  'zone_type',
  'health_center_category',
  'care_program',
  'access_barrier',
  'treatment_situation',
  'sepa_shelter',
  'sepa_transport',
  'program_dropout_reason',
  'patient_health_phase',
  'patient_health_subcategory',
  'treatment_type',
] as const;

export type CatalogKind = (typeof CATALOG_KINDS)[number];

@Entity('catalog_items')
@Index('UQ_catalog_items_kind_code', ['kind', 'code'], { unique: true })
@Index('IDX_catalog_items_kind_active', ['kind', 'isActive'])
export class CatalogItem {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' })
  id!: string;

  @Column({ type: 'varchar', length: 50 })
  kind!: CatalogKind;

  @Column({ type: 'varchar', length: 100 })
  code!: string;

  @Column({ type: 'varchar', length: 255 })
  label!: string;

  @Column({ name: 'parent_code', type: 'varchar', length: 100, nullable: true })
  parentCode!: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'is_system', type: 'boolean', default: false })
  isSystem!: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
