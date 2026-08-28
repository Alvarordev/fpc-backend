import { ApiProperty } from '@nestjs/swagger';

export class DashboardIndicatorMetaDto {
  @ApiProperty({ format: 'date' })
  from!: string;

  @ApiProperty({ format: 'date', description: 'Exclusive end date.' })
  to!: string;

  @ApiProperty({ example: 'America/Lima' })
  timezone!: string;

  @ApiProperty()
  definition!: string;

  @ApiProperty()
  population!: string;

  @ApiProperty()
  populationCount!: number;
}

export class DashboardIndicatorItemDto {
  @ApiProperty({ example: '18-29' })
  label!: string;

  @ApiProperty({ example: 42 })
  count!: number;
}

export class DashboardIndicatorDistributionDto {
  @ApiProperty({ type: DashboardIndicatorItemDto, isArray: true })
  items!: DashboardIndicatorItemDto[];

  @ApiProperty({
    description: 'Patients with a known value for this indicator.',
  })
  known!: number;

  @ApiProperty({ description: 'Patients without a value for this indicator.' })
  unknown!: number;

  @ApiProperty({
    description: 'Known divided by known plus unknown, from 0 to 100.',
  })
  coveragePct!: number;

  @ApiProperty({
    description: 'Patients included in this indicator denominator.',
  })
  population!: number;
}

export class DashboardDemographicsResponseDto {
  @ApiProperty({ type: DashboardIndicatorMetaDto })
  meta!: DashboardIndicatorMetaDto;

  @ApiProperty({ type: DashboardIndicatorDistributionDto })
  age!: DashboardIndicatorDistributionDto;

  @ApiProperty({ type: DashboardIndicatorDistributionDto })
  gender!: DashboardIndicatorDistributionDto;

  @ApiProperty({ type: DashboardIndicatorDistributionDto })
  district!: DashboardIndicatorDistributionDto;

  @ApiProperty({ type: DashboardIndicatorDistributionDto })
  province!: DashboardIndicatorDistributionDto;

  @ApiProperty({ type: DashboardIndicatorDistributionDto })
  department!: DashboardIndicatorDistributionDto;

  @ApiProperty({ type: DashboardIndicatorDistributionDto })
  zoneType!: DashboardIndicatorDistributionDto;

  @ApiProperty({ type: DashboardIndicatorDistributionDto })
  educationLevel!: DashboardIndicatorDistributionDto;

  @ApiProperty({ type: DashboardIndicatorDistributionDto })
  nativeLanguage!: DashboardIndicatorDistributionDto;

  @ApiProperty({ type: DashboardIndicatorDistributionDto })
  requiresTranslation!: DashboardIndicatorDistributionDto;

  @ApiProperty({ type: DashboardIndicatorDistributionDto })
  isWorking!: DashboardIndicatorDistributionDto;

  @ApiProperty({ type: DashboardIndicatorDistributionDto })
  insuranceType!: DashboardIndicatorDistributionDto;

  @ApiProperty({ type: DashboardIndicatorDistributionDto })
  epsProvider!: DashboardIndicatorDistributionDto;
}

export class DashboardEpidemiologyEventsDto {
  @ApiProperty()
  deaths!: number;

  @ApiProperty()
  diagnosticConfirmed!: number;

  @ApiProperty()
  diagnosticRuledOut!: number;
}

export class DashboardEpidemiologyResponseDto {
  @ApiProperty({ type: DashboardIndicatorMetaDto })
  meta!: DashboardIndicatorMetaDto;

  @ApiProperty({ type: DashboardIndicatorDistributionDto })
  currentDiagnoses!: DashboardIndicatorDistributionDto;

  @ApiProperty({ type: DashboardIndicatorDistributionDto })
  currentCancerStages!: DashboardIndicatorDistributionDto;

  @ApiProperty({ type: DashboardIndicatorDistributionDto })
  currentTreatmentTypes!: DashboardIndicatorDistributionDto;

  @ApiProperty({ type: DashboardIndicatorDistributionDto })
  currentTreatmentSituations!: DashboardIndicatorDistributionDto;

  @ApiProperty({ type: DashboardIndicatorDistributionDto })
  currentDiagnosticStatuses!: DashboardIndicatorDistributionDto;

  @ApiProperty({ type: DashboardEpidemiologyEventsDto })
  events!: DashboardEpidemiologyEventsDto;
}
