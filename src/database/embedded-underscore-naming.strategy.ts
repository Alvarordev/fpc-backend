import { DefaultNamingStrategy, NamingStrategyInterface } from 'typeorm';

/**
 * TypeORM's DefaultNamingStrategy.columnName() combines an embedded prefix
 * with the inner column name as `camelCase(prefix) + titleCase(name)` (e.g.
 * `travel_time_to_hospital` + `value_min` becomes
 * `travelTimeToHospitalValue_min`), which conflicts with this codebase's
 * convention of explicit snake_case column names everywhere else. This
 * override joins prefix and name with underscores instead, so embedded
 * columns land on the exact names written in the migrations.
 */
export class EmbeddedUnderscoreNamingStrategy
  extends DefaultNamingStrategy
  implements NamingStrategyInterface
{
  columnName(
    propertyName: string,
    customName: string | undefined,
    embeddedPrefixes: string[],
  ): string {
    const name = customName || propertyName;
    if (embeddedPrefixes.length) return [...embeddedPrefixes, name].join('_');
    return name;
  }
}
