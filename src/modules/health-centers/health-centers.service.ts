import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HealthCenter } from '../../database/entities/health-center.entity';
import { CatalogValueService } from '../catalogs/catalog-value.service';
import { CreateHealthCenterDto } from './dto/create-health-center.dto';
import { UpdateHealthCenterDto } from './dto/update-health-center.dto';
@Injectable()
export class HealthCentersService {
  constructor(
    @InjectRepository(HealthCenter)
    private readonly repository: Repository<HealthCenter>,
    private readonly catalogValues: CatalogValueService,
  ) {}
  private slug(value: string) {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  async create(input: CreateHealthCenterDto) {
    const category = await this.catalogValues.resolve(
      'health_center_category',
      input.category,
    );
    return this.repository.save(
      this.repository.create({
        ...input,
        category: category.code,
        slug: this.slug(input.name),
      }),
    );
  }
  findAll(department?: string, isActive?: boolean) {
    const query = this.repository
      .createQueryBuilder('health_center')
      .addSelect(this.patientCountSubquery(), 'patientCount');
    if (department)
      query.andWhere('health_center.department = :department', { department });
    if (isActive !== undefined)
      query.andWhere('health_center.is_active = :isActive', { isActive });
    return this.withPatientCounts(query);
  }
  async findOne(id: string) {
    const query = this.repository
      .createQueryBuilder('health_center')
      .addSelect(this.patientCountSubquery(), 'patientCount')
      .where('health_center.id = :id', { id });
    const [item] = await this.withPatientCounts(query);
    if (!item) throw new NotFoundException('Health center not found');
    return item;
  }
  async update(id: string, input: UpdateHealthCenterDto) {
    const item = await this.findOne(id);
    const category = input.category
      ? (
          await this.catalogValues.resolve(
            'health_center_category',
            input.category,
          )
        ).code
      : input.category;
    Object.assign(item, { ...input, ...(category !== undefined ? { category } : {}) });
    if (input.name) item.slug = this.slug(input.name);
    await this.repository.save(item);
    return this.findOne(id);
  }

  private async withPatientCounts(
    query: ReturnType<Repository<HealthCenter>['createQueryBuilder']>,
  ) {
    const { entities, raw } = await query.getRawAndEntities();
    return entities.map((item, index) =>
      Object.assign(item, { patientCount: Number(raw[index].patientCount) }),
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
