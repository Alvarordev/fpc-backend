import { IsDateString, IsString } from 'class-validator';

export class CreateVolunteerAvailabilityDto {
  @IsDateString() date!: string;
  @IsString() startTime!: string;
  @IsString() endTime!: string;
}
