import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
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
  if (message.nestedCode)
    return { message: message.text, code: message.nestedCode };
  return { message: message.text, code };
}

function readMessage(
  raw: unknown,
  fallback: string,
): { text: string; nestedCode?: string } {
  if (typeof raw === 'string' && raw.trim()) return { text: raw };
  if (Array.isArray(raw)) {
    const parts = raw.filter(
      (item): item is string => typeof item === 'string',
    );
    return {
      text: parts.length
        ? parts
            .map((part) => (/[.!?]$/.test(part) ? part : `${part}.`))
            .join(' ')
        : fallback,
    };
  }
  if (raw && typeof raw === 'object') {
    const nested = raw as Record<string, unknown>;
    const nestedCode =
      typeof nested.code === 'string' ? nested.code : undefined;
    const inner = readMessage(nested.message, fallback);
    return { text: inner.text, nestedCode: nestedCode ?? inner.nestedCode };
  }
  return { text: fallback };
}

// Mensajes por defecto de Nest/Express (en inglés) que nunca deben llegar al usuario.
const DEFAULT_MESSAGES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]:
    'Los datos enviados no son válidos. Revisa el formulario.',
  [HttpStatus.UNAUTHORIZED]: 'Tu sesión expiró. Vuelve a iniciar sesión.',
  [HttpStatus.FORBIDDEN]: 'No tienes permiso para hacer esta acción.',
  [HttpStatus.NOT_FOUND]: 'No se encontró lo que buscas.',
  [HttpStatus.CONFLICT]: 'La acción entra en conflicto con datos existentes.',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'El archivo es demasiado grande.',
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: 'Ese tipo de archivo no está permitido.',
  [HttpStatus.TOO_MANY_REQUESTS]:
    'Demasiados intentos. Espera un momento y vuelve a probar.',
  [HttpStatus.INTERNAL_SERVER_ERROR]:
    'Ocurrió un error inesperado. Intenta de nuevo.',
  [HttpStatus.SERVICE_UNAVAILABLE]:
    'El servicio no está disponible. Intenta de nuevo en unos minutos.',
};

const ENGLISH_DEFAULT =
  /^(Bad Request|Unauthorized|Forbidden( resource)?|Not Found|Conflict|Payload Too Large|Unsupported Media Type|Too Many Requests|ThrottlerException.*|Internal Server Error|Service Unavailable|Http Exception|Cannot (GET|POST|PATCH|PUT|DELETE) .*|Unexpected (token|end).*|request entity too large)$/i;

function readableMessage(status: number, message: string): string {
  if (!message || ENGLISH_DEFAULT.test(message.trim())) {
    return (
      DEFAULT_MESSAGES[status] ??
      (status >= 500
        ? DEFAULT_MESSAGES[HttpStatus.INTERNAL_SERVER_ERROR]
        : DEFAULT_MESSAGES[HttpStatus.BAD_REQUEST])
    );
  }
  return message;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    if (!(exception instanceof HttpException)) {
      this.logger.error(
        `${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const flat =
      exception instanceof HttpException
        ? flattenHttpException(exception)
        : { message: '' };
    const message = readableMessage(status, flat.message);
    const code = flat.code;

    response.status(status).json({
      statusCode: status,
      ...(code ? { code } : {}),
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
