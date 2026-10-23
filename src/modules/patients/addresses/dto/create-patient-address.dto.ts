import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { DurationDto } from '../../../../shared/duration/duration.dto';
import { AddressType } from '../../../../database/entities/address-type.enum';
import { LodgingCostPeriod } from '../../../../database/entities/lodging-cost-period.enum';
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
  /** Catalog `location_share_status` code (or label). */
  @IsOptional() @IsString() @MaxLength(100) locationShareStatus?: string;
  @IsOptional() @IsString() locationShareStatusOther?: string;
  /** Catalog `temporary_housing_type` code (or label). */
  @IsOptional() @IsString() @MaxLength(100) housingType?: string;
  @IsOptional() @IsString() housingTypeOther?: string;
  @IsOptional() @IsString() @MaxLength(255) shelterName?: string;
  @ApiPropertyOptional({ type: DurationDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DurationDto)
  travelTimeToHospital?: DurationDto;
  /** Average spend in soles when renting lodging. */
  @IsOptional() @IsNumber() @Min(0) averageLodgingCost?: number;
  @ApiPropertyOptional({ enum: LodgingCostPeriod })
  @IsOptional()
  @IsIn(Object.values(LodgingCostPeriod))
  averageLodgingCostPeriod?: LodgingCostPeriod;
  @IsOptional() @IsBoolean() dniMatchesAddress?: boolean;
  @IsOptional() @IsDateString() validFrom?: string;
  @IsOptional() @IsDateString() validTo?: string;
}
