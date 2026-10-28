import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { AssistantConversation } from './assistant-conversation.entity';

export enum AssistantMessageRole {
  USER = 'USER',
  ASSISTANT = 'ASSISTANT',
}

/** Herramienta que ejecutó el asistente para responder (fuente citada). */
export type AssistantToolCall = {
  name: string;
  args: Record<string, unknown>;
  ok: boolean;
  error?: string;
  durationMs: number;
};

@Entity('assistant_messages')
@Index('IDX_assistant_messages_conversation_id', ['conversationId'])
export class AssistantMessage {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' })
  id!: string;

  @Column({ name: 'conversation_id', type: 'uuid' })
  conversationId!: string;

  @ManyToOne(() => AssistantConversation, (c) => c.messages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'conversation_id' })
  conversation!: AssistantConversation;

  @Column({ type: 'varchar', length: 20 })
  role!: AssistantMessageRole;

  /** Texto tal como lo vio el modelo: con seudónimos, no con nombres. */
  @Column({ type: 'text' })
  content!: string;

  @Column({ name: 'tool_calls', type: 'jsonb', default: () => `'[]'::jsonb` })
  toolCalls!: AssistantToolCall[];

  @Column({ type: 'varchar', length: 100, nullable: true })
  model!: string | null;

  @Column({ name: 'input_tokens', type: 'integer', nullable: true })
  inputTokens!: number | null;

  @Column({ name: 'output_tokens', type: 'integer', nullable: true })
  outputTokens!: number | null;

  @Column({ type: 'text', nullable: true })
  error!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
