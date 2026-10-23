import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { PatientAddress } from '../../../database/entities/patient-address.entity';
import { PatientRole } from '../../../database/entities/patient-role.enum';
import { PatientsService } from '../patients.service';
import { PatientSummaryInvalidationService } from '../../patient-summaries/patient-summary-invalidation.service';
import { CreatePatientAddressDto } from './dto/create-patient-address.dto';
import { UpdatePatientAddressDto } from './dto/update-patient-address.dto';
import { User } from '../../../database/entities/user.entity';

@Injectable()
export class PatientAddressesService {
  constructor(
    @InjectRepository(PatientAddress)
    private readonly repository: Repository<PatientAddress>,
    private readonly patients: PatientsService,
    private readonly invalidations: PatientSummaryInvalidationService,
    private readonly dataSource: DataSource,
  ) {}

  async create(
    patientId: string,
    input: CreatePatientAddressDto,
    manager?: EntityManager,
  ): Promise<PatientAddress> {
    await this.patients.assertPatientRole(
      patientId,
      PatientRole.PATIENT,
      undefined,
      manager,
    );
    const run = async (entityManager: EntityManager) => {
      const repository = entityManager.getRepository(PatientAddress);
      const existingCount = await repository.countBy({ patientId });
      const isPrimary = input.isPrimary ?? existingCount === 0;
      if (isPrimary) {
        await repository
          .createQueryBuilder()
          .update()
          .set({ isPrimary: false })
          .where('patient_id = :patientId', { patientId })
          .execute();
      }
      const address = await repository.save(
        repository.create({ ...input, patientId, isPrimary }),
      );
      await this.invalidations.markDirty(patientId, entityManager);
      return address;
    };
    return manager
      ? run(manager)
      : this.dataSource.transaction((entityManager) => run(entityManager));
  }

  async update(
    patientId: string,
    addressId: string,
    input: UpdatePatientAddressDto,
  ): Promise<PatientAddress> {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(PatientAddress);
      const address = await repository.findOne({
        where: { id: addressId, patientId },
      });
      if (!address) throw new NotFoundException('Address not found');
      if (input.isPrimary) {
        await repository
          .createQueryBuilder()
          .update()
          .set({ isPrimary: false })
          .where('patient_id = :patientId', { patientId })
          .execute();
      }
      const saved = await repository.save(Object.assign(address, input));
      await this.invalidations.markDirty(patientId, manager);
      return saved;
    });
  }

  async deactivate(patientId: string, addressId: string): Promise<void> {
    const address = await this.repository.findOne({
      where: { id: addressId, patientId },
    });
    if (!address) throw new NotFoundException('Address not found');
    address.isActive = false;
    address.isPrimary = false;
    await this.repository.save(address);
    await this.invalidations.markDirty(patientId);
  }

  async findAll(patientId: string, user: User): Promise<PatientAddress[]> {
    await this.patients.assertCanRead(patientId, user);
    return this.repository.find({
      where: { patientId },
      order: { createdAt: 'DESC' },
    });
  }
}
