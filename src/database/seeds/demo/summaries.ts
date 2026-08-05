import {
  PatientSummary,
  PatientSummaryStatus,
} from '../../entities/patient-summary.entity';
import type { DemoContext } from './context';
import type { PatientFollowUps } from './follow-ups';
import { addDays } from './rng';

const READY_SUMMARY = [
  'Paciente en tratamiento oncológico activo con seguimiento telefónico regular.',
  'Mantiene adherencia al esquema indicado y acude a sus controles, aunque el traslado desde su distrito le supone un costo significativo.',
  'En la última llamada refirió molestias leves posteriores al ciclo, sin necesidad de atención de urgencia.',
  'Cuenta con soporte familiar y un informante principal identificado.',
  'Pendiente: confirmar la fecha de su próxima cita de oncología.',
].join(' ');

/**
 * AI summaries are generated on demand, so most patients have none. Three rows
 * cover the states the UI has to render: ready, queued and failed.
 */
export async function seedPatientSummaries(
  { manager, rng, now }: DemoContext,
  histories: PatientFollowUps[],
): Promise<void> {
  const candidates = histories.filter(
    (history) =>
      history.enrollment !== null && history.demoPatient.patient.isActive,
  );
  const [ready, pending, failed] = rng.pickN(candidates, 3);
  if (!ready || !pending || !failed) return;

  const completedAt = addDays(now, -rng.int(1, 6));

  await manager.save([
    manager.create(PatientSummary, {
      patientId: ready.demoPatient.patient.id,
      status: PatientSummaryStatus.READY,
      summary: READY_SUMMARY,
      model: 'gemini-2.0-flash',
      attemptCount: 1,
      availableAt: completedAt,
      processingStartedAt: addDays(completedAt, 0),
      completedAt,
    }),
    manager.create(PatientSummary, {
      patientId: pending.demoPatient.patient.id,
      status: PatientSummaryStatus.PENDING,
      attemptCount: 0,
      availableAt: now,
    }),
    manager.create(PatientSummary, {
      patientId: failed.demoPatient.patient.id,
      status: PatientSummaryStatus.FAILED,
      model: 'gemini-2.0-flash',
      errorCode: 'UPSTREAM_UNAVAILABLE',
      errorMessage: 'El proveedor de IA no respondió dentro del tiempo límite.',
      attemptCount: 3,
      availableAt: addDays(now, -1),
      processingStartedAt: addDays(now, -1),
    }),
  ]);
}
