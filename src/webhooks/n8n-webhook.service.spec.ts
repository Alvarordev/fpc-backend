import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { N8nWebhookService } from './n8n-webhook.service';
import { N8nWebhookEnvelope } from './n8n-webhook.events';

function buildConfig(url: string, timeoutMs = 5000) {
  return {
    get: jest.fn().mockReturnValue(url),
    getOrThrow: jest.fn().mockReturnValue(timeoutMs),
  } as unknown as ConfigService;
}

const envelope: N8nWebhookEnvelope = {
  var: 'Alerta',
  query: { nombre: 'Ana' },
};

describe('N8nWebhookService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not call fetch when N8N_WEBHOOK_URL is blank', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch');
    const service = new N8nWebhookService(buildConfig(''));

    await service.dispatch(envelope);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('POSTs the envelope as JSON to the configured URL', async () => {
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 200 }));
    const service = new N8nWebhookService(
      buildConfig('https://n8n.example.test/webhook/notificacion'),
    );

    await service.dispatch(envelope);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://n8n.example.test/webhook/notificacion');
    expect(options.method).toBe('POST');
    expect((options.headers as Record<string, string>)['content-type']).toBe(
      'application/json',
    );
    expect(JSON.parse(options.body as string)).toEqual(envelope);
  });

  it('logs a warning and does not throw when fetch rejects', async () => {
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('boom'));
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const service = new N8nWebhookService(
      buildConfig('https://n8n.example.test/webhook/notificacion'),
    );

    await expect(service.dispatch(envelope)).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('logs a warning on a non-2xx response without throwing', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 500 }));
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const service = new N8nWebhookService(
      buildConfig('https://n8n.example.test/webhook/notificacion'),
    );

    await expect(service.dispatch(envelope)).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('passes an AbortSignal that aborts after the configured timeout', async () => {
    jest.useFakeTimers();
    let capturedSignal: AbortSignal | undefined;
    jest.spyOn(globalThis, 'fetch').mockImplementation((_url, options) => {
      capturedSignal = (options as RequestInit).signal ?? undefined;
      return new Promise(() => {
        /* never resolves — we only care about the abort signal */
      });
    });
    const service = new N8nWebhookService(
      buildConfig('https://n8n.example.test/webhook/notificacion', 1000),
    );

    void service.dispatch(envelope);
    await Promise.resolve();
    expect(capturedSignal?.aborted).toBe(false);

    jest.advanceTimersByTime(1000);
    expect(capturedSignal?.aborted).toBe(true);

    jest.useRealTimers();
  });
});
