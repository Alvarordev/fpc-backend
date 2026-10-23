import { ApiProperty } from '@nestjs/swagger';
import { AddressType } from '../../../../database/entities/address-type.enum';
import { PatientAddress } from '../../../../database/entities/patient-address.entity';

export class PatientAddressResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) patientId!: string;
  @ApiProperty({ format: 'uuid', nullable: true }) followUpId!: string | null;
  @ApiProperty({ enum: AddressType }) type!: AddressType;
  @ApiProperty() isPrimary!: boolean;
  @ApiProperty({ nullable: true }) address!: string | null;
  @ApiProperty({ nullable: true }) district!: string | null;
  @ApiProperty({ nullable: true }) province!: string | null;
  @ApiProperty({ nullable: true }) department!: string | null;
  @ApiProperty({ nullable: true }) reference!: string | null;
  @ApiProperty({ nullable: true, format: 'uri' }) locationUrl!: string | null;
  @ApiProperty({ nullable: true }) dniMatchesAddress!: boolean | null;
  @ApiProperty({ format: 'date', nullable: true }) validFrom!: string | null;
  @ApiProperty({ format: 'date', nullable: true }) validTo!: string | null;
  @ApiProperty() isActive!: boolean;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;

  static from(address: PatientAddress): PatientAddressResponseDto {
    return {
      id: address.id,
      patientId: address.patientId,
      followUpId: address.followUpId,
      type: address.type,
      isPrimary: address.isPrimary,
      address: address.address,
      district: address.district,
      province: address.province,
      department: address.department,
      reference: address.reference,
      locationUrl: address.locationUrl,
      dniMatchesAddress: address.dniMatchesAddress,
      validFrom: address.validFrom,
      validTo: address.validTo,
      isActive: address.isActive,
      createdAt: address.createdAt.toISOString(),
    };
  }
}
