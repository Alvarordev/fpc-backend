import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { AppointmentStatus } from '../../../database/entities/psychooncology-appointment.entity';

export class FindPsychooncologyAppointmentsQueryDto {
  @IsOptional() @IsUUID() volunteerId?: string;
  @IsOptional() @IsUUID() patientId?: string;
  @IsOptional()
  @IsIn(Object.values(AppointmentStatus))
  status?: AppointmentStatus;
}
