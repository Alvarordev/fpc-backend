import { Injectable } from '@nestjs/common';
import {
  DataSource,
  DeepPartial,
  EntityManager,
  EntityTarget,
  FindOptionsWhere,
  ObjectLiteral,
} from 'typeorm';

type Versioned = ObjectLiteral & { id: string; isCurrent: boolean };

export interface ReplaceCurrentOptions {
  /**
   * The new version is the same record edited (a treatment line, an
   * appointment being corrected): it starts from the current version and only
   * the values sent replace it. `undefined` keeps a value, `null` clears it.
   * Leave off when the new row replaces a different record (another
   * appointment of the same specialty, a new insurance, another diagnosis).
   */
  inherit?: boolean;
}

const NOT_COPIED = new Set(['id', 'isCurrent', 'createdAt', 'updatedAt']);
const NOT_LOGGED = new Set(['created_at', 'updated_at', 'is_current']);

@Injectable()
export class HistoryVersioningService {
  constructor(private readonly dataSource: DataSource) {}

  async replaceCurrent<T extends Versioned>(
    entity: EntityTarget<T>,
    currentWhere: FindOptionsWhere<T>,
    values: DeepPartial<T>,
    manager?: EntityManager,
    options: ReplaceCurrentOptions = {},
  ): Promise<T> {
    if (manager)
      return this.replaceWithManager(
        manager,
        entity,
        currentWhere,
        values,
        options,
      );
    return this.dataSource.transaction(async (manager) => {
      return this.replaceWithManager(
        manager,
        entity,
        currentWhere,
        values,
        options,
      );
    });
  }

  private async replaceWithManager<T extends Versioned>(
    manager: EntityManager,
    entity: EntityTarget<T>,
    currentWhere: FindOptionsWhere<T>,
    values: DeepPartial<T>,
    options: ReplaceCurrentOptions,
  ): Promise<T> {
    const repository = manager.getRepository(entity);
    const previous = await repository.findOne({ where: currentWhere });

    const sent = Object.fromEntries(
      Object.entries(values as ObjectLiteral).filter(
        ([, value]) => value !== undefined,
      ),
    );
    // Copied as loaded so embedded values (durations) stay nested objects.
    const base =
      options.inherit && previous
        ? Object.fromEntries(
            Object.entries(previous).filter(([key]) => !NOT_COPIED.has(key)),
          )
        : {};

    // The trigger would log the is_current flip and the whole new row; the
    // version change is logged below as one diff instead.
    await this.setAuditSuppressed(manager, true);
    await repository
      .createQueryBuilder()
      .update()
      .set({ isCurrent: false } as never)
      .where(currentWhere)
      .execute();
    const saved = await repository.save(
      repository.create({
        ...base,
        ...sent,
        isCurrent: true,
      } as DeepPartial<T>),
    );
    await this.setAuditSuppressed(manager, false);

    await this.logVersion(manager, entity, previous, saved);
    return saved;
  }

  private async logVersion<T extends Versioned>(
    manager: EntityManager,
    entity: EntityTarget<T>,
    previous: T | null,
    saved: T,
  ) {
    const metadata = manager.getRepository(entity).metadata;
    const toRow = (record: T) =>
      Object.fromEntries(
        metadata.columns.map((column) => [
          column.databaseName,
          column.getEntityValue(record) ?? null,
        ]),
      );
    const patientId =
      ((saved as ObjectLiteral).patientId as string | undefined) ?? null;
    const write = (
      field: string | null,
      oldValue: unknown,
      newValue: unknown,
    ) =>
      manager.query(
        `SELECT audit_write($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)`,
        [
          patientId,
          metadata.tableName,
          saved.id,
          previous ? 'UPDATE' : 'INSERT',
          field,
          oldValue === undefined ? null : JSON.stringify(oldValue),
          JSON.stringify(newValue),
        ],
      );

    const next = toRow(saved);
    if (!previous) {
      await write(null, undefined, next);
      return;
    }

    // `id` is logged too: it links the new version to the one it replaced.
    const before = toRow(previous);
    for (const [field, value] of Object.entries(next)) {
      if (NOT_LOGGED.has(field)) continue;
      if (JSON.stringify(before[field]) === JSON.stringify(value)) continue;
      await write(field, before[field], value);
    }
  }

  private setAuditSuppressed(manager: EntityManager, suppressed: boolean) {
    return manager.query(
      `SELECT set_config(
         'app.audit',
         (COALESCE(NULLIF(current_setting('app.audit', true), '')::jsonb, '{}'::jsonb)
           || jsonb_build_object('suppress', $1::text))::text,
         true
       )`,
      [suppressed ? 'on' : 'off'],
    );
  }
}
