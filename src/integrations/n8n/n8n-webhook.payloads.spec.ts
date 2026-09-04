import {
  buildAlertaDerivarEnvelope,
  buildAlertaEnvelope,
  buildAlertaResueltaEnvelope,
  buildCitaEnvelope,
  buildRegistroEnvelope,
} from './n8n-webhook.payloads';

describe('n8n webhook payload builders', () => {
  it('builds the Alerta envelope with the exact key set', () => {
    expect(
      buildAlertaEnvelope({
        ticketNumber: 'ALT-2026-1001',
        patientFullName: 'Ana Paciente',
        patientDni: '12345678',
        patientPhone: '999111222',
        title: 'Falta de medicamento',
        description: 'Descripción del caso',
        healthCenterName: 'Hospital Central',
        severity: 'HIGH',
      }),
    ).toEqual({
      var: 'Alerta',
      query: {
        nombre: 'Ana Paciente',
        DNI: '12345678',
        celular: '999111222',
        titulo: 'Falta de medicamento',
        descripcion: 'Descripción del caso',
        centro_salud: 'Hospital Central',
        gravedad: 'HIGH',
        ticket: 'ALT-2026-1001',
      },
    });
  });

  it('builds AlertaResuelta with the "Alerta resuelta: " title prefix', () => {
    const envelope = buildAlertaResueltaEnvelope({
      ticketNumber: 'ALT-2026-1001',
      patientFullName: 'Ana Paciente',
      patientDni: '12345678',
      patientPhone: '999111222',
      title: 'Falta de medicamento',
      description: 'Descripción del caso',
      healthCenterName: 'Hospital Central',
      severity: 'HIGH',
    });

    expect(envelope.var).toBe('AlertaResuelta');
    expect(envelope.query.titulo).toBe('Alerta resuelta: Falta de medicamento');
    expect(envelope.query.descripcion).toBe('Descripción del caso');
  });

  it('builds AlertaDerivar with the derivation title/description and no separate notes field', () => {
    const envelope = buildAlertaDerivarEnvelope({
      ticketNumber: 'ALT-2026-1001',
      patientFullName: 'Ana Paciente',
      patientDni: '12345678',
      patientPhone: '999111222',
      title: 'Falta de medicamento',
      derivedTo: 'Defensoría del Paciente',
      healthCenterName: 'Hospital Central',
      severity: 'HIGH',
    });

    expect(envelope.var).toBe('AlertaDerivar');
    expect(envelope.query.titulo).toBe('Alerta derivada: Falta de medicamento');
    expect(envelope.query.descripcion).toBe(
      'Alerta derivada a: Defensoría del Paciente',
    );
  });

  it('builds Cita with fallbacks for motivo, hora, and especialidad, and no ticket key', () => {
    const envelope = buildCitaEnvelope({
      patientFullName: 'Ana Paciente',
      patientDni: '12345678',
      patientPhone: '999111222',
      patientEmail: null,
      difficulties: null,
      appointmentDate: null,
      appointmentTime: null,
      specialty: null,
    });

    expect(envelope).toEqual({
      var: 'Cita',
      query: {
        nombre: 'Ana Paciente',
        DNI: '12345678',
        celular: '999111222',
        correo: '',
        motivo: 'Cita médica programada',
        fecha: '',
        hora: '',
        especialidad: 'General',
      },
    });
    expect(envelope.query).not.toHaveProperty('ticket');
  });

  it('truncates appointmentTime to HH:mm and passes through supplied values', () => {
    const envelope = buildCitaEnvelope({
      patientFullName: 'Ana Paciente',
      patientDni: '12345678',
      patientPhone: '999111222',
      patientEmail: 'ana@example.test',
      difficulties: 'Sin transporte',
      appointmentDate: '2026-03-04',
      appointmentTime: '14:30:00',
      specialty: 'Oncología',
    });

    expect(envelope.query).toMatchObject({
      correo: 'ana@example.test',
      motivo: 'Sin transporte',
      fecha: '2026-03-04',
      hora: '14:30',
      especialidad: 'Oncología',
    });
  });

  it('builds Registro with the exact key set and condicion values', () => {
    expect(
      buildRegistroEnvelope({
        fullName: 'Ana Paciente',
        dni: '12345678',
        phone: '999111222',
        email: null,
        diagnosis: 'En evaluación',
        condition: 'paciente',
      }),
    ).toEqual({
      var: 'Registro',
      query: {
        nombre: 'Ana Paciente',
        DNI: '12345678',
        celular: '999111222',
        correo: '',
        diagnostico: 'En evaluación',
        condicion: 'paciente',
      },
    });
  });

  it('uses acompañante for the companion condicion value', () => {
    const envelope = buildRegistroEnvelope({
      fullName: 'Luis Acompañante',
      dni: '87654321',
      phone: '999222333',
      email: 'luis@example.test',
      diagnosis: 'En evaluación',
      condition: 'acompañante',
    });

    expect(envelope.query.condicion).toBe('acompañante');
    expect(envelope.query.correo).toBe('luis@example.test');
  });

  it('sends an empty webhook phone when the patient phone is unknown', () => {
    const envelope = buildRegistroEnvelope({
      fullName: 'Paciente Histórico',
      dni: '',
      phone: null,
      email: null,
      diagnosis: 'En evaluación',
      condition: 'paciente',
    });

    expect(envelope.query.celular).toBe('');
  });
});
