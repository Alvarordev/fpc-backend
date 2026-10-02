import { EntityManager } from 'typeorm';
import { MedicalAppointmentStatus } from '../../database/entities/medical-appointment-status.enum';
import { MedicalConsultationStatus } from '../../database/entities/medical-consultation-status.enum';
import { PatientDiagnosticStatus } from '../../database/entities/patient-diagnostic-status.enum';
import { PatientDiagnosticStatusEvent } from '../../database/entities/patient-diagnostic-status-event.entity';
import { FollowUp } from '../../database/entities/follow-up.entity';
import { PatientMedicalAppointment } from '../../database/entities/patient-medical-appointment.entity';
import { Reminder } from '../../database/entities/reminder.entity';
import { ReminderKind } from '../../database/entities/reminder-kind.enum';
import { CatalogValueService } from '../catalogs/catalog-value.service';
import { PatientDiagnosesService } from './clinical/diagnoses/patient-diagnoses.service';
import { PatientMedicalAppointmentsService } from './clinical/medical-appointments/patient-medical-appointments.service';
import { PatientNonOncologicalFollowUpsService } from './clinical/non-oncological-follow-up/patient-non-oncological-follow-ups.service';
import { PatientTreatmentsService } from './clinical/treatments/patient-treatments.service';
import { ClinicalOwnershipService } from './clinical-ownership.service';

describe('ClinicalOwnershipService', () => {
  function buildService(tryResolve: CatalogValueService['tryResolve']) {
    const appointments = {
      create: jest.fn().mockResolvedValue({ id: 'appointment-id' }),
    };
    const diagnoses = {
      create: jest.fn().mockResolvedValue({ id: 'diagnosis-id' }),
    };
    const treatments = { create: jest.fn().mockResolvedValue({ id: 'tx-id' }) };
    const nonOncological = {
      create: jest.fn().mockResolvedValue({ id: 'non-onc-id' }),
    };
    const events = {
      create: jest.fn((value: unknown) => value),
      save: jest.fn((value: unknown) =>
        Promise.resolve({ ...(value as object), id: 'event-id' }),
      ),
    };
    const manager = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === PatientDiagnosticStatusEvent) return events;
        return {};
      }),
    } as unknown as EntityManager;
    const service = new ClinicalOwnershipService(
      { tryResolve } as unknown as CatalogValueService,
      appointments as unknown as PatientMedicalAppointmentsService,
      diagnoses as unknown as PatientDiagnosesService,
      treatments as unknown as PatientTreatmentsService,
      nonOncological as unknown as PatientNonOncologicalFollowUpsService,
    );
    return {
      service,
      appointments,
      diagnoses,
      treatments,
      nonOncological,
      events,
      manager,
    };
  }

  it('fans out an attended consultation and oncological diagnosis to owner entities', async () => {
    const { service, appointments, diagnoses, treatments, manager } =
      buildService(async (kind, value) => {
        if (kind === 'cancer_diagnosis')
          return { code: 'MAMA_DUCTAL', label: 'Cáncer de mama', other: null };
        if (kind === 'treatment_type' && value)
          return { code: 'QUIMIOTERAPIA', label: 'Quimioterapia', other: null };
        return null;
      });

    await service.fanOutFromSymptomReport(
      'patient-id',
      'follow-up-id',
      'enrollment-id',
      {
        followUpId: 'follow-up-id',
        hasMedicalConsultation: true,
        specialty: 'Oncología',
        healthCenterId: 'center-id',
        firstConsultationDate: '2026-01-15',
        hasReceivedDiagnosis: true,
        reportedDiagnosis: 'Cáncer de mama',
        isReceivingReportedTreatment: true,
        reportedTreatment: 'Quimioterapia',
      },
      manager,
    );

    expect(appointments.create).toHaveBeenCalledWith(
      'patient-id',
      expect.objectContaining({
        specialty: 'Oncología',
        healthCenterId: 'center-id',
        appointmentDate: '2026-01-15',
        status: MedicalAppointmentStatus.COMPLETED,
        isFirstConsultation: true,
      }),
      manager,
      false,
    );
    expect(diagnoses.create).toHaveBeenCalledWith(
      'patient-id',
      expect.objectContaining({
        diagnosis: 'MAMA_DUCTAL',
        followUpId: 'follow-up-id',
      }),
      manager,
    );
    expect(treatments.create).toHaveBeenCalledWith(
      'patient-id',
      expect.objectContaining({
        diagnosisId: 'diagnosis-id',
        treatmentType: 'QUIMIOTERAPIA',
      }),
      manager,
    );
  });

  it('creates a ruled-out event and non-oncological follow-up for other diagnoses', async () => {
    const { service, diagnoses, nonOncological, events, manager } =
      buildService(async () => null);

    await service.fanOutFromSymptomReport(
      'patient-id',
      'follow-up-id',
      'enrollment-id',
      {
        followUpId: 'follow-up-id',
        hasReceivedDiagnosis: true,
        reportedDiagnosis: 'Hipertensión',
        isReceivingReportedTreatment: false,
      },
      manager,
    );

    expect(diagnoses.create).not.toHaveBeenCalled();
    expect(events.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: PatientDiagnosticStatus.RULED_OUT,
        reportedDiagnosis: 'Hipertensión',
      }),
    );
    expect(nonOncological.create).toHaveBeenCalledWith(
      'patient-id',
      expect.objectContaining({
        diagnosis: 'Hipertensión',
        diagnosticStatusEventId: 'event-id',
      }),
      manager,
    );
  });

  it('does not require client medicalAppointments to derive a scheduled visit', async () => {
    const { service, appointments, manager } = buildService(async () => null);

    await service.fanOutFromSymptomReport(
      'patient-id',
      'follow-up-id',
      null,
      {
        followUpId: 'follow-up-id',
        consultationStatus: MedicalConsultationStatus.SCHEDULED,
        specialty: 'MEDICINA_GENERAL',
        healthCenterId: 'center-id',
      },
      manager,
    );

    expect(appointments.create).toHaveBeenCalledWith(
      'patient-id',
      expect.objectContaining({
        status: MedicalAppointmentStatus.SCHEDULED,
        isFirstConsultation: false,
      }),
      manager,
      true,
    );
  });

  it('creates a scheduled appointment and reminder for the next consultation', async () => {
    const followUps = {
      findOneBy: jest.fn().mockResolvedValue({
        id: 'follow-up-id',
        agentId: 'agent-id',
      }),
    };
    const reminders = {
      create: jest.fn((value: unknown) => value),
      save: jest.fn((value: unknown) =>
        Promise.resolve({ ...(value as object), id: 'reminder-id' }),
      ),
    };
    const appointmentRepo = {
      update: jest.fn().mockResolvedValue(undefined),
    };
    const { service, appointments, manager } = buildService(async () => null);
    appointments.create
      .mockResolvedValueOnce({ id: 'completed-appointment-id' })
      .mockResolvedValueOnce({ id: 'scheduled-appointment-id' });
    (manager.getRepository as jest.Mock).mockImplementation((entity: unknown) => {
      if (entity === FollowUp) return followUps;
      if (entity === Reminder) return reminders;
      if (entity === PatientMedicalAppointment) return appointmentRepo;
      return {};
    });

    await service.fanOutFromSymptomReport(
      'patient-id',
      'follow-up-id',
      null,
      {
        followUpId: 'follow-up-id',
        hasMedicalConsultation: true,
        specialty: 'Medicina general',
        healthCenterId: 'center-id',
        firstConsultationDate: '2026-01-15',
        nextConsultationDate: '2026-02-10',
        nextConsultationSpecialty: 'ONCOLOGIA_MEDICA',
        nextConsultationNote: 'Llevar resultados',
      },
      manager,
    );

    expect(appointments.create).toHaveBeenNthCalledWith(
      1,
      'patient-id',
      expect.objectContaining({
        nextAppointmentDate: '2026-02-10',
        nextAppointmentSpecialty: 'ONCOLOGIA_MEDICA',
        status: MedicalAppointmentStatus.COMPLETED,
      }),
      manager,
      false,
    );
    expect(appointments.create).toHaveBeenNthCalledWith(
      2,
      'patient-id',
      expect.objectContaining({
        specialty: 'ONCOLOGIA_MEDICA',
        appointmentDate: '2026-02-10',
        status: MedicalAppointmentStatus.SCHEDULED,
      }),
      manager,
      true,
    );
    expect(reminders.save).toHaveBeenCalledWith(
      expect.objectContaining({
        assignedAgentId: 'agent-id',
        description: 'Llevar resultados',
        kind: ReminderKind.MEDICAL_APPOINTMENT,
        medicalAppointmentId: 'scheduled-appointment-id',
        dueOn: '2026-02-10',
      }),
    );
    expect(appointmentRepo.update).toHaveBeenCalledWith(
      { id: 'scheduled-appointment-id' },
      { reminderId: 'reminder-id' },
    );
  });

  it('strips ownership fields from the persistable symptom payload', () => {
    const { service } = buildService(async () => null);
    expect(
      service.stripOwnershipFields({
        followUpId: 'follow-up-id',
        specialty: 'Oncología',
        reportedDiagnosis: 'Cáncer de mama',
        hasReceivedDiagnosis: true,
        signsAndSymptoms: 'dolor',
      }),
    ).toEqual(
      expect.objectContaining({
        specialty: undefined,
        reportedDiagnosis: undefined,
        hasReceivedDiagnosis: undefined,
        signsAndSymptoms: 'dolor',
      }),
    );
  });
});
