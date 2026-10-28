import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { AssistantConversation } from '../../../database/entities/assistant-conversation.entity';
import {
  AssistantMessage,
  AssistantMessageRole,
} from '../../../database/entities/assistant-message.entity';
import { AssistantPseudonymizer } from '../assistant-pseudonyms';

export class AskAssistantDto {
  @ApiProperty({
    maxLength: 2000,
    example: '¿Cuántos pacientes activos hay en Lima?',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Omitir para empezar una conversación nueva.',
  })
  @IsOptional()
  @IsUUID()
  conversationId?: string;
}

export class AssistantSourceDto {
  @ApiProperty() tool!: string;
  @ApiProperty({ description: 'Nombre legible de la fuente' }) label!: string;
  @ApiProperty({ type: 'object', additionalProperties: true })
  args!: Record<string, unknown>;
  @ApiProperty() ok!: boolean;
  @ApiPropertyOptional() error?: string;
}

export class AssistantPatientMentionDto {
  @ApiProperty({ example: 'P-001' }) token!: string;
  @ApiProperty({ format: 'uuid' }) patientId!: string;
  @ApiProperty() name!: string;
}

export class AssistantMessageResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: AssistantMessageRole }) role!: AssistantMessageRole;
  @ApiProperty({
    description: 'Markdown con los nombres reales ya rehidratados',
  })
  content!: string;
  @ApiProperty({ type: [AssistantSourceDto] }) sources!: AssistantSourceDto[];
  @ApiProperty({ type: [AssistantPatientMentionDto] })
  patients!: AssistantPatientMentionDto[];
  @ApiProperty() isError!: boolean;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;

  static from(
    message: AssistantMessage,
    pseudonyms: AssistantPseudonymizer,
    labelFor: (tool: string) => string,
  ): AssistantMessageResponseDto {
    return {
      id: message.id,
      role: message.role,
      content: pseudonyms.rehydrate(message.content),
      sources: message.toolCalls.map((call) => ({
        tool: call.name,
        label: labelFor(call.name),
        args: call.args,
        ok: call.ok,
        error: call.error,
      })),
      patients: pseudonyms.mentioned(message.content),
      isError: Boolean(message.error),
      createdAt: message.createdAt,
    };
  }
}

export class AssistantConversationSummaryDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ format: 'date-time' }) updatedAt!: Date;

  static from(
    conversation: AssistantConversation,
  ): AssistantConversationSummaryDto {
    const { id, title, createdAt, updatedAt } = conversation;
    return { id, title, createdAt, updatedAt };
  }
}

export class AssistantConversationResponseDto extends AssistantConversationSummaryDto {
  @ApiProperty({ type: [AssistantMessageResponseDto] })
  messages!: AssistantMessageResponseDto[];
}

export class AskAssistantResponseDto {
  @ApiProperty({ format: 'uuid' }) conversationId!: string;
  @ApiProperty({ type: AssistantMessageResponseDto })
  question!: AssistantMessageResponseDto;
  @ApiProperty({ type: AssistantMessageResponseDto })
  answer!: AssistantMessageResponseDto;
}
