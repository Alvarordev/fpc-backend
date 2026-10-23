import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateHistoricalPsychooncologyAppointmentDto } from './create-historical-psychooncology-appointment.dto';

export class UpdateHistoricalPsychooncologyAppointmentDto extends PartialType(
  OmitType(CreateHistoricalPsychooncologyAppointmentDto, [
    'patientId',
  ] as const),
) {}
