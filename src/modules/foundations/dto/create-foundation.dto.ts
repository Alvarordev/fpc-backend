import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateFoundationDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(8) password!: string;
  @IsString() @MaxLength(255) firstName!: string;
  @IsString() @MaxLength(255) lastName!: string;
  @IsString() @MaxLength(50) phone!: string;
}
