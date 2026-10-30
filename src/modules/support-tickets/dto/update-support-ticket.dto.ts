import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { SupportTicketStatus } from '../../../database/entities/support-ticket.entity';

export class UpdateSupportTicketDto {
  @ApiProperty({ enum: SupportTicketStatus })
  @IsIn(Object.values(SupportTicketStatus))
  status!: SupportTicketStatus;
}
