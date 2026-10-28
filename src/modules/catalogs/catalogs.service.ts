import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CatalogMerge } from '../../database/entities/catalog-merge.entity';
import {
  CatalogItem,
  isOpenCatalogKind,
  RESERVED_CATALOG_CODE,
  type CatalogKind,
} from '../../database/entities/catalog-item.entity';
import { UserRole } from '../../database/entities/user-role.enum';
import { User } from '../../database/entities/user.entity';
import {
  UbigeoDepartment,
  UbigeoDistrict,
  UbigeoProvince,
} from '../../database/entities/ubigeo.entity';
import { CreateCatalogItemDto } from './dto/create-catalog-item.dto';
import { UpdateCatalogItemDto } from './dto/create-catalog-item.dto';
import type { UbigeoTreeResponseDto } from './dto/ubigeo-response.dto';
import { CATALOG_CHILD_KINDS, CATALOG_REFERENCES } from './catalog-references';

@Injectable()
export class CatalogsService {
  constructor(
    @InjectRepository(CatalogItem)
    private readonly catalogItems: Repository<CatalogItem>,
    @InjectRepository(UbigeoDepartment)
    private readonly departments: Repository<UbigeoDepartment>,
    @InjectRepository(UbigeoProvince)
    private readonly provinces: Repository<UbigeoProvince>,
    @InjectRepository(UbigeoDistrict)
    private readonly districts: Repository<UbigeoDistrict>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  findAll(kind?: CatalogKind, includeInactive = false): Promise<CatalogItem[]> {
    const query = this.catalogItems
      .createQueryBuilder('item')
      .orderBy('item.kind', 'ASC')
      .addOrderBy('item.sort_order', 'ASC')
      .addOrderBy('item.label', 'ASC');

    if (kind) query.andWhere('item.kind = :kind', { kind });
    if (!includeInactive) query.andWhere('item.is_active = true');

    return query.getMany();
  }

  async findOne(id: string): Promise<CatalogItem> {
    const item = await this.catalogItems.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Catalog item not found');
    return item;
  }

  async create(
    input: CreateCatalogItemDto,
    role: UserRole = UserRole.ADMIN,
  ): Promise<CatalogItem> {
    const code = input.code.trim();
    if (!code) throw new BadRequestException('code is required');
    if (code.toUpperCase() === RESERVED_CATALOG_CODE) {
      throw new BadRequestException(
        `code ${RESERVED_CATALOG_CODE} is reserved and cannot be created`,
      );
    }
    this.assertCanEdit(input.kind, role);

    const existing = await this.catalogItems.findOne({
      where: { kind: input.kind, code },
    });
    if (existing) {
      throw new ConflictException(
        `Catalog item already exists for kind=${input.kind} code=${code}`,
      );
    }

    return this.catalogItems.save(
      this.catalogItems.create({
        kind: input.kind,
        code,
        label: input.label.trim(),
        parentCode: input.parentCode?.trim() || null,
        sortOrder: input.sortOrder ?? 0,
        isActive: true,
        isSystem: false,
        metadata: input.metadata ?? null,
      }),
    );
  }

  async update(
    id: string,
    input: UpdateCatalogItemDto,
    role: UserRole = UserRole.ADMIN,
  ): Promise<CatalogItem> {
    const item = await this.findOne(id);
    this.assertCanEdit(item.kind, role);

    if (input.label !== undefined) item.label = input.label.trim();
    if (input.parentCode !== undefined) {
      item.parentCode = input.parentCode?.trim() || null;
    }
    if (input.sortOrder !== undefined) item.sortOrder = input.sortOrder;
    if (input.isActive !== undefined) item.isActive = input.isActive;
    if (input.metadata !== undefined) item.metadata = input.metadata;

    await this.catalogItems.save(item);
    return this.findOne(id);
  }

  async archive(
    id: string,
    role: UserRole = UserRole.ADMIN,
  ): Promise<CatalogItem> {
    const item = await this.findOne(id);
    this.assertCanEdit(item.kind, role);
    if (item.isSystem) {
      throw new BadRequestException(
        'System catalog items cannot be archived; deactivate via PATCH if needed',
      );
    }
    item.isActive = false;
    await this.catalogItems.save(item);
    return this.findOne(id);
  }

  async merge(
    sourceId: string,
    targetId: string,
    actor: User,
  ): Promise<CatalogMerge> {
    if (sourceId === targetId)
      throw new BadRequestException('Cannot merge an item into itself');

    return this.dataSource.transaction(async (manager) => {
      const items = manager.getRepository(CatalogItem);
      const [source, target] = await Promise.all([
        items.findOne({
          where: { id: sourceId },
          lock: { mode: 'pessimistic_write' },
        }),
        items.findOne({
          where: { id: targetId },
          lock: { mode: 'pessimistic_write' },
        }),
      ]);
      if (!source || !target)
        throw new NotFoundException('Catalog item not found');
      if (source.kind !== target.kind)
        throw new BadRequestException(
          'Only items of the same catalog kind can be merged',
        );
      if (source.isSystem)
        throw new BadRequestException(
          'System catalog items cannot be merged into another item',
        );
      if (source.metadata?.mergedInto)
        throw new ConflictException('Catalog item was already merged');
      if (!target.isActive)
        throw new BadRequestException('Target catalog item is archived');

      const affectedRows: Record<string, number> = {};
      for (const reference of CATALOG_REFERENCES[source.kind] ?? []) {
        const key = `${reference.table}.${reference.column}`;
        const column = `"${reference.column}"`;
        const result: [unknown, number] = await manager.query<
          [unknown, number]
        >(
          reference.array
            ? `UPDATE "${reference.table}"
                  SET ${column} = ARRAY(
                    SELECT DISTINCT unnest(array_replace(${column}, $1::varchar, $2::varchar))
                  )
                WHERE $1 = ANY(${column})`
            : `UPDATE "${reference.table}" SET ${column} = $2 WHERE ${column} = $1`,
          [source.code, target.code],
        );
        affectedRows[key] = result[1];
      }
      for (const childKind of CATALOG_CHILD_KINDS[source.kind] ?? []) {
        const result = await items.update(
          { kind: childKind, parentCode: source.code },
          { parentCode: target.code },
        );
        affectedRows[`catalog_items.parent_code(${childKind})`] =
          result.affected ?? 0;
      }

      source.isActive = false;
      source.metadata = { ...(source.metadata ?? {}), mergedInto: target.code };
      await items.save(source);

      const merges = manager.getRepository(CatalogMerge);
      return merges.save(
        merges.create({
          kind: source.kind,
          sourceItemId: source.id,
          targetItemId: target.id,
          sourceCode: source.code,
          targetCode: target.code,
          actorUserId: actor.id,
          affectedRows,
        }),
      );
    });
  }

  findMerges(itemId?: string): Promise<CatalogMerge[]> {
    const query = this.dataSource
      .getRepository(CatalogMerge)
      .createQueryBuilder('merge')
      .orderBy('merge.created_at', 'DESC');
    if (itemId)
      query.where(
        'merge.source_item_id = :itemId OR merge.target_item_id = :itemId',
        { itemId },
      );
    return query.getMany();
  }

  private assertCanEdit(kind: CatalogKind, role: UserRole) {
    if (role === UserRole.ADMIN || role === UserRole.FOUNDATION) return;
    if (role === UserRole.AGENT && isOpenCatalogKind(kind)) return;
    throw new ForbiddenException(
      'Only administrators or the foundation can edit this catalog kind',
    );
  }

  async getUbigeoTree(options: {
    department?: string;
    province?: string;
  }): Promise<UbigeoTreeResponseDto> {
    const deptQuery = this.departments
      .createQueryBuilder('department')
      .where('department.is_active = true')
      .orderBy('department.sort_order', 'ASC')
      .addOrderBy('department.name', 'ASC');

    if (options.department) {
      deptQuery.andWhere('department.code = :code', {
        code: options.department,
      });
    }

    const departments = await deptQuery.getMany();
    if (departments.length === 0) {
      return { departments: [] };
    }

    const departmentCodes = departments.map((d) => d.code);
    const provinceQuery = this.provinces
      .createQueryBuilder('province')
      .where('province.is_active = true')
      .andWhere('province.department_code IN (:...departmentCodes)', {
        departmentCodes,
      })
      .orderBy('province.sort_order', 'ASC')
      .addOrderBy('province.name', 'ASC');

    if (options.province) {
      provinceQuery.andWhere('province.inei_code = :province', {
        province: options.province,
      });
    }

    const provinces = await provinceQuery.getMany();
    const includeDistricts =
      Boolean(options.department) || Boolean(options.province);

    let districts: UbigeoDistrict[] = [];
    if (includeDistricts && provinces.length > 0) {
      districts = await this.districts
        .createQueryBuilder('district')
        .where('district.is_active = true')
        .andWhere('district.province_inei_code IN (:...provinceCodes)', {
          provinceCodes: provinces.map((p) => p.ineiCode),
        })
        .orderBy('district.sort_order', 'ASC')
        .addOrderBy('district.name', 'ASC')
        .getMany();
    }

    const districtsByProvince = new Map<string, UbigeoDistrict[]>();
    for (const district of districts) {
      const list = districtsByProvince.get(district.provinceIneiCode) ?? [];
      list.push(district);
      districtsByProvince.set(district.provinceIneiCode, list);
    }

    const provincesByDepartment = new Map<string, UbigeoProvince[]>();
    for (const province of provinces) {
      const list = provincesByDepartment.get(province.departmentCode) ?? [];
      list.push(province);
      provincesByDepartment.set(province.departmentCode, list);
    }

    return {
      departments: departments.map((department) => ({
        code: department.code,
        ineiCode: department.ineiCode,
        name: department.name,
        sortOrder: department.sortOrder,
        isActive: department.isActive,
        provinces: (provincesByDepartment.get(department.code) ?? []).map(
          (province) => ({
            ineiCode: province.ineiCode,
            name: province.name,
            sortOrder: province.sortOrder,
            isActive: province.isActive,
            ...(includeDistricts
              ? {
                  districts: (
                    districtsByProvince.get(province.ineiCode) ?? []
                  ).map((district) => ({
                    ineiCode: district.ineiCode,
                    name: district.name,
                    sortOrder: district.sortOrder,
                    isActive: district.isActive,
                  })),
                }
              : {}),
          }),
        ),
      })),
    };
  }
}
