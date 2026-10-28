import { PartialType } from '@nestjs/swagger';
import { CreatePatientDto } from './create-patient.dto';

/** Datos personales de un acompañante (sin los del vínculo con el paciente). */
export class UpdateCompanionDto extends PartialType(CreatePatientDto) {}
