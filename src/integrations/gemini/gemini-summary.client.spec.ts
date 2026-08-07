import { ConfigService } from '@nestjs/config';
import {
  GeminiSummaryClient,
  sanitizeSummaryText,
} from './gemini-summary.client';
import { PatientSummaryErrorCode } from '../../patient-summaries/patient-summary-error';

describe('GeminiSummaryClient', () => {
  it('fails through the normalized configuration pipeline when no key is set', async () => {
    const client = new GeminiSummaryClient({
      get: jest.fn().mockReturnValue(''),
      getOrThrow: jest.fn(),
    } as unknown as ConfigService);

    await expect(client.generate('prompt')).rejects.toMatchObject({
      code: PatientSummaryErrorCode.CONFIGURATION,
      retryable: false,
      message: 'GEMINI_API_KEY is not configured',
    });
  });
});

describe('sanitizeSummaryText', () => {
  it('strips the intro sentence and markdown bold/bullets from a real Gemini response', () => {
    const raw =
      'Aquí presento el resumen clínico y operativo solicitado: **Resumen Clínico y Operativo** ' +
      '* **Perfil del Paciente:** Paciente de 26 años, residente en Surquillo (Lima), afiliado a ESSALUD. ' +
      '* **Diagnóstico:** Leucemia en estadio 3 (diagnosticada el 10/12/2025).';

    const result = sanitizeSummaryText(raw);

    expect(result).not.toContain('*');
    expect(result).not.toMatch(/^Aquí presento/i);
    expect(result).toContain('Perfil del Paciente');
    expect(result).toContain('Diagnóstico');
  });

  it('leaves plain prose untouched', () => {
    const raw =
      'Paciente de 26 años con leucemia en estadio 3, en quimioterapia mensual.';

    expect(sanitizeSummaryText(raw)).toBe(raw);
  });
});
