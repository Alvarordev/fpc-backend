import {
  createdEventDescription,
  createdEventTitle,
  derivedEventDescription,
  derivedEventTitle,
  resolvedEventDescription,
  statusChangedEventDescription,
} from './alert-events.service';

describe('alert event string builders', () => {
  it('formats the CREATED event title with the ticket number', () => {
    expect(createdEventTitle('ALT-2026-1001')).toBe(
      'Alerta Reportada [Ticket ALT-2026-1001]',
    );
  });

  it('formats the CREATED event description with the reporting agent and title', () => {
    expect(createdEventDescription('Ana Agente', 'Falta de medicamento')).toBe(
      'Alerta iniciada por Ana Agente: "Falta de medicamento"',
    );
  });

  it('formats the RESOLVED event description with the resolver name', () => {
    expect(resolvedEventDescription('Ana Agente')).toBe(
      'El caso fue marcado como resuelto por Ana Agente.',
    );
  });

  it('formats the DERIVED event title with the destination', () => {
    expect(derivedEventTitle('Defensoría del Paciente')).toBe(
      'Alerta Derivada a: Defensoría del Paciente',
    );
  });

  it('uses the supplied derivation notes verbatim when present', () => {
    expect(
      derivedEventDescription('Se coordinó con la trabajadora social'),
    ).toBe('Se coordinó con la trabajadora social');
  });

  it('falls back to the default derivation description when notes are null', () => {
    expect(derivedEventDescription(null)).toBe(
      'Se derivó la gestión a la entidad externa indicada.',
    );
  });

  it('formats the STATUS_CHANGED event description with old and new status', () => {
    expect(statusChangedEventDescription('RESOLVED', 'ACTIVE')).toBe(
      'El estado cambió de RESOLVED a ACTIVE.',
    );
  });
});
