import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class DeriveAlertDto {
  @ApiProperty({ description: 'Code from the alert_derivation_entity catalog' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  entityCode!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  notes!: string;
}
