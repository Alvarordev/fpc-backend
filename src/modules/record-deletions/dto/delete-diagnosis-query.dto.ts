import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

const queryBoolean = ({ value }: { value: unknown }): unknown =>
  value === 'true' ? true : value === 'false' ? false : value;

export class DeleteDiagnosisQueryDto {
  @ApiPropertyOptional({
    description:
      'Also delete the treatments recorded under the diagnosis. Without it, a diagnosis with treatments is rejected with 409.',
    default: false,
  })
  @IsOptional()
  @Transform(queryBoolean)
  @IsBoolean()
  withTreatments?: boolean;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'A retired diagnosis of the same patient to make active again, e.g. the one a mistaken REPLACE retired.',
  })
  @IsOptional()
  @IsUUID()
  restoreDiagnosisId?: string;
}
