import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateHealthCenterDto } from './create-health-center.dto';

export class UpdateHealthCenterDto extends PartialType(CreateHealthCenterDto) {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}
