import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, Repository } from 'typeorm';
import { Survey, SurveyType } from '../../database/entities/survey.entity';
import { Patient } from '../../database/entities/patient.entity';
import { PatientRole } from '../../database/entities/patient-role.enum';
import { FollowUp } from '../../database/entities/follow-up.entity';
import { PsychooncologyAppointment } from '../../database/entities/psychooncology-appointment.entity';
import { PatientDetails } from '../../database/entities/patient-details.entity';
import { PatientHealthPhase } from '../../database/entities/patient-health-phase.enum';
import { User } from '../../database/entities/user.entity';
import { UserRole } from '../../database/entities/user-role.enum';
import { Agent } from '../../database/entities/agent.entity';
import { CreateSurveyDto } from './dto/create-survey.dto';
import { ListSurveysDto } from './dto/list-surveys.dto';
import { SurveyScriptQueryDto } from './dto/survey-script-query.dto';
import {
  PendingSurveyDto,
  PendingThreeMonthSurveyDto,
  SurveyScriptResponseDto,
} from './dto/survey-response.dto';
import { SurveyScriptVariant, surveyScript } from './survey-scripts';

const THREE_MONTHS_DAYS = 90;
const PSYCHOONCOLOGY_SESSIONS = 4;

@Injectable()
export class SurveysService {
  constructor(
    @InjectRepository(Survey) private readonly surveys: Repository<Survey>,
    private readonly dataSource: DataSource,
  ) {}

  async create(input: CreateSurveyDto, user: User): Promise<Survey> {
    return this.dataSource.transaction(async (manager) => {
      const patient = await manager
        .getRepository(Patient)
        .findOne({ where: { id: input.patientId } });
      if (!patient || patient.role !== PatientRole.PATIENT)
        throw new NotFoundException('No se encontró el paciente.');
      if (
        input.followUpId &&
        !(await manager.getRepository(FollowUp).existsBy({
          id: input.followUpId,
          subjectPatientId: input.patientId,
        }))
      )
        throw new NotFoundException('No se encontró el seguimiento.');
      if (input.psychooncologyAppointmentId) {
        if (input.type !== SurveyType.PSYCHOONCOLOGY)
          throw new BadRequestException(
            'La sesión solo se vincula a encuestas de psicooncología.',
          );
        if (
          !(await manager.getRepository(PsychooncologyAppointment).existsBy({
            id: input.psychooncologyAppointmentId,
            patientId: input.patientId,
          }))
        )
          throw new NotFoundException('No se encontró la cita de psicooncología.');
        if (
          await manager.getRepository(Survey).existsBy({
            psychooncologyAppointmentId: input.psychooncologyAppointmentId,
          })
        )
          throw new BadRequestException(
            'Esta sesión de psicooncología ya tiene encuesta.',
          );
      }
      const repository = manager.getRepository(Survey);
      return repository.save(
        repository.create({
          patientId: input.patientId,
          type: input.type,
          rating: input.rating,
          comment: input.comment?.trim() || null,
          channel: input.channel,
          answeredAt: input.answeredAt
            ? new Date(input.answeredAt)
            : new Date(),
          followUpId: input.followUpId ?? null,
          psychooncologyAppointmentId:
            input.psychooncologyAppointmentId ?? null,
          actorUserId: user.id,
        }),
      );
    });
  }

  findAll(filters: ListSurveysDto, onlyType?: SurveyType): Promise<Survey[]> {
    if (onlyType && filters.type && filters.type !== onlyType)
      return Promise.resolve([]);
    const where: FindOptionsWhere<Survey> = {};
    if (filters.patientId) where.patientId = filters.patientId;
    if (filters.type ?? onlyType) where.type = (filters.type ?? onlyType)!;
    if (filters.psychooncologyAppointmentId)
      where.psychooncologyAppointmentId = filters.psychooncologyAppointmentId;
    return this.surveys.find({
      where,
      order: { answeredAt: 'DESC' },
      take: 500,
    });
  }

  async script(query: SurveyScriptQueryDto): Promise<SurveyScriptResponseDto> {
    let name = '';
    let variant = query.variant ?? null;
    if (query.patientId) {
      const patient = await this.dataSource
        .getRepository(Patient)
        .findOne({ where: { id: query.patientId } });
      if (!patient) throw new NotFoundException('No se encontró el paciente.');
      name = patient.fullName.split(' ')[0] ?? '';
      if (!variant && query.type === SurveyType.ENROLLMENT) {
        const details = await this.dataSource
          .getRepository(PatientDetails)
          .findOne({ where: { patientId: query.patientId } });
        variant =
          details?.healthPhase === PatientHealthPhase.SIGNS_AND_SYMPTOMS
            ? SurveyScriptVariant.SIGNS_AND_SYMPTOMS
            : SurveyScriptVariant.DIAGNOSED;
      }
    }
    if (query.type !== SurveyType.ENROLLMENT) variant = null;
    else variant ??= SurveyScriptVariant.DIAGNOSED;
    return {
      type: query.type,
      variant,
      text: surveyScript(
        query.type,
        variant ?? SurveyScriptVariant.DIAGNOSED,
        name,
      ),
    };
  }

  /** Active patients enrolled 90+ days ago without a THREE_MONTHS survey. */
  async pendingThreeMonths(): Promise<PendingThreeMonthSurveyDto[]> {
    const rows = await this.dataSource.query<
      {
        patient_id: string;
        full_name: string;
        dni: string | null;
        primary_phone: string | null;
        enrolled_on: string;
        days: number;
      }[]
    >(
      `
      WITH first_enrollment AS (
        SELECT patient_id,
          MIN(COALESCE(enrolled_on, (created_at AT TIME ZONE 'America/Lima')::date)) AS enrolled_on
        FROM enrollments
        GROUP BY patient_id
      )
      SELECT patient.id AS patient_id, patient.full_name, patient.dni,
        patient.primary_phone, first_enrollment.enrolled_on::text AS enrolled_on,
        ((now() AT TIME ZONE 'America/Lima')::date - first_enrollment.enrolled_on)::int AS days
      FROM patients patient
      JOIN first_enrollment ON first_enrollment.patient_id = patient.id
      WHERE patient.role = 'PATIENT'
        AND patient.activity_status IN ('ACTIVE', 'REACTIVE')
        AND first_enrollment.enrolled_on <= (now() AT TIME ZONE 'America/Lima')::date - $1::int
        AND NOT EXISTS (
          SELECT 1 FROM surveys survey
          WHERE survey.patient_id = patient.id AND survey.type = 'THREE_MONTHS'
        )
      ORDER BY first_enrollment.enrolled_on ASC, patient.full_name ASC
      `,
      [THREE_MONTHS_DAYS],
    );
    return rows.map((row) => ({
      patientId: row.patient_id,
      fullName: row.full_name,
      documentNumber: row.dni,
      primaryPhone: row.primary_phone,
      enrolledOn: row.enrolled_on,
      daysSinceEnrollment: Number(row.days),
    }));
  }

  /** Patients pending a survey of `type`, oldest trigger first. */
  async pending(type: SurveyType, user: User): Promise<PendingSurveyDto[]> {
    type Row = {
      patient_id: string;
      full_name: string;
      dni: string | null;
      primary_phone: string | null;
      since: string | null;
      detail: string;
    };
    const noSurvey = (alias: string) => `
      NOT EXISTS (
        SELECT 1 FROM surveys survey
        WHERE survey.patient_id = ${alias}.id AND survey.type = '${type}'
      )`;
    let sql: string;
    let params: unknown[] = [];

    if (type === SurveyType.ENROLLMENT) {
      let agentId: string | null = null;
      if (user.role === UserRole.AGENT) {
        const agent = await this.dataSource
          .getRepository(Agent)
          .findOne({ where: { userId: user.id } });
        if (!agent) return [];
        agentId = agent.id;
      }
      params = [agentId];
      sql = `
        SELECT DISTINCT ON (patient.id)
          patient.id AS patient_id, patient.full_name, patient.dni, patient.primary_phone,
          enrollment.enrolled_on::text AS since,
          'Enrolado el ' || to_char(enrollment.enrolled_on, 'DD/MM/YYYY') AS detail
        FROM enrollments enrollment
        JOIN follow_ups follow_up ON follow_up.id = enrollment.follow_up_id
        JOIN patients patient ON patient.id = enrollment.patient_id
        WHERE patient.role = 'PATIENT'
          AND enrollment.is_historical = false
          AND enrollment.follow_up_quality_rating IS NULL
          AND ($1::uuid IS NULL OR follow_up.agent_id = $1::uuid)
          AND ${noSurvey('patient')}
        ORDER BY patient.id, enrollment.enrolled_on DESC`;
    } else if (type === SurveyType.THREE_MONTHS) {
      return (await this.pendingThreeMonths()).map((item) => ({
        patientId: item.patientId,
        fullName: item.fullName,
        documentNumber: item.documentNumber,
        primaryPhone: item.primaryPhone,
        since: item.enrolledOn,
        detail: `${item.daysSinceEnrollment} días en el programa`,
      }));
    } else if (type === SurveyType.PSYCHOONCOLOGY) {
      params = [PSYCHOONCOLOGY_SESSIONS];
      sql = `
        WITH sessions AS (
          SELECT patient_id,
            COUNT(*)::int AS total,
            (ARRAY_AGG(COALESCE(completed_on, (completed_at AT TIME ZONE 'America/Lima')::date, scheduled_on)
              ORDER BY COALESCE(completed_at, scheduled_at) ASC NULLS LAST))[$1::int] AS reached_on
          FROM psychooncology_appointments
          WHERE status = 'COMPLETED'
          GROUP BY patient_id
        )
        SELECT patient.id AS patient_id, patient.full_name, patient.dni, patient.primary_phone,
          sessions.reached_on::text AS since,
          sessions.total || ' sesiones completadas' AS detail
        FROM patients patient
        JOIN sessions ON sessions.patient_id = patient.id
        WHERE patient.role = 'PATIENT'
          AND sessions.total >= $1::int
          AND ${noSurvey('patient')}`;
    } else {
      sql = `
        SELECT patient.id AS patient_id, patient.full_name, patient.dni, patient.primary_phone,
          details.attended_educational_talk_at::text AS since,
          'Asistió a una charla de FPC' AS detail
        FROM patients patient
        JOIN patient_details details ON details.patient_id = patient.id
        WHERE patient.role = 'PATIENT'
          AND details.attended_educational_talk = true
          AND ${noSurvey('patient')}`;
    }

    const rows = await this.dataSource.query<Row[]>(
      `SELECT * FROM (${sql}) pending ORDER BY since ASC NULLS LAST, full_name ASC`,
      params,
    );
    return rows.map((row) => ({
      patientId: row.patient_id,
      fullName: row.full_name,
      documentNumber: row.dni,
      primaryPhone: row.primary_phone,
      since: row.since,
      detail: row.detail,
    }));
  }
}
