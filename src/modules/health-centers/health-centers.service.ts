import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { HealthCenter } from '../../database/entities/health-center.entity';
import { UbigeoDistrict } from '../../database/entities/ubigeo.entity';
import { CreateHealthCenterDto } from './dto/create-health-center.dto';
import { UpdateHealthCenterDto } from './dto/update-health-center.dto';

export type HealthCenterFilters = {
  department?: string;
  isActive?: boolean;
  careLevel?: string;
  search?: string;
};

@Injectable()
export class HealthCentersService {
  constructor(
    @InjectRepository(HealthCenter)
    private readonly repository: Repository<HealthCenter>,
    @InjectRepository(UbigeoDistrict)
    private readonly districts: Repository<UbigeoDistrict>,
  ) {}

  private slug(value: string) {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  async create(input: CreateHealthCenterDto) {
    await this.assertReferences(input);
    const saved = await this.repository.save(
      this.repository.create({
        ...input,
        careCategory: input.careCategory ?? null,
        institution: input.institution ?? null,
        ubigeoDistrictCode: input.ubigeoDistrictCode ?? null,
        renipressCode: input.renipressCode ?? null,
        slug: this.slug(input.name),
      }),
    );
    return this.findOne(saved.id);
  }

  findAll(filters: HealthCenterFilters = {}) {
    const query = this.repository
      .createQueryBuilder('health_center')
      .addSelect(this.patientCountSubquery(), 'patientCount')
      .orderBy('health_center.name', 'ASC');
    if (filters.department)
      query.andWhere('health_center.department = :department', {
        department: filters.department,
      });
    if (filters.isActive !== undefined)
      query.andWhere('health_center.is_active = :isActive', {
        isActive: filters.isActive,
      });
    if (filters.careLevel)
      query.andWhere('health_center.care_level = :careLevel', {
        careLevel: filters.careLevel,
      });
    if (filters.search?.trim())
      query.andWhere(
        '(health_center.name ILIKE :search OR health_center.renipress_code = :code)',
        { search: `%${filters.search.trim()}%`, code: filters.search.trim() },
      );
    return this.withPatientCounts(query);
  }

  async findOne(id: string) {
    const query = this.repository
      .createQueryBuilder('health_center')
      .addSelect(this.patientCountSubquery(), 'patientCount')
      .where('health_center.id = :id', { id });
    const [item] = await this.withPatientCounts(query);
    if (!item) throw new NotFoundException('No se encontró el establecimiento.');
    return item;
  }

  async update(id: string, input: UpdateHealthCenterDto) {
    const item = await this.findOne(id);
    await this.assertReferences(input, id);
    Object.assign(item, input);
    if (input.name) item.slug = this.slug(input.name);
    await this.repository.save(item);
    return this.findOne(id);
  }

  private async assertReferences(
    input: Partial<CreateHealthCenterDto>,
    currentId?: string,
  ) {
    if (
      input.ubigeoDistrictCode &&
      !(await this.districts.existsBy({ ineiCode: input.ubigeoDistrictCode }))
    )
      throw new BadRequestException('El ubigeo del distrito no existe.');
    if (
      input.renipressCode &&
      (await this.repository.existsBy({
        renipressCode: input.renipressCode,
        ...(currentId ? { id: Not(currentId) } : {}),
      }))
    )
      throw new ConflictException(
        'Otro establecimiento ya usa ese código RENIPRESS.',
      );
  }

  private async withPatientCounts(
    query: ReturnType<Repository<HealthCenter>['createQueryBuilder']>,
  ) {
    const { entities, raw } = await query.getRawAndEntities();
    return entities.map((item, index) =>
      Object.assign(item, {
        patientCount: Number(
          (raw[index] as { patientCount: string }).patientCount,
        ),
      }),
    );
  }

  private patientCountSubquery(): string {
    return `(
      SELECT COUNT(DISTINCT linked_patient.patient_id)
      FROM (
        SELECT diagnosis.patient_id
        FROM patient_diagnoses diagnosis
        WHERE diagnosis.health_center_id = health_center.id
        UNION
         SELECT treatment.patient_id
        FROM patient_treatments treatment
        WHERE treatment.receiving_health_center_id = health_center.id
        UNION
        SELECT treatment.patient_id
        FROM patient_treatments treatment
        WHERE treatment.source_health_center_id = health_center.id
        UNION
        SELECT appointment.patient_id
        FROM patient_medical_appointments appointment
        WHERE appointment.health_center_id = health_center.id
      ) linked_patient
    )`;
  }
}
