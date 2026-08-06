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

// dispatch() is deliberately fire-and-forget (void, not awaited by
// callers), so tests that need to observe the async fetch outcome must
// flush the microtask queue after calling it.
function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

const envelope: N8nWebhookEnvelope = {
  var: 'Alerta',
  query: { nombre: 'Ana' },
};

describe('N8nWebhookService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not call fetch when N8N_WEBHOOK_URL is blank', () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch');
    const service = new N8nWebhookService(buildConfig(''));

    service.dispatch(envelope);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('POSTs the envelope as JSON to the configured URL', () => {
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 200 }));
    const service = new N8nWebhookService(
      buildConfig('https://n8n.example.test/webhook/notificacion'),
    );

    // fetch() is invoked synchronously inside the async send() body, before
    // its first await, so it's already been called once dispatch() returns.
    service.dispatch(envelope);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://n8n.example.test/webhook/notificacion');
    expect(options.method).toBe('POST');
    expect((options.headers as Record<string, string>)['content-type']).toBe(
      'application/json',
    );
    expect(JSON.parse(options.body as string)).toEqual(envelope);
  });

  it('does not block the caller and logs a warning when fetch rejects', async () => {
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('boom'));
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const service = new N8nWebhookService(
      buildConfig('https://n8n.example.test/webhook/notificacion'),
    );

    const result = service.dispatch(envelope);

    expect(result).toBeUndefined();
    expect(warnSpy).not.toHaveBeenCalled(); // hasn't settled yet — call was not awaited
    await flushMicrotasks();
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

    service.dispatch(envelope);
    await flushMicrotasks();

    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('passes an AbortSignal that aborts after the configured timeout', () => {
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

    service.dispatch(envelope);
    expect(capturedSignal?.aborted).toBe(false);

    jest.advanceTimersByTime(1000);
    expect(capturedSignal?.aborted).toBe(true);

    jest.useRealTimers();
  });
});
