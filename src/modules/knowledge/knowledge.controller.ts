import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { Roles } from '../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { UserRole } from '../../database/entities/user-role.enum';
import { User } from '../../database/entities/user.entity';
import { KnowledgeService } from './knowledge.service';
import {
  CreateKnowledgeDocumentDto,
  KnowledgeDocumentListDto,
  KnowledgeDocumentResponseDto,
  KnowledgeLibraryStatusDto,
  ListKnowledgeDocumentsDto,
} from './dto/knowledge.dto';

const MANAGE = [UserRole.ADMIN, UserRole.FOUNDATION];
const READ = [...MANAGE, UserRole.AGENT];

@Controller('knowledge')
@ApiTags('knowledge')
@ApiBearerAuth()
@Roles(...MANAGE)
export class KnowledgeController {
  constructor(private readonly service: KnowledgeService) {}

  @Get('status')
  @Roles(...READ)
  @ApiOkResponse({ type: KnowledgeLibraryStatusDto })
  status() {
    return this.service.status();
  }

  @Get('documents')
  @ApiOkResponse({ type: KnowledgeDocumentListDto })
  list(@Query() query: ListKnowledgeDocumentsDto) {
    return this.service.list(query);
  }

  @Post('documents')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { files: 1, fileSize: 10_485_760, fields: 2 },
    }),
  )
  @ApiOperation({
    summary:
      'Upload a draft knowledge document; indexing runs in the background',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'title'],
      properties: {
        file: { type: 'string', format: 'binary' },
        title: { type: 'string', maxLength: 200 },
        version: { type: 'string', maxLength: 50, default: '1' },
      },
    },
  })
  @ApiCreatedResponse({ type: KnowledgeDocumentResponseDto })
  async upload(
    @Body() input: CreateKnowledgeDocumentDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: User,
  ) {
    return KnowledgeDocumentResponseDto.from(
      await this.service.create(input, file, user),
    );
  }

  @Post('documents/:id/publish')
  @HttpCode(200)
  @ApiOkResponse({ type: KnowledgeDocumentResponseDto })
  async publish(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return KnowledgeDocumentResponseDto.from(
      await this.service.publish(id, user),
    );
  }

  @Post('documents/:id/archive')
  @HttpCode(200)
  @ApiOkResponse({ type: KnowledgeDocumentResponseDto })
  async archive(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return KnowledgeDocumentResponseDto.from(
      await this.service.archive(id, user),
    );
  }

  @Post('documents/:id/retry')
  @HttpCode(200)
  @ApiOkResponse({ type: KnowledgeDocumentResponseDto })
  async retry(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return KnowledgeDocumentResponseDto.from(
      await this.service.retry(id, user),
    );
  }

  @Delete('documents/:id')
  @HttpCode(204)
  @ApiNoContentResponse()
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }

  @Get('documents/:id/content')
  @Roles(...READ)
  @ApiProduces('application/octet-stream')
  @ApiOkResponse({ schema: { type: 'string', format: 'binary' } })
  async content(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Res({ passthrough: true }) response: Response,
  ) {
    const doc = await this.service.content(id, user);
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    return new StreamableFile(doc.content, {
      type: doc.mediaType,
      length: doc.size,
      disposition: `attachment; filename="documento${doc.mediaType === 'application/pdf' ? '.pdf' : '.docx'}"; filename*=UTF-8''${encodeURIComponent(doc.originalName)}`,
    });
  }
}
