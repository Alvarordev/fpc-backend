import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
export class CreateVolunteerDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(8) password!: string;
  @IsString() @MaxLength(255) firstName!: string;
  @IsString() @MaxLength(255) lastName!: string;
  @IsString() @MaxLength(255) specialty!: string;
  @IsString() @MaxLength(50) phone!: string;
}
