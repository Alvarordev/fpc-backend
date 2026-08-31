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

export class DashboardManagementResponseDto {
  @ApiProperty({ type: DashboardIndicatorMetaDto })
  meta!: DashboardIndicatorMetaDto;

  @ApiProperty()
  sisAffiliatedViaSepa!: number;

  @ApiProperty()
  essaludAffiliatedViaSepa!: number;

  @ApiProperty()
  primaryCareViaSepa!: number;

  @ApiProperty()
  referredViaSepa!: number;

  @ApiProperty({ type: DashboardIndicatorDistributionDto })
  specialtyForDiagnosis!: DashboardIndicatorDistributionDto;

  @ApiProperty()
  diagnosticRuledOutViaSepa!: number;

  @ApiProperty()
  diagnosticConfirmedViaSepa!: number;

  @ApiProperty()
  treatmentViaSepa!: number;

  @ApiProperty()
  transportationViaSepa!: number;

  @ApiProperty({ type: DashboardIndicatorDistributionDto })
  transportationSepaProviders!: DashboardIndicatorDistributionDto;

  @ApiProperty()
  shelterViaSepa!: number;

  @ApiProperty({ type: DashboardIndicatorDistributionDto })
  shelterSepaProviders!: DashboardIndicatorDistributionDto;
}

export class DashboardProductivityResponseDto {
  @ApiProperty({ type: DashboardIndicatorMetaDto })
  meta!: DashboardIndicatorMetaDto;

  @ApiProperty({
    description:
      'Average days from enrollment to SIS affiliation (affiliated_via_sepa only). Null when unknown.',
    nullable: true,
  })
  avgDaysEnrollmentToSis!: number | null;

  @ApiProperty({ nullable: true })
  avgDaysPrimaryCareToDiagnosis!: number | null;

  @ApiProperty({ nullable: true })
  avgDaysDiagnosisToTreatment!: number | null;

  @ApiProperty()
  activePatients!: number;

  @ApiProperty()
  benefitSupport!: number;

  @ApiProperty()
  benefitPsychooncology!: number;

  @ApiProperty()
  benefitEducationalTalks!: number;

  @ApiProperty()
  allThreeBenefits!: number;
}

export class DashboardAdherenceResponseDto {
  @ApiProperty({ type: DashboardIndicatorMetaDto })
  meta!: DashboardIndicatorMetaDto;

  @ApiProperty({
    description:
      'Percentage of completed vs scheduled chemo/radio sessions where both values are known.',
  })
  chemoRadioCompliancePct!: number;

  @ApiProperty()
  hormonalCompleted!: number;

  @ApiProperty()
  hormonalPatients!: number;

  @ApiProperty()
  withAccessBarriers!: number;

  @ApiProperty()
  orientedRegardingBarriers!: number;

  @ApiProperty()
  abandonedWithBarriers!: number;

  @ApiProperty()
  interruptedAdverseReaction!: number;

  @ApiProperty()
  palliativeNoActiveTreatment!: number;
}

export class DashboardAbandonmentResponseDto {
  @ApiProperty({ type: DashboardIndicatorMetaDto })
  meta!: DashboardIndicatorMetaDto;

  @ApiProperty({ type: DashboardIndicatorDistributionDto })
  dropoutReasons!: DashboardIndicatorDistributionDto;

  @ApiProperty()
  voluntary!: number;

  @ApiProperty()
  unlocatable!: number;

  @ApiProperty()
  deceased!: number;

  @ApiProperty()
  other!: number;
}
