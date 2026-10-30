import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import {
  SupportTicketStatus,
  SupportTicketType,
} from '../../../database/entities/support-ticket.entity';

export class ListSupportTicketsDto {
  @ApiPropertyOptional({ enum: SupportTicketStatus })
  @IsOptional()
  @IsIn(Object.values(SupportTicketStatus))
  status?: SupportTicketStatus;

  @ApiPropertyOptional({ enum: SupportTicketType })
  @IsOptional()
  @IsIn(Object.values(SupportTicketType))
  type?: SupportTicketType;
}
