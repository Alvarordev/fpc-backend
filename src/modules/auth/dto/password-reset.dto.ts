import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'agente@fpc.org.pe' })
  @IsEmail()
  email!: string;
}

export class VerifyPasswordResetDto {
  @ApiProperty({ description: 'Token recibido en el enlace del correo' })
  @IsString()
  @MinLength(20)
  @MaxLength(200)
  token!: string;
}

export class ResetPasswordDto extends VerifyPasswordResetDto {
  @ApiProperty({ example: 'nueva-contraseña-segura' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
