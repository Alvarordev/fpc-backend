import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CloudflareR2PatientDocumentStorageService } from './cloudflare-r2-patient-document-storage.service';
import {
  InMemoryPatientDocumentStorage,
  PATIENT_DOCUMENT_STORAGE,
  PatientDocumentStorage,
} from './patient-document-storage';

@Module({
  providers: [
    {
      provide: PATIENT_DOCUMENT_STORAGE,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): PatientDocumentStorage => {
        const driver = configService.get<string>(
          'PATIENT_DOCUMENT_STORAGE_DRIVER',
          'r2',
        );

        return driver === 'memory'
          ? new InMemoryPatientDocumentStorage()
          : new CloudflareR2PatientDocumentStorageService(configService);
      },
    },
  ],
  exports: [PATIENT_DOCUMENT_STORAGE],
})
export class PatientDocumentStorageModule {}
