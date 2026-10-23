import { BadRequestException, ConflictException } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

function hostFor(body: Record<string, unknown>) {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ url: '/enrollments' }),
    }),
  };
  return { host, status, json, body };
}

describe('HttpExceptionFilter', () => {
  const filter = new HttpExceptionFilter();

  it('flattens a coded conflict into a string message', () => {
    const { host, status, json } = hostFor({});
    filter.catch(
      new ConflictException({
        code: 'PATIENT_DNI_EXISTS',
        message: 'Ya existe un paciente con este DNI.',
      }),
      host as never,
    );

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 409,
        code: 'PATIENT_DNI_EXISTS',
        message: 'Ya existe un paciente con este DNI.',
        path: '/enrollments',
      }),
    );
  });

  it('joins validation messages', () => {
    const { host, json } = hostFor({});
    filter.catch(
      new BadRequestException(['dni must be a string', 'agentId is required']),
      host as never,
    );

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        message: 'dni must be a string. agentId is required',
      }),
    );
    expect(json.mock.calls[0][0].code).toBeUndefined();
  });

  it('unwraps a nested exception body', () => {
    const { host, json } = hostFor({});
    filter.catch(
      new BadRequestException({
        message: {
          code: 'CHECK_VIOLATION',
          message: 'Algún dato del enrolamiento no cumple las reglas.',
        },
      }),
      host as never,
    );

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'CHECK_VIOLATION',
        message: 'Algún dato del enrolamiento no cumple las reglas.',
      }),
    );
  });
});
