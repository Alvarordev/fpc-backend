import { ApiProperty } from '@nestjs/swagger';

export class VolunteerResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) userId!: string;
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
  @ApiProperty() specialty!: string;
  @ApiProperty({ format: 'email' }) email!: string;
  @ApiProperty() phone!: string;
  @ApiProperty({ format: 'date', nullable: true })
  birthDate!: string | null;
  @ApiProperty({ format: 'date', nullable: true })
  commitmentStartAt!: string | null;
  @ApiProperty({ format: 'date', nullable: true })
  commitmentEndAt!: string | null;
  @ApiProperty() hasVolunteerCertificate!: boolean;
  @ApiProperty({ nullable: true })
  additionalComments!: string | null;
  @ApiProperty() completedSustainabilityModule!: boolean;
  @ApiProperty() completedDesignThinkingModule!: boolean;
  @ApiProperty() isActive!: boolean;
  @ApiProperty() isAnonymous!: boolean;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ format: 'date-time' }) updatedAt!: Date;
}
