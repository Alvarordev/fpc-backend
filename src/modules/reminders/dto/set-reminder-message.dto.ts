import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SetReminderMessageDto {
  @ApiPropertyOptional({
    nullable: true,
    description:
      'Texto del correo del recordatorio. Vacío o null vuelve al texto sugerido.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  text?: string | null;
}
