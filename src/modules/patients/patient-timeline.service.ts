import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { User } from '../../database/entities/user.entity';
import { PatientAccessService } from './access/patient-access.service';
import {
  FollowUpTimelineEventDto,
  PatientTimelineEventDto,
  PatientTimelineEventKind,
  PatientTimelineQueryDto,
  PatientTimelineResponseDto,
  PsychooncologyAppointmentTimelineEventDto,
  ReminderTimelineEventDto,
  SocialNoteTimelineEventDto,
} from './dto/patient-timeline.dto';

type TimelineRow = {
  id: string;
  kind: PatientTimelineEventKind;
  occurred_at: Date | string;
  status: string | null;
  follow_up_id: string | null;
  type: string | null;
  purpose: string | null;
  notes: string | null;
  description: string | null;
  modality: string | null;
  session_number: number | null;
  social_note_type: string | null;
  social_note: string | null;
  author_id: string | null;
};

@Injectable()
export class PatientTimelineService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly access: PatientAccessService,
  ) {}

  async get(
    patientId: string,
    query: PatientTimelineQueryDto,
    user: User,
  ): Promise<PatientTimelineResponseDto> {
    await this.access.assertCanRead(patientId, user);

    const projection = this.projectionSql();
    const [rows, totals] = await Promise.all([
      this.dataSource.query<TimelineRow[]>(
        `${projection}
         ORDER BY occurred_at DESC, kind ASC, id DESC
         LIMIT $2 OFFSET $3`,
        [patientId, query.limit, query.offset],
      ),
      this.dataSource.query<Array<{ total: number }>>(
        `SELECT COUNT(*)::int AS total FROM (${projection}) timeline_count`,
        [patientId],
      ),
    ]);

    return {
      data: rows.map((row) => this.toEvent(row)),
      total: totals[0]?.total ?? 0,
    };
  }

  private projectionSql(): string {
    return `
      SELECT
        follow_up.id,
        'FOLLOW_UP'::text AS kind,
        COALESCE(
          follow_up.completed_at,
          follow_up.scheduled_at,
          follow_up.created_at
        ) AS occurred_at,
        follow_up.status,
        follow_up.id AS follow_up_id,
        follow_up.type,
        follow_up.purpose,
        follow_up.notes,
        NULL::text AS description,
        NULL::varchar AS modality,
        NULL::int AS session_number,
        NULL::varchar AS social_note_type,
        NULL::text AS social_note,
        NULL::uuid AS author_id
      FROM follow_ups follow_up
      WHERE follow_up.subject_patient_id = $1

      UNION ALL

      SELECT
        reminder.id,
        'REMINDER'::text AS kind,
        reminder.due_at AS occurred_at,
        reminder.status,
        reminder.created_from_follow_up_id AS follow_up_id,
        NULL::varchar AS type,
        NULL::varchar AS purpose,
        NULL::text AS notes,
        reminder.description,
        NULL::varchar AS modality,
        NULL::int AS session_number,
        NULL::varchar AS social_note_type,
        NULL::text AS social_note,
        NULL::uuid AS author_id
      FROM reminders reminder
      WHERE reminder.subject_patient_id = $1

      UNION ALL

      SELECT
        appointment.id,
        'PSYCHOONCOLOGY_APPOINTMENT'::text AS kind,
        appointment.scheduled_at AS occurred_at,
        appointment.status,
        appointment.follow_up_id,
        NULL::varchar AS type,
        NULL::varchar AS purpose,
        NULL::text AS notes,
        NULL::text AS description,
        appointment.modality,
        appointment.session_number,
        NULL::varchar AS social_note_type,
        NULL::text AS social_note,
        NULL::uuid AS author_id
      FROM psychooncology_appointments appointment
      WHERE appointment.patient_id = $1

      UNION ALL

      SELECT
        social_note.id,
        'SOCIAL_NOTE'::text AS kind,
        social_note.created_at AS occurred_at,
        NULL::varchar AS status,
        social_note.follow_up_id,
        NULL::varchar AS type,
        NULL::varchar AS purpose,
        NULL::text AS notes,
        NULL::text AS description,
        NULL::varchar AS modality,
        NULL::int AS session_number,
        social_note.type AS social_note_type,
        social_note.note AS social_note,
        social_note.author_id
      FROM patient_social_notes social_note
      WHERE social_note.patient_id = $1

    `;
  }

  private toEvent(row: TimelineRow): PatientTimelineEventDto {
    if (row.kind === PatientTimelineEventKind.SOCIAL_NOTE)
      return {
        id: row.id,
        kind: row.kind,
        occurredAt: new Date(row.occurred_at).toISOString(),
        followUpId: row.follow_up_id!,
        type: row.social_note_type!,
        note: row.social_note!,
        authorId: row.author_id!,
      } as SocialNoteTimelineEventDto;

    const common = {
      id: row.id,
      occurredAt: new Date(row.occurred_at).toISOString(),
      status: row.status,
      followUpId: row.follow_up_id,
    };

    if (row.kind === PatientTimelineEventKind.FOLLOW_UP)
      return {
        ...common,
        kind: row.kind,
        followUpId: row.follow_up_id,
        type: row.type,
        purpose: row.purpose,
        notes: row.notes,
      } as FollowUpTimelineEventDto;

    if (row.kind === PatientTimelineEventKind.REMINDER)
      return {
        ...common,
        kind: row.kind,
        description: row.description,
      } as ReminderTimelineEventDto;

    if (row.kind === PatientTimelineEventKind.PSYCHOONCOLOGY_APPOINTMENT)
      return {
        ...common,
        kind: row.kind,
        followUpId: row.follow_up_id,
        modality: row.modality,
        sessionNumber: row.session_number,
      } as PsychooncologyAppointmentTimelineEventDto;

    throw new Error(`Unsupported patient timeline event kind: ${row.kind}`);
  }
}
