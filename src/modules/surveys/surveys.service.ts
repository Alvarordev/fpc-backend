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
import { CreateSurveyDto } from './dto/create-survey.dto';
import { ListSurveysDto } from './dto/list-surveys.dto';
import { SurveyScriptQueryDto } from './dto/survey-script-query.dto';
import {
  PendingThreeMonthSurveyDto,
  SurveyScriptResponseDto,
} from './dto/survey-response.dto';
import { SurveyScriptVariant, surveyScript } from './survey-scripts';

const THREE_MONTHS_DAYS = 90;

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
}
