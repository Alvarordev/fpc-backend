import { Readable } from 'node:stream';

export const PATIENT_DOCUMENT_STORAGE = Symbol('PATIENT_DOCUMENT_STORAGE');

export interface PatientDocumentStoragePutInput {
  key: string;
  body: Buffer;
  contentType: string;
  contentLength: number;
  sha256: string;
}

export interface PatientDocumentStorageObject {
  body: Readable;
  contentLength?: number;
  contentType?: string;
}

export interface PatientDocumentStorage {
  put(input: PatientDocumentStoragePutInput): Promise<void>;
  get(key: string): Promise<PatientDocumentStorageObject>;
  delete(key: string): Promise<void>;
}

export class PatientDocumentStorageNotFoundError extends Error {
  constructor(key: string) {
    super(`Patient document object not found: ${key}`);
    this.name = 'PatientDocumentStorageNotFoundError';
  }
}

export class InMemoryPatientDocumentStorage implements PatientDocumentStorage {
  private readonly objects = new Map<
    string,
    { body: Buffer; contentType: string; sha256: string }
  >();

  put(input: PatientDocumentStoragePutInput): Promise<void> {
    this.objects.set(input.key, {
      body: Buffer.from(input.body),
      contentType: input.contentType,
      sha256: input.sha256,
    });
    return Promise.resolve();
  }

  get(key: string): Promise<PatientDocumentStorageObject> {
    const object = this.objects.get(key);
    if (!object)
      return Promise.reject(new PatientDocumentStorageNotFoundError(key));

    return Promise.resolve({
      body: Readable.from(object.body),
      contentLength: object.body.length,
      contentType: object.contentType,
    });
  }

  delete(key: string): Promise<void> {
    this.objects.delete(key);
    return Promise.resolve();
  }

  has(key: string): boolean {
    return this.objects.has(key);
  }
}
