import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum KnowledgeStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}
export enum KnowledgeIndexStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  READY = 'READY',
  FAILED = 'FAILED',
}

@Entity('knowledge_documents')
@Index('IDX_knowledge_documents_publication', ['status', 'indexStatus'])
export class KnowledgeDocument {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' }) id!: string;
  @Column({ type: 'varchar', length: 200 }) title!: string;
  @Column({ type: 'varchar', length: 50 }) version!: string;
  @Column({ name: 'original_name', type: 'varchar', length: 240 })
  originalName!: string;
  @Column({ name: 'media_type', type: 'varchar', length: 100 })
  mediaType!: string;
  @Column({ type: 'integer' }) size!: number;
  @Column({ type: 'bytea', select: false }) content!: Buffer;
  @Column({ type: 'varchar', length: 20, default: KnowledgeStatus.DRAFT })
  status!: KnowledgeStatus;
  @Column({
    name: 'index_status',
    type: 'varchar',
    length: 20,
    default: KnowledgeIndexStatus.PENDING,
  })
  indexStatus!: KnowledgeIndexStatus;
  @Column({ name: 'index_started_at', type: 'timestamptz', nullable: true })
  indexStartedAt!: Date | null;
  @Column({ name: 'store_name', type: 'text', nullable: true }) storeName!:
    string | null;
  @Column({ name: 'operation_name', type: 'text', nullable: true })
  operationName!: string | null;
  @Column({ name: 'remote_name', type: 'text', nullable: true }) remoteName!:
    string | null;
  @Column({ name: 'index_error', type: 'text', nullable: true }) indexError!:
    string | null;
  @Column({ name: 'uploaded_by', type: 'uuid' }) uploadedBy!: string;
  @Column({ name: 'updated_by', type: 'uuid' }) updatedBy!: string;
  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt!: Date | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
