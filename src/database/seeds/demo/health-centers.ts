import { HealthCenter } from '../../entities/health-center.entity';
import { HEALTH_CENTERS } from './catalog';
import type { DemoContext } from './context';

export async function seedHealthCenters({
  manager,
}: DemoContext): Promise<HealthCenter[]> {
  return manager.save(
    HEALTH_CENTERS.map((seed) =>
      manager.create(HealthCenter, {
        name: seed.name,
        slug: seed.slug,
        department: seed.department,
        isActive: seed.isActive ?? true,
      }),
    ),
  );
}
