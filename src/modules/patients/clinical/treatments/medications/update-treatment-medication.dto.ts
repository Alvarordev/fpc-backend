import { PartialType } from '@nestjs/swagger';
import { CreateTreatmentMedicationDto } from './create-treatment-medication.dto';

export class UpdateTreatmentMedicationDto extends PartialType(
  CreateTreatmentMedicationDto,
) {}
