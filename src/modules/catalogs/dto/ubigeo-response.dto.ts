import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UbigeoDistrictResponseDto {
  @ApiProperty() ineiCode!: string;
  @ApiProperty() name!: string;
  @ApiProperty() sortOrder!: number;
  @ApiProperty() isActive!: boolean;
}

export class UbigeoProvinceResponseDto {
  @ApiProperty() ineiCode!: string;
  @ApiProperty() name!: string;
  @ApiProperty() sortOrder!: number;
  @ApiProperty() isActive!: boolean;
  @ApiPropertyOptional({ type: UbigeoDistrictResponseDto, isArray: true })
  districts?: UbigeoDistrictResponseDto[];
}

export class UbigeoDepartmentResponseDto {
  @ApiProperty() code!: string;
  @ApiProperty() ineiCode!: string;
  @ApiProperty() name!: string;
  @ApiProperty() sortOrder!: number;
  @ApiProperty() isActive!: boolean;
  @ApiProperty({ type: UbigeoProvinceResponseDto, isArray: true })
  provinces!: UbigeoProvinceResponseDto[];
}

export class UbigeoTreeResponseDto {
  @ApiProperty({ type: UbigeoDepartmentResponseDto, isArray: true })
  departments!: UbigeoDepartmentResponseDto[];
}
