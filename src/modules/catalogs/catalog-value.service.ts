import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import {
  CatalogItem,
  type CatalogKind,
} from '../../database/entities/catalog-item.entity';

export type ResolvedCatalogValue = {
  code: string;
  label: string;
  other: string | null;
};

export type ResolveCatalogOptions = {
  otherText?: string | null;
  manager?: EntityManager;
  allowInactive?: boolean;
};

@Injectable()
export class CatalogValueService {
  constructor(
    @InjectRepository(CatalogItem)
    private readonly catalogItems: Repository<CatalogItem>,
  ) {}

  async resolve(
    kind: CatalogKind,
    value: string,
    options: ResolveCatalogOptions = {},
  ): Promise<ResolvedCatalogValue> {
    const resolved = await this.tryResolve(kind, value, options);
    if (!resolved) {
      throw new BadRequestException(
        `Unknown ${kind} catalog value: ${value.trim()}`,
      );
    }
    return resolved;
  }

  async tryResolve(
    kind: CatalogKind,
    value: string | null | undefined,
    options: ResolveCatalogOptions = {},
  ): Promise<ResolvedCatalogValue | null> {
    const raw = value?.trim();
    if (!raw) return null;
    const items = await this.loadKind(kind, options);
    const needle = normalizeCatalogKey(raw);
    const match =
      items.find((item) => item.code === raw) ??
      items.find((item) => normalizeCatalogKey(item.code) === needle) ??
      items.find((item) => normalizeCatalogKey(item.label) === needle) ??
      items.find((item) =>
        catalogAliases(item).some((alias) => normalizeCatalogKey(alias) === needle),
      );
    if (!match) return null;
    const other = this.otherFor(match.code, raw, options.otherText);
    if (match.code === 'OTRO' && !other) {
      throw new BadRequestException(
        `${kind} requires additional text when the value is OTRO`,
      );
    }
    return { code: match.code, label: match.label, other };
  }

  async resolveOptional(
    kind: CatalogKind,
    value: string | null | undefined,
    options: ResolveCatalogOptions = {},
  ): Promise<ResolvedCatalogValue | null> {
    if (!value?.trim()) return null;
    return this.resolve(kind, value, options);
  }

  async resolveMany(
    kind: CatalogKind,
    values: string[] | null | undefined,
    options: ResolveCatalogOptions = {},
  ): Promise<string[] | null> {
    if (!values?.length) return values ?? null;
    const resolved = await Promise.all(
      values.map((value) => this.resolve(kind, value, options)),
    );
    return resolved.map((item) => item.code);
  }

  private otherFor(
    code: string,
    original: string,
    otherText?: string | null,
  ): string | null {
    const extra = otherText?.trim() || null;
    if (code !== 'OTRO') return extra;
    if (extra) return extra;
    if (normalizeCatalogKey(original) === 'otro') return null;
    return original.trim();
  }

  private async loadKind(
    kind: CatalogKind,
    options: ResolveCatalogOptions,
  ): Promise<CatalogItem[]> {
    const repository =
      options.manager?.getRepository(CatalogItem) ?? this.catalogItems;
    const where: { kind: CatalogKind; isActive?: boolean } = { kind };
    if (!options.allowInactive) where.isActive = true;
    return repository.find({ where });
  }
}

export function normalizeCatalogKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function catalogAliases(item: CatalogItem): string[] {
  const aliases = item.metadata?.aliases;
  return Array.isArray(aliases)
    ? aliases.filter((alias): alias is string => typeof alias === 'string')
    : [];
}
