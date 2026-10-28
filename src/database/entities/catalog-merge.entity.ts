import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { CatalogItem, type CatalogKind } from './catalog-item.entity';
import { User } from './user.entity';

@Entity('catalog_merges')
@Index('IDX_catalog_merges_source_item_id', ['sourceItemId'])
@Index('IDX_catalog_merges_target_item_id', ['targetItemId'])
export class CatalogMerge {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' }) id!: string;
  @Column({ type: 'varchar', length: 50 }) kind!: CatalogKind;
  @Column({ name: 'source_item_id', type: 'uuid' }) sourceItemId!: string;
  @ManyToOne(() => CatalogItem)
  @JoinColumn({ name: 'source_item_id' })
  sourceItem?: CatalogItem;
  @Column({ name: 'target_item_id', type: 'uuid' }) targetItemId!: string;
  @ManyToOne(() => CatalogItem)
  @JoinColumn({ name: 'target_item_id' })
  targetItem?: CatalogItem;
  @Column({ name: 'source_code', type: 'varchar', length: 100 })
  sourceCode!: string;
  @Column({ name: 'target_code', type: 'varchar', length: 100 })
  targetCode!: string;
  @Column({ name: 'actor_user_id', type: 'uuid', nullable: true })
  actorUserId!: string | null;
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'actor_user_id' })
  actor?: User | null;
  /** Rows re-pointed per `table.column`. */
  @Column({ name: 'affected_rows', type: 'jsonb' })
  affectedRows!: Record<string, number>;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
