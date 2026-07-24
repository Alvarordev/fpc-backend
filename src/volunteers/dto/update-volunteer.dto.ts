import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';
export class UpdateVolunteerDto {
  @IsOptional() @IsString() @MaxLength(255) firstName?: string;
  @IsOptional() @IsString() @MaxLength(255) lastName?: string;
  @IsOptional() @IsString() @MaxLength(255) specialty?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MaxLength(50) phone?: string;
}
