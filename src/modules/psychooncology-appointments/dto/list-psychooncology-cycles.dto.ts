import { IsUUID } from 'class-validator';

export class FindPsychooncologyCyclesQueryDto {
  @IsUUID() patientId!: string;
}
