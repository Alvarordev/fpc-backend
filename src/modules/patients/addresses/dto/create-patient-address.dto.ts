import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { AddressType } from '../../../../database/entities/address-type.enum';
import { PERU_DEPARTMENTS } from '../../../../database/entities/health-center.entity';
import type { PeruDepartment } from '../../../../database/entities/health-center.entity';

export class CreatePatientAddressDto {
  @IsOptional() @IsUUID() followUpId?: string;
  @IsIn(Object.values(AddressType)) type!: AddressType;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() @MaxLength(255) district?: string;
  @IsOptional() @IsString() @MaxLength(255) province?: string;
  @ApiPropertyOptional({ enum: PERU_DEPARTMENTS })
  @IsOptional()
  @IsIn(PERU_DEPARTMENTS)
  department?: PeruDepartment;
  @IsOptional() @IsString() reference?: string;
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  locationUrl?: string;
  @IsOptional() @IsBoolean() dniMatchesAddress?: boolean;
  @IsOptional() @IsDateString() validFrom?: string;
  @IsOptional() @IsDateString() validTo?: string;
}
