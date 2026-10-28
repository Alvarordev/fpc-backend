import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ResolveAlertDto {
  @ApiProperty({ description: 'Procedure followed to resolve the alert' })
  @IsString()
  @IsNotEmpty()
  resolutionNotes!: string;
}
