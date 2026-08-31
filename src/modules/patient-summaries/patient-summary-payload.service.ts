import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Enrollment } from '../../database/entities/enrollment.entity';
import { FollowUp } from '../../database/entities/follow-up.entity';
import { Repository } from 'typeorm';
import { PatientDiagnosis } from '../../database/entities/patient-diagnosis.entity';
import { PatientInsurance } from '../../database/entities/patient-insurance.entity';
import { PatientMedicalAppointment } from '../../database/entities/patient-medical-appointment.entity';
import { PatientSisAffiliation } from '../../database/entities/patient-sis-affiliation.entity';
import { PatientSymptomReport } from '../../database/entities/patient-symptom-report.entity';
import { PatientTreatment } from '../../database/entities/patient-treatment.entity';
import { Patient } from '../../database/entities/patient.entity';
import { PatientActivityStatus } from '../../database/entities/patient-activity-status.enum';
import { PatientAddress } from '../../database/entities/patient-address.entity';
import { HealthCenter } from '../../database/entities/health-center.entity';

@Injectable()
export class PatientSummaryPayloadService {
  constructor(
    @InjectRepository(Patient) private readonly patients: Repository<Patient>,
    @InjectRepository(PatientDiagnosis)
    private readonly diagnoses: Repository<PatientDiagnosis>,
    @InjectRepository(PatientInsurance)
    private readonly insurance: Repository<PatientInsurance>,
    @InjectRepository(PatientTreatment)
    private readonly treatments: Repository<PatientTreatment>,
    @InjectRepository(PatientMedicalAppointment)
    private readonly appointments: Repository<PatientMedicalAppointment>,
    @InjectRepository(PatientSisAffiliation)
    private readonly sisAffiliations: Repository<PatientSisAffiliation>,
    @InjectRepository(PatientSymptomReport)
    private readonly symptoms: Repository<PatientSymptomReport>,
    @InjectRepository(Enrollment)
    private readonly enrollments: Repository<Enrollment>,
    @InjectRepository(FollowUp)
    private readonly followUps: Repository<FollowUp>,
    @InjectRepository(PatientAddress)
    private readonly addresses: Repository<PatientAddress>,
    @InjectRepository(HealthCenter)
    private readonly healthCenters: Repository<HealthCenter>,
  ) {}

  async buildPrompt(patientId: string): Promise<string> {
    const patient = await this.patients.findOne({
      where: { id: patientId },
      relations: { details: true },
    });
    if (!patient) throw new NotFoundException('Patient not found');

    const [
      diagnoses,
      insurance,
      treatments,
      appointments,
      sis,
      symptoms,
      enrollment,
      followUps,
      primaryAddress,
      primaryHealthCenter,
    ] = await Promise.all([
      this.diagnoses.find({ where: { patientId, isCurrent: true } }),
      this.insurance.find({ where: { patientId, isCurrent: true } }),
      this.treatments.find({ where: { patientId, isCurrent: true } }),
      this.appointments.find({ where: { patientId, isCurrent: true } }),
      this.sisAffiliations.find({
        where: { patientId },
        order: { createdAt: 'DESC' },
        take: 3,
      }),
      this.symptoms.find({
        where: { patientId },
        order: { createdAt: 'DESC' },
        take: 5,
      }),
      this.enrollments.find({
        where: { patientId },
        order: { createdAt: 'DESC' },
        take: 1,
      }),
      this.followUps.find({
        where: { subjectPatientId: patientId },
        order: { createdAt: 'DESC' },
        take: 10,
      }),
      this.addresses.findOne({
        where: { patientId, isPrimary: true, isActive: true },
      }),
      patient.details?.primaryHealthCenterId
        ? this.healthCenters.findOneBy({
            id: patient.details.primaryHealthCenterId,
          })
        : null,
    ]);

    // Deliberately exclude direct identifiers and contact information from the provider payload.
    const payload = {
      patient: {
        role: patient.role,
        status: patient.status,
        healthPhase: patient.details?.healthPhase ?? null,
        active: patient.activityStatus !== PatientActivityStatus.INACTIVE,
        age: ageOnDate(patient.birthDate),
        gender: patient.gender,
        location: patient.details
          ? {
              district: primaryAddress?.district ?? null,
              department: primaryAddress?.department ?? null,
              travelTimeToHospital:
                patient.details.travelTimeToHospital?.label ?? null,
              requiresTranslation: patient.details.requiresTranslation,
              primaryHospital: primaryHealthCenter?.name ?? null,
            }
          : null,
      },
      enrollment: enrollment[0]
        ? {
            attendingConsultations:
              enrollment[0].currentlyAttendingConsultations,
            receivingTreatment: enrollment[0].currentlyReceivingTreatment,
            requiresTransportation: enrollment[0].requiresTransportation,
            mobilityIssues: enrollment[0].hasMobilityIssues,
            oncologicalPatient: enrollment[0].isOncologicalPatient,
          }
        : null,
      diagnoses: diagnoses.map((item) => ({
        diagnosis: item.diagnosis,
        stage: item.cancerStage,
        date: item.diagnosisDate,
        specialty: item.diagnosisSpecialty,
        symptoms: item.symptomLeadingToCheckup,
        sepaActiveReferral: item.isSepaActiveReferral,
      })),
      insurance: insurance.map((item) => ({
        type: item.insuranceType,
        affiliatedViaSepa: item.affiliatedViaSepa,
      })),
      treatments: treatments.map((item) => ({
        type: item.treatmentType,
        frequency: item.treatmentFrequency?.label ?? null,
        situation: item.treatmentSituation,
        startDate: item.startDate,
        endDate: item.endDate,
        hasLatestPrescription: item.hasLatestPrescription,
        operationName: item.operationName,
        careProgram: item.careProgram,
        receivesTeleconsultation: item.receivesTeleconsultation,
        teleconsultationSpecialties: item.teleconsultationSpecialties,
        treatmentAbandonmentReason: item.treatmentAbandonmentReason,
      })),
      appointments: appointments.map((item) => ({
        specialty: item.specialty,
        date: item.appointmentDate,
        nextDate: item.nextAppointmentDate,
        nextSpecialty: item.nextAppointmentSpecialty,
        difficulties: item.difficulties,
      })),
      sisAffiliations: sis.map((item) => ({
        canAffiliate: item.canAffiliate,
        affiliatedViaSepa: item.affiliatedViaSepa,
        expectedDate: item.expectedDate,
        reason: item.cantAffiliateReason,
      })),
      symptomReports: symptoms.map((item) => ({
        severity: item.discomfortSeverity,
        description: item.discomfortDescription,
        duration: item.symptomDuration?.label ?? null,
        frequency: item.symptomFrequency?.label ?? null,
        painPresent: item.isPainPresent,
        painIntensity: item.painIntensity,
        painLocation: item.painLocation,
        painDescription: item.painDescription,
        soughtMedicalConsultation: item.hasSoughtMedicalConsultation,
      })),
      recentFollowUps: followUps.map((item) => ({
        type: item.type,
        status: item.status,
        purpose: item.purpose,
        scheduledAt: item.scheduledAt,
        completedAt: item.completedAt,
        notes: item.notes,
      })),
    };

    return [
      'Redacta un resumen clinico y operativo conciso en espanol.',
      'Usa exclusivamente los datos provistos, no inventes hechos ni recomendaciones medicas.',
      'Incluye diagnostico, tratamiento, sintomas, barreras y proximos seguimientos si constan.',
      'Si hay citas medicas (appointments), incluye especialidad, fecha de la ultima consulta y de la siguiente cuando consten.',
      'Si hay dificultades para asistir a las citas (appointments.difficulties), incluyelas de forma explicita; no las omitas.',
      'Responde en texto plano, en parrafos corridos.',
      'No uses markdown: nada de asteriscos, negritas, encabezados ni listas con vinetas.',
      'No agregues frases introductorias ni de cierre (por ejemplo "Aqui presento..." o "En resumen..."); empieza directamente con el contenido del resumen.',
      'Datos estructurados:',
      JSON.stringify(payload),
    ].join('\n\n');
  }
}

function ageOnDate(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const birth = new Date(`${birthDate}T00:00:00Z`);
  if (Number.isNaN(birth.valueOf())) return null;
  const today = new Date();
  let age = today.getUTCFullYear() - birth.getUTCFullYear();
  const beforeBirthday =
    today.getUTCMonth() < birth.getUTCMonth() ||
    (today.getUTCMonth() === birth.getUTCMonth() &&
      today.getUTCDate() < birth.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age >= 0 ? age : null;
}
