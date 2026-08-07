import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn, IsString, MinLength } from 'class-validator';
import { UserRole } from '../../../database/entities/user-role.enum';

export class CreateUserDto {
  @ApiProperty({ example: 'agent@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'secure-password' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ enum: UserRole, example: UserRole.AGENT })
  @IsIn(Object.values(UserRole))
  role!: UserRole;
}
