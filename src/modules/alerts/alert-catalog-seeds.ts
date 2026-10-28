export const ALERT_CATALOG_SEEDS: {
  kind: 'alert_category' | 'alert_derivation_entity';
  code: string;
  label: string;
  sortOrder: number;
}[] = [
  { kind: 'alert_category', code: 'GENERAL', label: 'General', sortOrder: 10 },
  {
    kind: 'alert_category',
    code: 'MEDICATION_SHORTAGE',
    label: 'Falta de medicamento',
    sortOrder: 20,
  },
  {
    kind: 'alert_category',
    code: 'APPOINTMENT_DELAY',
    label: 'Retraso de cita',
    sortOrder: 30,
  },
  {
    kind: 'alert_category',
    code: 'INSURANCE_COVERAGE',
    label: 'Cobertura de seguro',
    sortOrder: 40,
  },
  {
    kind: 'alert_category',
    code: 'TRANSPORT',
    label: 'Transporte',
    sortOrder: 50,
  },
  {
    kind: 'alert_category',
    code: 'ADMINISTRATIVE',
    label: 'Administrativa',
    sortOrder: 60,
  },
  {
    kind: 'alert_category',
    code: 'PSYCHOSOCIAL',
    label: 'Psicosocial',
    sortOrder: 70,
  },
  {
    kind: 'alert_derivation_entity',
    code: 'SUSALUD',
    label: 'SUSALUD',
    sortOrder: 10,
  },
  {
    kind: 'alert_derivation_entity',
    code: 'DEFENSORIA_DEL_PUEBLO',
    label: 'Defensoría del Pueblo',
    sortOrder: 20,
  },
  {
    kind: 'alert_derivation_entity',
    code: 'MINSA',
    label: 'MINSA',
    sortOrder: 30,
  },
  {
    kind: 'alert_derivation_entity',
    code: 'SIS',
    label: 'Seguro Integral de Salud (SIS)',
    sortOrder: 40,
  },
  {
    kind: 'alert_derivation_entity',
    code: 'ESSALUD',
    label: 'EsSalud',
    sortOrder: 50,
  },
  {
    kind: 'alert_derivation_entity',
    code: 'DIRESA',
    label: 'Dirección Regional de Salud (DIRESA)',
    sortOrder: 60,
  },
];
