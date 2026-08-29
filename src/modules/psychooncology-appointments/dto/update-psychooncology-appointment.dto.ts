import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import {
  AppointmentModality,
  AppointmentStatus,
} from '../../../database/entities/psychooncology-appointment.entity';

export class UpdatePsychooncologyAppointmentDto {
  @IsOptional()
  @IsIn(Object.values(AppointmentStatus))
  status?: AppointmentStatus;
  @IsOptional() @IsUUID() availabilityId?: string;
  @IsOptional()
  @IsIn(Object.values(AppointmentModality))
  modality?: AppointmentModality;
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  zoomLink?: string | null;
  @IsOptional() @IsString() patientEmail?: string;
  @IsOptional() @IsString() schedulingNotes?: string | null;
  @IsOptional() @IsString() noAnswerNote?: string | null;
  @IsOptional() @IsInt() @Min(1) @Max(5) satisfactionRating?: number | null;
  @IsOptional() @IsString() satisfactionComment?: string | null;
  @IsOptional() @IsString() topicAddressed?: string;
  @IsOptional() @IsString() sessionDetails?: string;
  @IsOptional() @IsString() additionalObservations?: string;
  @IsOptional() @IsString() recommendations?: string;
  @IsOptional() @IsString() referral?: string;
}
