import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import { Request, Response } from 'express';

export function flattenHttpException(exception: HttpException): {
  message: string;
  code?: string;
} {
  return readErrorPayload(exception.getResponse(), exception.message);
}

function readErrorPayload(
  response: string | object,
  fallback: string,
): { message: string; code?: string } {
  if (typeof response === 'string') return { message: response };
  if (!response || typeof response !== 'object') return { message: fallback };

  const body = response as Record<string, unknown>;
  const code = typeof body.code === 'string' ? body.code : undefined;
  const message = readMessage(body.message, fallback);
  if (message.nestedCode) return { message: message.text, code: message.nestedCode };
  return { message: message.text, code };
}

function readMessage(
  raw: unknown,
  fallback: string,
): { text: string; nestedCode?: string } {
  if (typeof raw === 'string' && raw.trim()) return { text: raw };
  if (Array.isArray(raw)) {
    const parts = raw.filter((item): item is string => typeof item === 'string');
    return { text: parts.length ? parts.join('. ') : fallback };
  }
  if (raw && typeof raw === 'object') {
    const nested = raw as Record<string, unknown>;
    const nestedCode = typeof nested.code === 'string' ? nested.code : undefined;
    const inner = readMessage(nested.message, fallback);
    return { text: inner.text, nestedCode: nestedCode ?? inner.nestedCode };
  }
  return { text: fallback };
}

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const { message, code } = flattenHttpException(exception);

    response.status(exception.getStatus()).json({
      statusCode: exception.getStatus(),
      ...(code ? { code } : {}),
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
