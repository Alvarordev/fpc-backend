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
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { UserRole } from '../../database/entities/user-role.enum';
import { User } from '../../database/entities/user.entity';
import { SupportTicketType } from '../../database/entities/support-ticket.entity';
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto';
import { CreateSupportTicketMessageDto } from './dto/create-support-ticket-message.dto';
import { ListSupportTicketsDto } from './dto/list-support-tickets.dto';
import { UpdateSupportTicketDto } from './dto/update-support-ticket.dto';
import { SupportTicketResponseDto } from './dto/support-ticket-response.dto';
import {
  MAX_SUPPORT_TICKET_IMAGE_BYTES,
  MAX_SUPPORT_TICKET_IMAGES,
  SupportTicketsService,
} from './support-tickets.service';

const REPORTERS = [UserRole.ADMIN, UserRole.FOUNDATION, UserRole.AGENT];

@Controller('support-tickets')
@ApiTags('Support tickets')
@ApiBearerAuth()
export class SupportTicketsController {
  constructor(private readonly service: SupportTicketsService) {}

  @Post()
  @Roles(...REPORTERS)
  @UseInterceptors(
    FilesInterceptor('images', MAX_SUPPORT_TICKET_IMAGES, {
      storage: memoryStorage(),
      limits: { fileSize: MAX_SUPPORT_TICKET_IMAGE_BYTES },
    }),
  )
  @ApiOperation({ summary: 'Open a support ticket' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['type', 'title', 'description'],
      properties: {
        type: { enum: Object.values(SupportTicketType) },
        title: { type: 'string' },
        description: { type: 'string' },
        pagePath: { type: 'string' },
        images: { type: 'array', items: { type: 'string', format: 'binary' } },
      },
    },
  })
  @ApiCreatedResponse({ type: SupportTicketResponseDto })
  async create(
    @Body() input: CreateSupportTicketDto,
    @UploadedFiles() files: Express.Multer.File[] | undefined,
    @CurrentUser() user: User,
  ): Promise<SupportTicketResponseDto> {
    return SupportTicketResponseDto.from(
      await this.service.create(input, files ?? [], user),
      user,
    );
  }

  @Get()
  @Roles(...REPORTERS)
  @ApiOperation({
    summary: 'List tickets (admins see all, others only their own)',
  })
  @ApiOkResponse({ type: [SupportTicketResponseDto] })
  async findAll(
    @Query() query: ListSupportTicketsDto,
    @CurrentUser() user: User,
  ): Promise<SupportTicketResponseDto[]> {
    const tickets = await this.service.findAll(query, user);
    return tickets.map((ticket) => SupportTicketResponseDto.from(ticket, user));
  }

  @Get(':id')
  @Roles(...REPORTERS)
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: SupportTicketResponseDto })
  async findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: User,
  ): Promise<SupportTicketResponseDto> {
    return SupportTicketResponseDto.from(
      await this.service.findOne(id, user),
      user,
    );
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Change the status of a ticket' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: SupportTicketResponseDto })
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: UpdateSupportTicketDto,
    @CurrentUser() user: User,
  ): Promise<SupportTicketResponseDto> {
    return SupportTicketResponseDto.from(
      await this.service.update(id, input, user),
      user,
    );
  }

  @Post(':id/messages')
  @Roles(...REPORTERS)
  @UseInterceptors(
    FilesInterceptor('images', MAX_SUPPORT_TICKET_IMAGES, {
      storage: memoryStorage(),
      limits: { fileSize: MAX_SUPPORT_TICKET_IMAGE_BYTES },
    }),
  )
  @ApiOperation({
    summary: 'Reply in the ticket thread (reopens it if the reporter replies)',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        body: { type: 'string' },
        images: { type: 'array', items: { type: 'string', format: 'binary' } },
      },
    },
  })
  @ApiCreatedResponse({ type: SupportTicketResponseDto })
  async addMessage(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: CreateSupportTicketMessageDto,
    @UploadedFiles() files: Express.Multer.File[] | undefined,
    @CurrentUser() user: User,
  ): Promise<SupportTicketResponseDto> {
    return SupportTicketResponseDto.from(
      await this.service.addMessage(id, input, files ?? [], user),
      user,
    );
  }

  @Post(':id/seen')
  @Roles(...REPORTERS)
  @ApiOperation({ summary: 'Mark the ticket updates as seen' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiCreatedResponse({ type: SupportTicketResponseDto })
  async markSeen(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: User,
  ): Promise<SupportTicketResponseDto> {
    return SupportTicketResponseDto.from(
      await this.service.markSeen(id, user),
      user,
    );
  }

  @Get(':id/attachments/:attachmentId/content')
  @Roles(...REPORTERS)
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'attachmentId', format: 'uuid' })
  @ApiProduces('application/octet-stream')
  @ApiOkResponse({
    content: {
      'application/octet-stream': {
        schema: { type: 'string', format: 'binary' },
      },
    },
  })
  async attachmentContent(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('attachmentId', new ParseUUIDPipe()) attachmentId: string,
    @CurrentUser() user: User,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const content = await this.service.getAttachmentContent(
      id,
      attachmentId,
      user,
    );
    response.setHeader('Cache-Control', 'private, max-age=3600');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    return new StreamableFile(content.body, {
      type: content.attachment.mediaType,
      length: content.contentLength,
    });
  }
}
