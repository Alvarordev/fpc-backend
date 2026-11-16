import {
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UserRole } from '../../database/entities/user-role.enum';
import {
  AuditContext,
  AuditContextKind,
} from '../../shared/audit/audit-context';
import { Roles } from '../../shared/decorators/roles.decorator';
import { ApiErrorResponseDto } from '../../shared/filters/api-error-response.dto';
import { DeleteDiagnosisQueryDto } from './dto/delete-diagnosis-query.dto';
import { RecordDeletionsService } from './record-deletions.service';

/**
 * Admin-only hard deletes of records entered by mistake. Every deleted row is
 * kept as a DELETE entry in change_log (context ADMIN_ADJUSTMENT).
 */
@Controller()
@ApiTags('Record deletions (admin)')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@AuditContext(AuditContextKind.ADMIN_ADJUSTMENT)
@ApiUnauthorizedResponse({ description: 'JWT missing, invalid, or expired' })
@ApiForbiddenResponse({ description: 'Only administrators may delete records' })
export class RecordDeletionsController {
  constructor(private readonly service: RecordDeletionsService) {}

  @Delete('follow-ups/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a follow-up and everything recorded in it',
    description:
      'Works for any follow-up except an enrollment. Deletes the diagnoses, treatments, appointments, alerts, assessments, notes and social referrals recorded in it; records from other follow-ups that point to it only lose the link. Versioned records it replaced (insurance, treatments, appointments) become current again.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({
    description: 'No se encontró el seguimiento.',
    type: ApiErrorResponseDto,
  })
  @ApiConflictResponse({
    description:
      'The follow-up is an enrollment, or treatments from other follow-ups depend on its diagnoses',
    type: ApiErrorResponseDto,
  })
  deleteFollowUp(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.deleteFollowUp(id);
  }

  @Delete('patients/:patientId/diagnoses/:diagnosisId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a patient diagnosis',
    description:
      'Diagnostic status events and documents keep their data and lose the link. With withTreatments=true its treatments are deleted too. restoreDiagnosisId makes a retired diagnosis active again in the same transaction.',
  })
  @ApiParam({ name: 'patientId', format: 'uuid' })
  @ApiParam({ name: 'diagnosisId', format: 'uuid' })
  @ApiNoContentResponse()
  @ApiBadRequestResponse({
    description:
      'Invalid query, or restoreDiagnosisId is the deleted diagnosis',
    type: ApiErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Diagnosis (or the one to restore) not found for the patient',
    type: ApiErrorResponseDto,
  })
  @ApiConflictResponse({
    description:
      'The diagnosis has treatments and withTreatments is not set, or the diagnosis to restore is already active',
    type: ApiErrorResponseDto,
  })
  deleteDiagnosis(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Param('diagnosisId', ParseUUIDPipe) diagnosisId: string,
    @Query() query: DeleteDiagnosisQueryDto,
  ) {
    return this.service.deleteDiagnosis(patientId, diagnosisId, query);
  }

  @Delete('patients/:patientId/treatments/:treatmentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a patient treatment',
    description:
      'Deletes the treatment and its medications; documents lose the link. If it was the current version of its series, the latest remaining version becomes current.',
  })
  @ApiParam({ name: 'patientId', format: 'uuid' })
  @ApiParam({ name: 'treatmentId', format: 'uuid' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({
    description: 'Treatment not found for the patient',
    type: ApiErrorResponseDto,
  })
  deleteTreatment(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Param('treatmentId', ParseUUIDPipe) treatmentId: string,
  ) {
    return this.service.deleteTreatment(patientId, treatmentId);
  }
}
