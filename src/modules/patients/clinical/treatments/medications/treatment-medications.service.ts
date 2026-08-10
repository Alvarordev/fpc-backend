import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { PatientTreatment } from '../../../../../database/entities/patient-treatment.entity';
import { TreatmentMedication } from '../../../../../database/entities/treatment-medication.entity';
import { PatientsService } from '../../../patients.service';
import { PatientSummaryInvalidationService } from '../../../../patient-summaries/patient-summary-invalidation.service';
import { normalizeDuration } from '../../../../../shared/duration/duration.util';
import { CreateTreatmentMedicationDto } from './create-treatment-medication.dto';
import { UpdateTreatmentMedicationDto } from './update-treatment-medication.dto';
import { User } from '../../../../../database/entities/user.entity';

@Injectable()
export class TreatmentMedicationsService {
  constructor(
    @InjectRepository(TreatmentMedication)
    private readonly repository: Repository<TreatmentMedication>,
    @InjectRepository(PatientTreatment)
    private readonly treatments: Repository<PatientTreatment>,
    private readonly patients: PatientsService,
    private readonly invalidations: PatientSummaryInvalidationService,
  ) {}

  async create(
    patientId: string,
    treatmentId: string,
    input: CreateTreatmentMedicationDto,
    manager?: EntityManager,
  ): Promise<TreatmentMedication> {
    const treatments =
      manager?.getRepository(PatientTreatment) ?? this.treatments;
    const treatment = await treatments.findOne({
      where: { id: treatmentId, patientId },
    });
    if (!treatment) throw new NotFoundException('Treatment not found');
    const repository =
      manager?.getRepository(TreatmentMedication) ?? this.repository;
    const { frequency, ...rest } = input;
    const medication = await repository.save(
      repository.create({
        ...rest,
        treatmentId,
        patientId,
        doseAmount:
          input.doseAmount === undefined ? null : String(input.doseAmount),
        frequency: normalizeDuration(frequency),
      }),
    );
    await this.invalidations.markDirty(patientId, manager);
    return medication;
  }

  async update(
    patientId: string,
    treatmentId: string,
    medicationId: string,
    input: UpdateTreatmentMedicationDto,
  ): Promise<TreatmentMedication> {
    const medication = await this.repository.findOne({
      where: { id: medicationId, treatmentId, patientId },
    });
    if (!medication) throw new NotFoundException('Medication not found');
    const { frequency, doseAmount, ...rest } = input;
    Object.assign(medication, rest);
    if (frequency !== undefined)
      medication.frequency = normalizeDuration(frequency);
    if (doseAmount !== undefined) medication.doseAmount = String(doseAmount);
    const saved = await this.repository.save(medication);
    await this.invalidations.markDirty(patientId);
    return saved;
  }

  async deactivate(
    patientId: string,
    treatmentId: string,
    medicationId: string,
  ): Promise<void> {
    const medication = await this.repository.findOne({
      where: { id: medicationId, treatmentId, patientId },
    });
    if (!medication) throw new NotFoundException('Medication not found');
    medication.isActive = false;
    await this.repository.save(medication);
    await this.invalidations.markDirty(patientId);
  }

  async findAll(
    patientId: string,
    treatmentId: string,
    user: User,
  ): Promise<TreatmentMedication[]> {
    await this.patients.assertCanRead(patientId, user);
    return this.repository.find({
      where: { patientId, treatmentId },
      order: { createdAt: 'DESC' },
    });
  }

  async copyActiveToNewTreatment(
    patientId: string,
    fromTreatmentId: string,
    toTreatmentId: string,
    manager: EntityManager,
  ): Promise<void> {
    const repository = manager.getRepository(TreatmentMedication);
    const active = await repository.find({
      where: { treatmentId: fromTreatmentId, patientId, isActive: true },
    });
    if (!active.length) return;
    await repository.save(
      active.map((medication) =>
        repository.create({
          ...medication,
          id: undefined,
          treatmentId: toTreatmentId,
          createdAt: undefined,
        }),
      ),
    );
  }
}
