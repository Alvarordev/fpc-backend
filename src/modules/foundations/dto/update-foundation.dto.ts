import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateFoundationDto {
  @IsOptional() @IsString() @MaxLength(255) firstName?: string;
  @IsOptional() @IsString() @MaxLength(255) lastName?: string;
  @IsOptional() @IsString() @MaxLength(50) phone?: string;
}
