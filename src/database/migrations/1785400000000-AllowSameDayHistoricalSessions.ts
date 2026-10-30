import { MigrationInterface, QueryRunner } from 'typeorm';

// Cada sesión histórica de psicooncología reserva un horario sin hora de inicio
// ni fin. El rango vacío se tomaba como «todo el día», así que dos sesiones
// históricas del mismo voluntario (p. ej. el voluntario no identificado) en la
// misma fecha chocaban con un 500. La restricción ahora solo cubre los horarios
// con hora, que son los únicos que pueden solaparse de verdad.
export class AllowSameDayHistoricalSessions1785400000000 implements MigrationInterface {
  name = 'AllowSameDayHistoricalSessions1785400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "volunteer_availability" DROP CONSTRAINT "EX_volunteer_availability_no_overlap"',
    );
    await queryRunner.query(
      `ALTER TABLE "volunteer_availability"
       ADD CONSTRAINT "EX_volunteer_availability_no_overlap"
       EXCLUDE USING gist (
         "volunteer_id" WITH =,
         "date" WITH =,
         tsrange("date" + "start_time", "date" + "end_time", '[)') WITH &&
       ) WHERE ("start_time" IS NOT NULL AND "end_time" IS NOT NULL)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "volunteer_availability" DROP CONSTRAINT "EX_volunteer_availability_no_overlap"',
    );
    await queryRunner.query(
      `ALTER TABLE "volunteer_availability"
       ADD CONSTRAINT "EX_volunteer_availability_no_overlap"
       EXCLUDE USING gist (
         "volunteer_id" WITH =,
         "date" WITH =,
         tsrange("date" + "start_time", "date" + "end_time", '[)') WITH &&
       )`,
    );
  }
}
