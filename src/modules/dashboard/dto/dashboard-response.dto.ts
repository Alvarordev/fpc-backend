import { ApiProperty } from '@nestjs/swagger';
import { DashboardPeriod } from './dashboard-query.dto';

export class DashboardMetaDto {
  @ApiProperty({ enum: DashboardPeriod }) period!: DashboardPeriod;
  @ApiProperty() year!: number;
  @ApiProperty({ nullable: true, minimum: 1, maximum: 12 })
  month!: number | null;
  @ApiProperty({ example: 'America/Lima' }) timezone!: string;
  @ApiProperty({ format: 'date-time' }) startsAt!: string;
  @ApiProperty({ format: 'date-time' }) endsAt!: string;
}

export class DashboardSummaryDto {
  @ApiProperty({
    description: 'Enrollment records created in the selected period.',
  })
  enrollmentEvents!: number;
  @ApiProperty({
    description:
      'Distinct patients with an enrollment created in the selected period.',
  })
  cohortPatients!: number;
  @ApiProperty() activePatients!: number;
  @ApiProperty() inactivePatients!: number;
  @ApiProperty({
    description: 'Patients marked deceased by date or deactivation reason.',
  })
  deceasedPatients!: number;
  @ApiProperty({
    description: 'Inactive cohort patients who are not deceased.',
  })
  dropoutPatients!: number;
  @ApiProperty({
    description:
      'Psycho-oncology appointments scheduled in the selected period, regardless of status.',
  })
  sessions!: number;
  @ApiProperty() completedSessions!: number;
  @ApiProperty({
    description:
      'Completed sessions divided by all scheduled sessions, from 0 to 100.',
  })
  completionRate!: number;
}

export class DashboardDistributionItemDto {
  @ApiProperty({ example: 'LIMA' }) label!: string;
  @ApiProperty({ example: 42 }) count!: number;
}

export class DashboardDistributionsDto {
  @ApiProperty({
    type: DashboardDistributionItemDto,
    isArray: true,
    description: 'Top six values; remaining values are combined as Otros.',
  })
  gender!: DashboardDistributionItemDto[];
  @ApiProperty({
    type: DashboardDistributionItemDto,
    isArray: true,
    description:
      'Current diagnosis for cohort patients. Top six values; remaining values are combined as Otros.',
  })
  diagnoses!: DashboardDistributionItemDto[];
  @ApiProperty({
    type: DashboardDistributionItemDto,
    isArray: true,
    description:
      'Current treatment for cohort patients. Top six values; remaining values are combined as Otros.',
  })
  treatments!: DashboardDistributionItemDto[];
  @ApiProperty({
    type: DashboardDistributionItemDto,
    isArray: true,
    description:
      'Current cancer stage for cohort patients. Top six values; remaining values are combined as Otros.',
  })
  cancerStages!: DashboardDistributionItemDto[];
}

export class DashboardTrendPointDto {
  @ApiProperty({
    example: '2026-08-01',
    description:
      'A Lima calendar day for month periods, or YYYY-MM for year periods.',
  })
  period!: string;
  @ApiProperty() enrollmentEvents!: number;
  @ApiProperty() sessions!: number;
  @ApiProperty() completedSessions!: number;
}

export class DashboardTableItemDto {
  @ApiProperty({ example: 'Instituto Nacional de Enfermedades Neoplasicas' })
  name!: string;
  @ApiProperty({ example: 30 }) count!: number;
}

export class DashboardResponseDto {
  @ApiProperty({ type: DashboardMetaDto }) meta!: DashboardMetaDto;
  @ApiProperty({ type: DashboardSummaryDto }) summary!: DashboardSummaryDto;
  @ApiProperty({ type: DashboardDistributionsDto })
  distributions!: DashboardDistributionsDto;
  @ApiProperty({
    type: DashboardTrendPointDto,
    isArray: true,
    description:
      'A zero-filled enrollment and session series for the selected period.',
  })
  trend!: DashboardTrendPointDto[];
  @ApiProperty({
    type: DashboardTableItemDto,
    isArray: true,
    description:
      'Up to eight hospitals using primary health center, then current medical appointment, treatment, and diagnosis precedence.',
  })
  hospitals!: DashboardTableItemDto[];
  @ApiProperty({
    type: DashboardTableItemDto,
    isArray: true,
    description:
      'Up to eight regions using primary health center department, then primary address, then birth department precedence.',
  })
  regions!: DashboardTableItemDto[];
  @ApiProperty({
    type: DashboardTableItemDto,
    isArray: true,
    description: 'Up to eight treatment referral pairs (origin → destination).',
  })
  referrals!: DashboardTableItemDto[];
}
