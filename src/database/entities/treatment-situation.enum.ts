export enum TreatmentSituation {
  EN_ESPERA = 'EN_ESPERA',
  EN_BUSQUEDA = 'EN_BUSQUEDA',
  EN_PROCESO = 'EN_PROCESO',
  CULMINADO = 'CULMINADO',
  SUSPENDIDO = 'SUSPENDIDO',
  REMISION = 'REMISION',
  ABANDONADO = 'ABANDONADO',
  FALLECIDO = 'FALLECIDO',
  NO_APLICA = 'NO_APLICA',
}

/** Situations of a treatment the patient is still going through or seeking. */
export const ACTIVE_TREATMENT_SITUATIONS: readonly string[] = [
  TreatmentSituation.EN_ESPERA,
  TreatmentSituation.EN_BUSQUEDA,
  TreatmentSituation.EN_PROCESO,
];
