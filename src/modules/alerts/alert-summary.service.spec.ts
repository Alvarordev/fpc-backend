import {
  AlertSummaryInput,
  buildExecutiveSummary,
} from './alert-summary.service';
import {
  AlertCategory,
  AlertSeverity,
  AlertStatus,
} from '../../database/entities/alert.entity';

// Fixed instant used across cases: 2026-03-04T15:30:00Z is 10:30 in
// America/Lima (UTC-5) — this is the timezone regression check.
const CREATED_AT = new Date('2026-03-04T15:30:00Z');
const RESOLVED_AT = new Date('2026-03-06T20:00:00Z'); // 15:00 Lima time

function baseInput(
  overrides: Partial<AlertSummaryInput> = {},
): AlertSummaryInput {
  return {
    title: 'Falta de medicamento',
    healthCenterName: 'Hospital Central',
    status: AlertStatus.ACTIVE,
    severity: AlertSeverity.HIGH,
    createdAt: CREATED_AT,
    createdByName: 'Ana Agente',
    derivedTo: null,
    derivationNotes: null,
    derivedEventDescription: null,
    commentsCount: 0,
    resolvedAt: null,
    resolvedByName: null,
    ...overrides,
  };
}

describe('buildExecutiveSummary', () => {
  it('formats the creation line and timezone-converts the timestamp to Lima time', () => {
    const summary = buildExecutiveSummary(baseInput());

    expect(summary).toBe(
      '📋 RESUMEN EJECUTIVO IA:\n' +
        "La alerta 'Falta de medicamento' reportada en 'Hospital Central' se encuentra actualmente en estado ACTIVA (Severidad: HIGH). " +
        'Iniciada el 04/03/2026 10:30 por Ana Agente. ' +
        'Se recomienda seguimiento activo con el centro de salud para la resolución del incidente.',
    );
  });

  it('includes the derivation block with notes when derivedTo and notes are set', () => {
    const summary = buildExecutiveSummary(
      baseInput({
        derivedTo: 'Defensoría del Paciente',
        derivationNotes: 'Se coordinó con la trabajadora social',
      }),
    );

    expect(summary).toContain("Caso derivado a: 'Defensoría del Paciente'. ");
    expect(summary).toContain(
      'Nota de derivación: "Se coordinó con la trabajadora social". ',
    );
  });

  it('falls back to the DERIVED event description when derivedTo is null', () => {
    const summary = buildExecutiveSummary(
      baseInput({ derivedEventDescription: 'Coordinado con la posta' }),
    );

    expect(summary).toContain("Caso derivado a: 'Coordinado con la posta'. ");
  });

  it('treats blank derivation notes as absent', () => {
    const summary = buildExecutiveSummary(
      baseInput({ derivedTo: 'Defensoría', derivationNotes: '   ' }),
    );

    expect(summary).not.toContain('Nota de derivación');
  });

  it('omits the derivation block entirely when there is no derivation', () => {
    const summary = buildExecutiveSummary(baseInput());

    expect(summary).not.toContain('derivada');
    expect(summary).not.toContain('Caso derivado');
  });

  it('pluralizes the comment count line', () => {
    const summary = buildExecutiveSummary(baseInput({ commentsCount: 3 }));

    expect(summary).toContain(
      'Cuenta con 3 avance(s) registrado(s) en la línea de tiempo. ',
    );
  });

  it('omits the comment count line when there are no comments', () => {
    const summary = buildExecutiveSummary(baseInput({ commentsCount: 0 }));

    expect(summary).not.toContain('avance(s)');
  });

  it('closes with the resolver name and Lima-converted timestamp when resolved by an agent', () => {
    const summary = buildExecutiveSummary(
      baseInput({
        status: AlertStatus.RESOLVED,
        resolvedAt: RESOLVED_AT,
        resolvedByName: 'Carlos Resolutor',
      }),
    );

    expect(summary).toContain(
      'Atención concluida y resuelta el 06/03/2026 15:00 por Carlos Resolutor.',
    );
    expect(summary).not.toContain('Se recomienda seguimiento activo');
  });

  it('falls back to "Agente" when resolved but no resolver name is available', () => {
    const summary = buildExecutiveSummary(
      baseInput({
        status: AlertStatus.RESOLVED,
        resolvedAt: RESOLVED_AT,
        resolvedByName: null,
      }),
    );

    expect(summary).toContain('resuelta el 06/03/2026 15:00 por Agente.');
  });

  it('recommends follow-up when the alert is still active regardless of category', () => {
    const summary = buildExecutiveSummary(
      baseInput({ status: AlertStatus.ACTIVE }),
    );

    expect(summary).toContain(
      'Se recomienda seguimiento activo con el centro de salud para la resolución del incidente.',
    );
    expect(AlertCategory.GENERAL).toBe('GENERAL'); // sanity: category isn't part of the template
  });
});
