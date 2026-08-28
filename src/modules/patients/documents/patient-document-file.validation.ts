import { createHash } from 'node:crypto';
import {
  BadRequestException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import JSZip from 'jszip';

const DEFAULT_MAX_FILE_BYTES = 10_485_760;

const FILE_RULES = {
  '.pdf': { mediaType: 'application/pdf' },
  '.doc': { mediaType: 'application/msword' },
  '.docx': {
    mediaType:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  },
  '.jpg': { mediaType: 'image/jpeg' },
  '.jpeg': { mediaType: 'image/jpeg' },
  '.png': { mediaType: 'image/png' },
  '.webp': { mediaType: 'image/webp' },
} as const;

export type SupportedPatientDocumentMediaType =
  (typeof FILE_RULES)[keyof typeof FILE_RULES]['mediaType'];

export interface ValidatedPatientDocumentFile {
  originalFileName: string;
  mediaType: SupportedPatientDocumentMediaType;
  sizeBytes: number;
  sha256: string;
}

export async function validatePatientDocumentFile(
  file: Express.Multer.File | undefined,
  maxBytes = DEFAULT_MAX_FILE_BYTES,
): Promise<ValidatedPatientDocumentFile> {
  if (!file?.buffer || file.buffer.length === 0) {
    throw new BadRequestException('A non-empty file is required');
  }

  if (file.buffer.length > maxBytes) {
    throw new PayloadTooLargeException(
      `File exceeds the maximum size of ${maxBytes} bytes`,
    );
  }

  const originalFileName = safeOriginalFileName(file.originalname);
  const extension = extensionOf(originalFileName);
  const rule = FILE_RULES[extension as keyof typeof FILE_RULES];

  if (!rule) {
    throw new UnsupportedMediaTypeException('File type is not supported');
  }

  const clientMediaType = file.mimetype?.toLowerCase().split(';', 1)[0];
  if (
    clientMediaType &&
    clientMediaType !== rule.mediaType &&
    clientMediaType !== 'application/octet-stream'
  ) {
    throw new UnsupportedMediaTypeException('File MIME type is not supported');
  }

  const validSignature =
    extension === '.docx'
      ? await isValidDocx(file.buffer)
      : hasExpectedSignature(file.buffer, extension);

  if (!validSignature) {
    throw new UnsupportedMediaTypeException('File content is not valid');
  }

  return {
    originalFileName,
    mediaType: rule.mediaType,
    sizeBytes: file.buffer.length,
    sha256: createHash('sha256').update(file.buffer).digest('hex'),
  };
}

export function safeOriginalFileName(value: string | undefined): string {
  const lastPathPart = (value ?? '').replaceAll('\\', '/').split('/').pop();
  const normalized = (lastPathPart ?? '').normalize('NFKC').trim();
  const sanitized = Array.from(normalized, (character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 0x1f || codePoint === 0x7f ? '_' : character;
  }).join('');

  return (sanitized || 'archivo').slice(0, 255);
}

function extensionOf(fileName: string): string {
  const dotIndex = fileName.lastIndexOf('.');
  return dotIndex >= 0 ? fileName.slice(dotIndex).toLowerCase() : '';
}

function hasExpectedSignature(buffer: Buffer, extension: string): boolean {
  switch (extension) {
    case '.pdf':
      return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
    case '.doc':
      return buffer
        .subarray(0, 8)
        .equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
    case '.jpg':
    case '.jpeg':
      return buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
    case '.png':
      return buffer
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case '.webp':
      return (
        buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
        buffer.subarray(8, 12).toString('ascii') === 'WEBP'
      );
    default:
      return false;
  }
}

async function isValidDocx(buffer: Buffer): Promise<boolean> {
  try {
    const archive = await JSZip.loadAsync(buffer, { checkCRC32: false });
    const names = Object.keys(archive.files);
    const hasRequiredParts =
      names.includes('[Content_Types].xml') &&
      names.includes('word/document.xml');
    const hasMacro = names.some((name) =>
      name.toLowerCase().endsWith('vbaproject.bin'),
    );
    return hasRequiredParts && !hasMacro;
  } catch {
    return false;
  }
}
