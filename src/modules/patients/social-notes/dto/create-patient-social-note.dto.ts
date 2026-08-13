import { IsEnum, IsNotEmpty, IsString, IsUUID } from 'class-validator';
import { SocialNoteType } from '../../../../database/entities/patient-social-note.entity';

export class CreatePatientSocialNoteDto {
  @IsUUID()
  followUpId!: string;

  @IsEnum(SocialNoteType)
  type!: SocialNoteType;

  @IsString()
  @IsNotEmpty()
  note!: string;
}
