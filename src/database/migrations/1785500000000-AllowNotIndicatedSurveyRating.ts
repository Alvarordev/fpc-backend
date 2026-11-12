import { MigrationInterface, QueryRunner } from 'typeorm';

// Las encuestas aceptan "No indica" (rating 0), igual que la encuesta de
// enrolamiento. El 0 se excluye de promedios y distribuciones.
export class AllowNotIndicatedSurveyRating1785500000000 implements MigrationInterface {
  name = 'AllowNotIndicatedSurveyRating1785500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await dropRatingChecks(queryRunner);
    await queryRunner.query(
      `ALTER TABLE "surveys" ADD CONSTRAINT "CHK_surveys_rating" CHECK ("rating" BETWEEN 0 AND 5)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "surveys" WHERE "rating" = 0`);
    await dropRatingChecks(queryRunner);
    await queryRunner.query(
      `ALTER TABLE "surveys" ADD CONSTRAINT "CHK_surveys_rating" CHECK ("rating" BETWEEN 1 AND 5)`,
    );
  }
}

async function dropRatingChecks(queryRunner: QueryRunner) {
  await queryRunner.query(`
    DO $$
    DECLARE c record;
    BEGIN
      FOR c IN
        SELECT conname FROM pg_constraint
        WHERE conrelid = 'surveys'::regclass AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%rating%'
      LOOP
        EXECUTE format('ALTER TABLE surveys DROP CONSTRAINT %I', c.conname);
      END LOOP;
    END $$;
  `);
}
