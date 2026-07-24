import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HealthCenter } from '../database/entities/health-center.entity';
import {
  CreateHealthCenterDto,
  UpdateHealthCenterDto,
} from './health-centers.dto';
@Injectable()
export class HealthCentersService {
  constructor(
    @InjectRepository(HealthCenter)
    private readonly repository: Repository<HealthCenter>,
  ) {}
  private slug(value: string) {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  create(input: CreateHealthCenterDto) {
    return this.repository.save(
      this.repository.create({ ...input, slug: this.slug(input.name) }),
    );
  }
  findAll(department?: string, isActive?: boolean) {
    const query = this.repository.createQueryBuilder('healthCenter');
    if (department)
      query.andWhere('healthCenter.department = :department', { department });
    if (isActive !== undefined)
      query.andWhere('healthCenter.is_active = :isActive', { isActive });
    return query.getMany();
  }
  async findOne(id: string) {
    const item = await this.repository.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Health center not found');
    return item;
  }
  async update(id: string, input: UpdateHealthCenterDto) {
    const item = await this.findOne(id);
    Object.assign(item, input);
    if (input.name) item.slug = this.slug(input.name);
    return this.repository.save(item);
  }
}
