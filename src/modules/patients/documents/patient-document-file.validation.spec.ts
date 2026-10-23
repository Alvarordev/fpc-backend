import {
  BadRequestException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import {
  validatePatientDocumentFile,
  safeOriginalFileName,
} from './patient-document-file.validation';

function file(
  originalname: string,
  mimetype: string,
  content: Buffer,
): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname,
    encoding: '7bit',
    mimetype,
    size: content.length,
    destination: '',
    filename: originalname,
    path: '',
    buffer: content,
    stream: null as never,
  };
}

describe('patient document file validation', () => {
  it('accepts a PDF and calculates its checksum', async () => {
    const content = Buffer.from('%PDF-1.7\npatient report');

    const validated = await validatePatientDocumentFile(
      file('report.pdf', 'application/pdf', content),
    );

    expect(validated.originalFileName).toBe('report.pdf');
    expect(validated.mediaType).toBe('application/pdf');
    expect(validated.sizeBytes).toBe(content.length);
    expect(validated.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects an extension whose content has the wrong signature', async () => {
    await expect(
      validatePatientDocumentFile(
        file('report.pdf', 'application/pdf', Buffer.from('not a PDF')),
      ),
    ).rejects.toBeInstanceOf(UnsupportedMediaTypeException);
  });

  it('rejects files larger than the configured limit', async () => {
    await expect(
      validatePatientDocumentFile(
        file('report.pdf', 'application/pdf', Buffer.from('%PDF-')),
        4,
      ),
    ).rejects.toBeInstanceOf(PayloadTooLargeException);
  });

  it('rejects an absent file', async () => {
    await expect(validatePatientDocumentFile(undefined)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('removes path components and control characters from the display name', () => {
    expect(safeOriginalFileName('../invoices\\report\n.pdf')).toBe(
      'report_.pdf',
    );
  });
});
