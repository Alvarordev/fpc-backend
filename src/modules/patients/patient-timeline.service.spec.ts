import { DataSource } from 'typeorm';
import { User } from '../../database/entities/user.entity';
import { PatientAccessService } from './access/patient-access.service';
import {
  PatientTimelineEventKind,
  PatientTimelineOutcomeType,
} from './dto/patient-timeline.dto';
import { PatientTimelineService } from './patient-timeline.service';

describe('PatientTimelineService outcomes', () => {
  const query = jest.fn();
  const dataSource = { query } as unknown as DataSource;
  const assertCanRead = jest.fn();
  const access = {
    assertCanRead,
  } as unknown as PatientAccessService;
  const service = new PatientTimelineService(dataSource, access);
  const user = { id: 'user-id' } as User;
  const followUpRow = {
    id: 'follow-up-id',
    kind: PatientTimelineEventKind.FOLLOW_UP,
    occurred_at: '2026-08-13T12:00:00.000Z',
    status: 'COMPLETED',
    follow_up_id: 'follow-up-id',
    type: 'CALL',
    purpose: 'FOLLOW_UP',
    notes: 'Seguimiento realizado',
    description: null,
    modality: null,
    session_number: null,
    social_note_type: null,
    social_note: null,
    author_id: null,
  };
  const reminderEventRow = {
    ...followUpRow,
    id: 'reminder-event-id',
    kind: PatientTimelineEventKind.REMINDER,
    occurred_at: '2026-08-14T12:00:00.000Z',
    status: 'PENDING',
    follow_up_id: 'follow-up-id',
    type: null,
    purpose: null,
    notes: null,
    description: 'Llamar al paciente',
  };

  beforeEach(() => {
    jest.resetAllMocks();
    assertCanRead.mockResolvedValue(undefined);
  });

  it('adds one Spanish, identifiable outcome per linked record without changing event kinds', async () => {
    const outcomeRows = [
      outcome(PatientTimelineOutcomeType.DIAGNOSIS, 'diagnosis-id', {
        diagnosis: 'Linfoma',
        cancerStage: 'STAGE_2',
        diagnosisDate: '2026-08-01',
        hasMedicalReport: true,
        isCurrent: true,
      }),
      outcome(PatientTimelineOutcomeType.TREATMENT, 'treatment-id', {
        treatmentType: 'Quimioterapia',
        treatmentSituation: 'EN_CURSO',
        startDate: '2026-08-02',
        hasLatestPrescription: false,
        careProgram: 'COPHOES',
        receivesTeleconsultation: true,
        teleconsultationSpecialties: ['Oncología', 'Psicooncología'],
        isCurrent: true,
      }),
      outcome(PatientTimelineOutcomeType.MEDICATION, 'medication-id', {
        name: 'Capecitabina',
        doseAmount: '500',
        doseUnit: 'MG',
        route: 'ORAL',
        frequencyLabel: 'Cada 12 horas',
        isActive: true,
      }),
      outcome(PatientTimelineOutcomeType.SYMPTOM, 'symptom-id', {
        signsAndSymptoms: 'Náuseas',
        discomfortSeverity: 'moderada',
        isPainPresent: false,
        hasSoughtMedicalConsultation: true,
      }),
      outcome(PatientTimelineOutcomeType.INSURANCE, 'insurance-id', {
        insuranceType: 'SIS',
        isCurrent: true,
      }),
      outcome(PatientTimelineOutcomeType.SIS_AFFILIATION, 'sis-id', {
        canAffiliate: false,
        cantAffiliateReason: 'Falta documento',
      }),
      outcome(PatientTimelineOutcomeType.ADDRESS, 'address-id', {
        type: 'PERMANENT',
        isPrimary: true,
        address: 'Av. Siempre Viva 123',
        isActive: true,
      }),
      outcome(PatientTimelineOutcomeType.SOCIAL_NOTE, 'social-note-id', {
        type: 'SOCIAL_WORKER',
        note: 'Se coordinó apoyo social.',
      }),
      outcome(PatientTimelineOutcomeType.REMINDER, 'reminder-id', {
        status: 'PENDING',
        description: 'Llamar para confirmar cita',
        dueAt: '2026-08-15T15:00:00.000Z',
      }),
      outcome(
        PatientTimelineOutcomeType.PSYCHOONCOLOGY_APPOINTMENT,
        'appointment-id',
        {
          status: 'SCHEDULED',
          modality: 'VIDEO_CALL',
          sessionNumber: 1,
          scheduledAt: '2026-08-16T15:00:00.000Z',
        },
      ),
      outcome(PatientTimelineOutcomeType.ALERT, 'alert-id', {
        title: 'Falta de medicamento',
        description: 'Gestionar abastecimiento',
        status: 'ACTIVE',
        severity: 'HIGH',
        category: 'MEDICATION_SHORTAGE',
        underReview: true,
      }),
    ];
    query
      .mockResolvedValueOnce([followUpRow, reminderEventRow])
      .mockResolvedValueOnce([{ total: 2 }])
      .mockResolvedValueOnce(outcomeRows);

    const response = await service.get(
      'patient-id',
      { limit: 50, offset: 0 },
      user,
    );

    expect(query).toHaveBeenCalledTimes(3);
    expect(query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('ANY($1::uuid[])'),
      [['follow-up-id']],
    );
    const followUp = response.data.find(
      (event) => event.kind === PatientTimelineEventKind.FOLLOW_UP,
    );
    if (!followUp || followUp.kind !== PatientTimelineEventKind.FOLLOW_UP)
      throw new Error('Expected a FOLLOW_UP event');
    expect(followUp.outcomes).toHaveLength(outcomeRows.length);
    expect(
      followUp.outcomes.map(({ type, recordId }) => ({ type, recordId })),
    ).toEqual(
      outcomeRows.map(({ outcome_type, record_id }) => ({
        type: outcome_type,
        recordId: record_id,
      })),
    );
    expect(followUp.outcomes.every((item) => item.label && item.summary)).toBe(
      true,
    );
    expect(
      followUp.outcomes.find(
        (item) => item.type === PatientTimelineOutcomeType.TREATMENT,
      )?.summary,
    ).toContain('Especialidades de teleconsulta: Oncología, Psicooncología');
    expect(followUp.outcomes.map((item) => item.label)).toEqual([
      'Diagnóstico',
      'Tratamiento',
      'Medicamento',
      'Síntomas',
      'Seguro de salud',
      'Afiliación SIS',
      'Dirección',
      'Nota social',
      'Recordatorio',
      'Cita de psicooncología',
      'Alerta',
    ]);
    expect(
      response.data.find(
        (event) => event.kind === PatientTimelineEventKind.REMINDER,
      ),
    ).not.toHaveProperty('outcomes');
  });

  it('returns an empty outcomes array when no records are linked', async () => {
    query
      .mockResolvedValueOnce([followUpRow])
      .mockResolvedValueOnce([{ total: 1 }])
      .mockResolvedValueOnce([]);

    const response = await service.get(
      'patient-id',
      { limit: 50, offset: 0 },
      user,
    );

    expect(response.data).toEqual([
      expect.objectContaining({
        kind: PatientTimelineEventKind.FOLLOW_UP,
        outcomes: [],
      }),
    ]);
    expect(query).toHaveBeenCalledTimes(3);
  });
});

function outcome(
  outcomeType: PatientTimelineOutcomeType,
  recordId: string,
  data: Record<string, unknown>,
) {
  return {
    follow_up_id: 'follow-up-id',
    outcome_type: outcomeType,
    record_id: recordId,
    occurred_at: '2026-08-13T12:00:00.000Z',
    data,
  };
}
