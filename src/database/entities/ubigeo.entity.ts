import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
} from 'typeorm';

@Entity('ubigeo_departments')
export class UbigeoDepartment {
  /** Matches PERU_DEPARTMENTS codes used elsewhere in the API. */
  @PrimaryColumn({ type: 'varchar', length: 50 })
  code!: string;

  @Column({ name: 'inei_code', type: 'varchar', length: 2, unique: true })
  ineiCode!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @OneToMany(() => UbigeoProvince, (province) => province.department)
  provinces!: UbigeoProvince[];
}

@Entity('ubigeo_provinces')
export class UbigeoProvince {
  @PrimaryColumn({ name: 'inei_code', type: 'varchar', length: 4 })
  ineiCode!: string;

  @Column({ name: 'department_code', type: 'varchar', length: 50 })
  departmentCode!: string;

  @ManyToOne(() => UbigeoDepartment, (department) => department.provinces)
  @JoinColumn({ name: 'department_code' })
  department!: UbigeoDepartment;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @OneToMany(() => UbigeoDistrict, (district) => district.province)
  districts!: UbigeoDistrict[];
}

@Entity('ubigeo_districts')
export class UbigeoDistrict {
  @PrimaryColumn({ name: 'inei_code', type: 'varchar', length: 6 })
  ineiCode!: string;

  @Column({ name: 'province_inei_code', type: 'varchar', length: 4 })
  provinceIneiCode!: string;

  @ManyToOne(() => UbigeoProvince, (province) => province.districts)
  @JoinColumn({ name: 'province_inei_code' })
  province!: UbigeoProvince;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;
}
