import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateAgentDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(8) password!: string;
  @IsString() @MaxLength(255) fullName!: string;
  @IsString() @MaxLength(50) phone!: string;
}
