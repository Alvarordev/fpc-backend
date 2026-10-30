import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';

function serviceWith(env: Record<string, string>) {
  return new EmailService({
    get: (key: string) => env[key],
  } as unknown as ConfigService);
}

describe('EmailService', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 'email-1' }),
    });
    global.fetch = fetchMock;
  });

  const base = { RESEND_API_KEY: 'key', EMAIL_FROM: 'SEPA <no-reply@x.pe>' };

  function sentBody(): Record<string, unknown> {
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    return JSON.parse(init.body as string) as Record<string, unknown>;
  }

  it('sends to the real recipient without EMAIL_OVERRIDE_TO', async () => {
    const result = await serviceWith(base).send({
      to: 'paciente@x.pe',
      subject: 'Recordatorio',
      text: 'Hola',
    });
    expect(result).toEqual({ status: 'SENT', id: 'email-1' });
    expect(sentBody()).toMatchObject({
      to: ['paciente@x.pe'],
      subject: 'Recordatorio',
    });
  });

  it('redirects every email to EMAIL_OVERRIDE_TO and keeps the original recipient in the subject', async () => {
    await serviceWith({ ...base, EMAIL_OVERRIDE_TO: 'qa@x.pe' }).send({
      to: ['a@x.pe', ' b@x.pe '],
      subject: 'Recordatorio',
      text: 'Hola',
    });
    expect(sentBody()).toMatchObject({
      to: ['qa@x.pe'],
      subject: '[para: a@x.pe, b@x.pe] Recordatorio',
    });
  });
});
