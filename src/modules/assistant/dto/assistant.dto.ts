import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
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
import { AssistantMode } from '../../../database/entities/assistant-mode.enum';

export class AssistantConversationQueryDto {
  @ApiPropertyOptional({ enum: AssistantMode, default: AssistantMode.DATA })
  @IsOptional()
  @IsEnum(AssistantMode)
  mode: AssistantMode = AssistantMode.DATA;
}

export class AskAssistantDto extends AssistantConversationQueryDto {
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

export class AssistantDocumentCitationDto {
  @ApiProperty() number!: number;
  @ApiProperty({ format: 'uuid' }) documentId!: string;
  @ApiProperty() title!: string;
  @ApiProperty() version!: string;
  @ApiProperty() originalName!: string;
  @ApiProperty({ type: Number, nullable: true }) page!: number | null;
  @ApiProperty() excerpt!: string;
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
  @ApiProperty({ type: [AssistantDocumentCitationDto] })
  citations!: AssistantDocumentCitationDto[];
  @ApiProperty() unanswered!: boolean;
  @ApiProperty() isError!: boolean;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;

  static from(
    message: AssistantMessage,
    pseudonyms: AssistantPseudonymizer,
    labelFor: (tool: string) => string,
  ): AssistantMessageResponseDto {
    const referenced = new Set(
      [...message.content.matchAll(/\[\d+\]\(#source-(\d+)\)/g)].map((match) =>
        Number(match[1]),
      ),
    );
    const originalCitations = (message.citations ?? []).filter((citation) =>
      referenced.has(citation.number),
    );
    const numbering = new Map(
      originalCitations.map((citation, index) => [citation.number, index + 1]),
    );
    const content = originalCitations.length
      ? message.content
          .replace(/\s*\(?KDOC_[0-9a-f-]{36}\)?/gi, '')
          .replace(/\[(\d+)\]\(#source-\d+\)/g, (_, number: string) => {
            const label = numbering.get(Number(number)) ?? Number(number);
            return `[${label}](#source-${label})`;
          })
      : message.content;
    return {
      id: message.id,
      role: message.role,
      content: pseudonyms.rehydrate(content),
      sources: message.toolCalls.map((call) => ({
        tool: call.name,
        label: labelFor(call.name),
        args: call.args,
        ok: call.ok,
        error: call.error,
      })),
      patients: pseudonyms.mentioned(message.content),
      citations: originalCitations.map((citation, index) => ({
        ...citation,
        number: index + 1,
      })),
      unanswered: message.unanswered ?? false,
      isError: Boolean(message.error),
      createdAt: message.createdAt,
    };
  }
}

export class AssistantConversationSummaryDto {
  @ApiProperty({ enum: AssistantMode }) mode!: AssistantMode;
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ format: 'date-time' }) updatedAt!: Date;

  static from(
    conversation: AssistantConversation,
  ): AssistantConversationSummaryDto {
    const { id, title, mode, createdAt, updatedAt } = conversation;
    return { id, title, mode, createdAt, updatedAt };
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
