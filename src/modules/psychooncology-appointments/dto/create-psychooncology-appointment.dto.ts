import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
} from 'class-validator';
import {
  AppointmentBeneficiaryType,
  AppointmentModality,
} from '../../../database/entities/psychooncology-appointment.entity';

export class CreatePsychooncologyAppointmentDto {
  @IsUUID() patientId!: string;
  @ApiPropertyOptional({ enum: AppointmentBeneficiaryType })
  @IsOptional()
  @IsIn(Object.values(AppointmentBeneficiaryType))
  beneficiaryType?: AppointmentBeneficiaryType;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  companionId?: string | null;
  @IsUUID() availabilityId!: string;
  @IsOptional() @IsUUID() followUpId?: string;
  @IsOptional() @IsString() patientEmail?: string;
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  zoomLink?: string;
  @IsOptional() @IsBoolean() isAdditionalSession?: boolean;
  @IsIn(Object.values(AppointmentModality)) modality!: AppointmentModality;
  @IsOptional() @IsString() schedulingNotes?: string;
}
