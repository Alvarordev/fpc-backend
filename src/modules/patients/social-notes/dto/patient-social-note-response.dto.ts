import { ApiProperty } from '@nestjs/swagger';
import {
  PatientSocialNote,
  SocialNoteType,
} from '../../../../database/entities/patient-social-note.entity';

export class PatientSocialNoteResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  patientId!: string;

  @ApiProperty({ format: 'uuid' })
  followUpId!: string;

  @ApiProperty({ enum: SocialNoteType })
  type!: SocialNoteType;

  @ApiProperty()
  note!: string;

  @ApiProperty({ format: 'uuid' })
  authorId!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  static from(note: PatientSocialNote): PatientSocialNoteResponseDto {
    return {
      id: note.id,
      patientId: note.patientId,
      followUpId: note.followUpId,
      type: note.type,
      note: note.note,
      authorId: note.authorId,
      createdAt: note.createdAt.toISOString(),
    };
  }
}
