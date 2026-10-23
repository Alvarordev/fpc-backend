import { PartialType } from '@nestjs/swagger';
import { CreatePatientAddressDto } from './create-patient-address.dto';

export class UpdatePatientAddressDto extends PartialType(
  CreatePatientAddressDto,
) {}
