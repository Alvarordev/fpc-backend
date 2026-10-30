import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  type DeepPartial,
  EntityManager,
  Repository,
} from 'typeorm';
import { PatientAddress } from '../../../database/entities/patient-address.entity';
import { PatientRole } from '../../../database/entities/patient-role.enum';
import { PatientsService } from '../patients.service';
import { PatientSummaryInvalidationService } from '../../patient-summaries/patient-summary-invalidation.service';
import { CreatePatientAddressDto } from './dto/create-patient-address.dto';
import { UpdatePatientAddressDto } from './dto/update-patient-address.dto';
import { User } from '../../../database/entities/user.entity';
import { CatalogValueService } from '../../catalogs/catalog-value.service';
import { normalizeDuration } from '../../../shared/duration/duration.util';

@Injectable()
export class PatientAddressesService {
  constructor(
    @InjectRepository(PatientAddress)
    private readonly repository: Repository<PatientAddress>,
    private readonly patients: PatientsService,
    private readonly invalidations: PatientSummaryInvalidationService,
    private readonly dataSource: DataSource,
    private readonly catalogValues: CatalogValueService,
  ) {}

  /** Resolves catalog answers and the travel duration into stored columns. */
  async normalize(
    input: UpdatePatientAddressDto,
    manager?: EntityManager,
  ): Promise<DeepPartial<PatientAddress>> {
    const {
      locationShareStatus,
      locationShareStatusOther,
      housingType,
      housingTypeOther,
      travelTimeToHospital,
      averageLodgingCost,
      ...rest
    } = input;
    const values: DeepPartial<PatientAddress> = { ...rest };
    if (locationShareStatus !== undefined) {
      const resolved = await this.catalogValues.resolveOptional(
        'location_share_status',
        locationShareStatus,
        { otherText: locationShareStatusOther, manager },
      );
      values.locationShareStatus = resolved?.code ?? null;
      values.locationShareStatusOther = resolved?.other ?? null;
    }
    if (housingType !== undefined) {
      const resolved = await this.catalogValues.resolveOptional(
        'temporary_housing_type',
        housingType,
        { otherText: housingTypeOther, manager },
      );
      values.housingType = resolved?.code ?? null;
      values.housingTypeOther = resolved?.other ?? null;
    }
    if (travelTimeToHospital !== undefined)
      values.travelTimeToHospital = normalizeDuration(travelTimeToHospital);
    if (averageLodgingCost !== undefined) {
      // A cost without its period (night or month) cannot be compared.
      if (averageLodgingCost !== null && !input.averageLodgingCostPeriod)
        throw new BadRequestException(
          'Indica si el gasto promedio del alojamiento es por noche o por mes',
        );
      values.averageLodgingCost =
        averageLodgingCost === null ? null : String(averageLodgingCost);
      if (averageLodgingCost === null) values.averageLodgingCostPeriod = null;
    }
    return values;
  }

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
      const values = await this.normalize(input, entityManager);
      const address = await repository.save(
        repository.create({ ...values, patientId, isPrimary }),
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
      if (!address) throw new NotFoundException('No se encontró la dirección.');
      if (input.isPrimary) {
        await repository
          .createQueryBuilder()
          .update()
          .set({ isPrimary: false })
          .where('patient_id = :patientId', { patientId })
          .execute();
      }
      const values = await this.normalize(input, manager);
      const saved = await repository.save(repository.merge(address, values));
      await this.invalidations.markDirty(patientId, manager);
      return saved;
    });
  }

  async deactivate(patientId: string, addressId: string): Promise<void> {
    const address = await this.repository.findOne({
      where: { id: addressId, patientId },
    });
    if (!address) throw new NotFoundException('No se encontró la dirección.');
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
