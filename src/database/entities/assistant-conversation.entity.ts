import {
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
import { User } from './user.entity';
import { AssistantMessage } from './assistant-message.entity';
import { AssistantMode } from './assistant-mode.enum';

/** Seudónimo (IA4) → paciente real. Solo vive en la base, nunca va al modelo. */
export type AssistantPseudonyms = Record<
  string,
  { patientId: string; name: string }
>;

// IA2: conversación del asistente de datos. Cada pregunta queda registrada.
@Entity('assistant_conversations')
@Index('IDX_assistant_conversations_user_id', ['userId'])
export class AssistantConversation {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' })
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'varchar', length: 20, default: AssistantMode.DATA })
  mode!: AssistantMode;

  @Column({ type: 'jsonb', default: () => `'{}'::jsonb` })
  pseudonyms!: AssistantPseudonyms;

  @OneToMany(() => AssistantMessage, (message) => message.conversation)
  messages!: AssistantMessage[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
