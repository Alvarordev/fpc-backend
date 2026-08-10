import { Column } from 'typeorm';
import { DurationUnit } from '../duration-unit.enum';

export class Duration {
  @Column({
    name: 'value_min',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  valueMin!: string | null;

  @Column({
    name: 'value_max',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  valueMax!: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  unit!: DurationUnit | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  label!: string | null;

  @Column({ name: 'canonical_minutes_min', type: 'integer', nullable: true })
  canonicalMinutesMin!: number | null;

  @Column({ name: 'canonical_minutes_max', type: 'integer', nullable: true })
  canonicalMinutesMax!: number | null;
}
