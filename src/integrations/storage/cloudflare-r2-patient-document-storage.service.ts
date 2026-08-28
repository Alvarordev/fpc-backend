import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'node:stream';
import {
  PatientDocumentStorage,
  PatientDocumentStorageNotFoundError,
  PatientDocumentStorageObject,
  PatientDocumentStoragePutInput,
} from './patient-document-storage';

export class CloudflareR2PatientDocumentStorageService implements PatientDocumentStorage {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(configService: ConfigService) {
    const accountId = configService.getOrThrow<string>('R2_ACCOUNT_ID');
    const endpoint =
      configService.get<string>('R2_ENDPOINT') ??
      `https://${accountId}.r2.cloudflarestorage.com`;

    this.bucket = configService.getOrThrow<string>('R2_BUCKET_NAME');
    this.client = new S3Client({
      endpoint,
      region: 'auto',
      credentials: {
        accessKeyId: configService.getOrThrow<string>('R2_ACCESS_KEY_ID'),
        secretAccessKey: configService.getOrThrow<string>(
          'R2_SECRET_ACCESS_KEY',
        ),
      },
    });
  }

  async put(input: PatientDocumentStoragePutInput): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
        ContentLength: input.contentLength,
        Metadata: { sha256: input.sha256 },
      }),
    );
  }

  async get(key: string): Promise<PatientDocumentStorageObject> {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );

    if (!response.Body) throw new PatientDocumentStorageNotFoundError(key);

    return {
      body: response.Body as Readable,
      contentLength: response.ContentLength,
      contentType: response.ContentType,
    };
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}
