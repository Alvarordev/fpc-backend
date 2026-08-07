import { Injectable } from '@nestjs/common';
import {
  DataSource,
  DeepPartial,
  EntityManager,
  EntityTarget,
  FindOptionsWhere,
  ObjectLiteral,
} from 'typeorm';

type Versioned = ObjectLiteral & { isCurrent: boolean };

@Injectable()
export class HistoryVersioningService {
  constructor(private readonly dataSource: DataSource) {}

  async replaceCurrent<T extends Versioned>(
    entity: EntityTarget<T>,
    currentWhere: FindOptionsWhere<T>,
    values: DeepPartial<T>,
    manager?: EntityManager,
  ): Promise<T> {
    if (manager)
      return this.replaceWithManager(manager, entity, currentWhere, values);
    return this.dataSource.transaction(async (manager) => {
      return this.replaceWithManager(manager, entity, currentWhere, values);
    });
  }

  private async replaceWithManager<T extends Versioned>(
    manager: EntityManager,
    entity: EntityTarget<T>,
    currentWhere: FindOptionsWhere<T>,
    values: DeepPartial<T>,
  ): Promise<T> {
    const repository = manager.getRepository(entity);
    await repository
      .createQueryBuilder()
      .update()
      .set({ isCurrent: false } as never)
      .where(currentWhere)
      .execute();
    return repository.save(repository.create({ ...values, isCurrent: true }));
  }
}
