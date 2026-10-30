import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { SupportTicketType } from '../../../database/entities/support-ticket.entity';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateSupportTicketDto {
  @ApiProperty({ enum: SupportTicketType })
  @IsIn(Object.values(SupportTicketType))
  type!: SupportTicketType;

  @ApiProperty({ maxLength: 160 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  title!: string;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(10_000)
  description!: string;

  @ApiPropertyOptional({ maxLength: 512 })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  pagePath?: string;
}
