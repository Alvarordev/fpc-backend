import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsUUID } from 'class-validator';
import { AppointmentStatus } from '../../../database/entities/psychooncology-appointment.entity';

export class FindPsychooncologyAppointmentsQueryDto {
  @IsOptional() @IsUUID() volunteerId?: string;
  @IsOptional() @IsUUID() patientId?: string;
  @IsOptional() @IsUUID() cycleId?: string;
  @IsOptional()
  @IsIn(Object.values(AppointmentStatus))
  status?: AppointmentStatus;
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  needsReassignment?: boolean;
}
