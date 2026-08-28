import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiGoneResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiQuery,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { UserRole } from '../../../database/entities/user-role.enum';
import { User } from '../../../database/entities/user.entity';
import { PatientDocumentType } from '../../../database/entities/patient-document.entity';
import { CreatePatientDocumentDto } from './dto/create-patient-document.dto';
import { ListPatientDocumentsDto } from './dto/list-patient-documents.dto';
import {
  PatientDocumentListResponseDto,
  PatientDocumentResponseDto,
} from './dto/patient-document-response.dto';
import { PatientDocumentsService } from './patient-documents.service';

const WRITE = [UserRole.ADMIN, UserRole.FOUNDATION, UserRole.AGENT];
const MAX_FILE_BYTES = 10_485_760;

@Controller('patients/:patientId/documents')
@ApiTags('Patient documents')
@ApiBearerAuth()
export class PatientDocumentsController {
  constructor(private readonly service: PatientDocumentsService) {}

  @Post()
  @Roles(...WRITE)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { files: 1, fileSize: MAX_FILE_BYTES },
    }),
  )
  @ApiOperation({ summary: 'Upload a patient document' })
  @ApiParam({ name: 'patientId', format: 'uuid' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'documentType'],
      properties: {
        file: { type: 'string', format: 'binary' },
        documentType: { enum: Object.values(PatientDocumentType) },
        diagnosisId: { type: 'string', format: 'uuid' },
        treatmentId: { type: 'string', format: 'uuid' },
        description: { type: 'string', maxLength: 1000 },
      },
    },
  })
  @ApiCreatedResponse({ type: PatientDocumentResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid multipart payload' })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse({ description: 'Patient or association not found' })
  @ApiResponse({ status: 413, description: 'File is too large' })
  @ApiResponse({ status: 415, description: 'File type is not supported' })
  async create(
    @Param('patientId', new ParseUUIDPipe()) patientId: string,
    @Body() input: CreatePatientDocumentDto,
    @CurrentUser() user: User,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<PatientDocumentResponseDto> {
    return PatientDocumentResponseDto.from(
      await this.service.create(patientId, input, file, user),
    );
  }

  @Get()
  @Roles(...WRITE)
  @ApiOperation({ summary: 'List patient documents' })
  @ApiParam({ name: 'patientId', format: 'uuid' })
  @ApiQuery({
    name: 'documentType',
    enum: PatientDocumentType,
    required: false,
  })
  @ApiQuery({ name: 'diagnosisId', format: 'uuid', required: false })
  @ApiQuery({ name: 'treatmentId', format: 'uuid', required: false })
  @ApiQuery({ name: 'includeArchived', type: Boolean, required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false, maximum: 100 })
  @ApiQuery({ name: 'offset', type: Number, required: false, minimum: 0 })
  @ApiOkResponse({ type: PatientDocumentListResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid filters' })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse({ description: 'Patient not found' })
  async findAll(
    @Param('patientId', new ParseUUIDPipe()) patientId: string,
    @Query() query: ListPatientDocumentsDto,
    @CurrentUser() user: User,
  ): Promise<PatientDocumentListResponseDto> {
    return this.service.findAll(patientId, query, user);
  }

  @Get(':documentId/content')
  @Roles(...WRITE)
  @ApiOperation({ summary: 'Stream a patient document' })
  @ApiParam({ name: 'patientId', format: 'uuid' })
  @ApiParam({ name: 'documentId', format: 'uuid' })
  @ApiProduces('application/octet-stream')
  @ApiOkResponse({
    description: 'Document binary content',
    content: {
      'application/octet-stream': {
        schema: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse({ description: 'Document not found' })
  @ApiGoneResponse({ description: 'Document has been archived' })
  async content(
    @Param('patientId', new ParseUUIDPipe()) patientId: string,
    @Param('documentId', new ParseUUIDPipe()) documentId: string,
    @CurrentUser() user: User,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const content = await this.service.getContent(patientId, documentId, user);
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');

    return new StreamableFile(content.body, {
      type: content.document.mediaType,
      length: content.contentLength,
      disposition: contentDispositionFor(content.document.originalFileName),
    });
  }

  @Patch(':documentId/archive')
  @Roles(...WRITE)
  @ApiOperation({ summary: 'Archive a patient document' })
  @ApiParam({ name: 'patientId', format: 'uuid' })
  @ApiParam({ name: 'documentId', format: 'uuid' })
  @ApiOkResponse({ type: PatientDocumentResponseDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse({ description: 'Document not found' })
  async archive(
    @Param('patientId', new ParseUUIDPipe()) patientId: string,
    @Param('documentId', new ParseUUIDPipe()) documentId: string,
    @CurrentUser() user: User,
  ): Promise<PatientDocumentResponseDto> {
    return PatientDocumentResponseDto.from(
      await this.service.archive(patientId, documentId, user),
    );
  }
}

function contentDispositionFor(fileName: string): string {
  const fallback = fileName
    .replace(/[^\x20-\x7e]/g, '_')
    .replace(/["\\]/g, '_');
  return `inline; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
