import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ChangeLogOperation } from '../../../../database/entities/change-log.entity';
import { AuditContextKind } from '../../../../shared/audit/audit-context';

export class ChangeLogEntryResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({
    format: 'uuid',
    description: 'Groups the changes saved together in one operation',
  })
  changeSetId!: string;
  @ApiProperty({ description: 'Table of the changed record' })
  entityType!: string;
  @ApiProperty({ format: 'uuid' }) entityId!: string;
  @ApiProperty({ enum: ChangeLogOperation }) operation!: ChangeLogOperation;
  @ApiPropertyOptional({
    nullable: true,
    description:
      'Changed column; null when the whole record was created or deleted',
  })
  field!: string | null;
  @ApiPropertyOptional({ nullable: true }) oldValue!: unknown;
  @ApiPropertyOptional({ nullable: true }) newValue!: unknown;
  @ApiProperty({ enum: AuditContextKind }) context!: AuditContextKind;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  followUpId!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  actorUserId!: string | null;
  @ApiPropertyOptional({ nullable: true }) actorEmail!: string | null;
  @ApiProperty({ format: 'date-time' }) changedAt!: Date;
}

export class ChangeLogPageResponseDto {
  @ApiProperty({ type: ChangeLogEntryResponseDto, isArray: true })
  items!: ChangeLogEntryResponseDto[];
  @ApiProperty() total!: number;
}
