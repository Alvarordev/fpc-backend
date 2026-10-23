import { MigrationInterface, QueryRunner } from 'typeorm';

// 0 = "No indica": the patient answered the survey but gave no rating.
export class AllowEnrollmentRatingNotIndicated1784913000000
  implements MigrationInterface
{
  name = 'AllowEnrollmentRatingNotIndicated1784913000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.dropRatingChecks(queryRunner);
    await queryRunner.query(
      `ALTER TABLE "enrollments" ADD CONSTRAINT "CHK_enrollments_follow_up_quality_rating" CHECK ("follow_up_quality_rating" IS NULL OR "follow_up_quality_rating" BETWEEN 0 AND 5)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.dropRatingChecks(queryRunner);
    await queryRunner.query(
      `UPDATE "enrollments" SET "follow_up_quality_rating" = NULL WHERE "follow_up_quality_rating" = 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "enrollments" ADD CONSTRAINT "CHK_enrollments_follow_up_quality_rating" CHECK ("follow_up_quality_rating" IS NULL OR "follow_up_quality_rating" BETWEEN 1 AND 5)`,
    );
  }

  private async dropRatingChecks(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      DECLARE c record;
      BEGIN
        FOR c IN
          SELECT conname FROM pg_constraint
          WHERE conrelid = 'enrollments'::regclass
            AND contype = 'c'
            AND pg_get_constraintdef(oid) LIKE '%quality_rating%'
        LOOP
          EXECUTE format('ALTER TABLE "enrollments" DROP CONSTRAINT %I', c.conname);
        END LOOP;
      END $$;
    `);
  }
}
