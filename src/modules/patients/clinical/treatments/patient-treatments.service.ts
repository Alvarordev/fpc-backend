import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { FollowUp } from '../../../../database/entities/follow-up.entity';
import { PatientDiagnosis } from '../../../../database/entities/patient-diagnosis.entity';
import { PatientRole } from '../../../../database/entities/patient-role.enum';
import { PatientTreatment } from '../../../../database/entities/patient-treatment.entity';
import { HistoryVersioningService } from '../../history-versioning/history-versioning.service';
import { PatientsService } from '../../patients.service';
import { PatientSummaryInvalidationService } from '../../../patient-summaries/patient-summary-invalidation.service';
import { CreatePatientTreatmentDto } from './dto/create-patient-treatment.dto';
import { User } from '../../../../database/entities/user.entity';
import { normalizeDuration } from '../../../../shared/duration/duration.util';
import { TreatmentMedicationsService } from './medications/treatment-medications.service';

@Injectable()
export class PatientTreatmentsService {
  constructor(
    @InjectRepository(PatientTreatment)
    private readonly repository: Repository<PatientTreatment>,
    @InjectRepository(PatientDiagnosis)
    private readonly diagnoses: Repository<PatientDiagnosis>,
    @InjectRepository(FollowUp)
    private readonly followUps: Repository<FollowUp>,
    private readonly patients: PatientsService,
    private readonly versioning: HistoryVersioningService,
    private readonly invalidations: PatientSummaryInvalidationService,
    private readonly medications: TreatmentMedicationsService,
    private readonly dataSource: DataSource,
  ) {}

  async create(
    patientId: string,
    input: CreatePatientTreatmentDto,
    manager?: EntityManager,
  ): Promise<PatientTreatment> {
    await this.patients.assertPatientRole(
      patientId,
      PatientRole.PATIENT,
      undefined,
      manager,
    );

    const run = async (entityManager: EntityManager) => {
      const diagnoses = entityManager.getRepository(PatientDiagnosis);
      const followUps = entityManager.getRepository(FollowUp);
      const treatments = entityManager.getRepository(PatientTreatment);
      const [diagnosis, followUp] = await Promise.all([
        diagnoses.findOne({ where: { id: input.diagnosisId } }),
        followUps.existsBy({
          id: input.followUpId,
          subjectPatientId: patientId,
        }),
      ]);
      if (!diagnosis) throw new NotFoundException('Diagnosis not found');
      if (diagnosis.patientId !== patientId)
        throw new ConflictException('Diagnosis does not belong to patient');
      if (!followUp) throw new NotFoundException('Follow-up not found');

      if (input.startDate && input.endDate && input.endDate < input.startDate)
        throw new BadRequestException('endDate must be on or after startDate');

      let previousTreatment: PatientTreatment | null = null;
      let seriesId = input.seriesId;
      if (seriesId) {
        previousTreatment = await treatments.findOne({
          where: { seriesId, patientId, isCurrent: true },
        });
        if (!previousTreatment)
          throw new NotFoundException('Treatment series not found');
      } else {
        seriesId = crypto.randomUUID();
      }

      const { medications: medicationInputs, ...rest } = input;
      const values = {
        ...rest,
        patientId,
        seriesId,
        treatmentFrequency: normalizeDuration(input.treatmentFrequency),
      };
      const treatment = await this.versioning.replaceCurrent(
        PatientTreatment,
        { seriesId, isCurrent: true },
        values,
        entityManager,
      );

      if (medicationInputs?.length) {
        for (const medication of medicationInputs) {
          await this.medications.create(
            patientId,
            treatment.id,
            medication,
            entityManager,
          );
        }
      } else if (previousTreatment) {
        await this.medications.copyActiveToNewTreatment(
          patientId,
          previousTreatment.id,
          treatment.id,
          entityManager,
        );
      }

      await this.invalidations.markDirty(patientId, entityManager);
      return treatment;
    };

    return manager
      ? run(manager)
      : this.dataSource.transaction((entityManager) => run(entityManager));
  }

  async findAll(patientId: string, user: User): Promise<PatientTreatment[]> {
    await this.patients.assertCanRead(patientId, user);
    return this.repository.find({
      where: { patientId },
      order: { createdAt: 'DESC' },
    });
  }
}
