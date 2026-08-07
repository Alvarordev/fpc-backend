import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import { AppointmentStatus } from '../../../database/entities/psychooncology-appointment.entity';

export class UpdatePsychooncologyAppointmentDto {
  @IsOptional()
  @IsIn(Object.values(AppointmentStatus))
  status?: AppointmentStatus;
  @IsOptional() @IsString() patientEmail?: string;
  @IsOptional() @IsBoolean() isAdditionalSession?: boolean;
  @IsOptional() @IsString() topicAddressed?: string;
  @IsOptional() @IsString() sessionDetails?: string;
  @IsOptional() @IsString() additionalObservations?: string;
  @IsOptional() @IsString() recommendations?: string;
  @IsOptional() @IsString() referral?: string;
}
