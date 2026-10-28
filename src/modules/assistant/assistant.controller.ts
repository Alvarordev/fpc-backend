import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { User } from '../../database/entities/user.entity';
import { UserRole } from '../../database/entities/user-role.enum';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { AssistantPseudonymizer } from './assistant-pseudonyms';
import { AssistantToolsService } from './assistant-tools.service';
import { AssistantService } from './assistant.service';
import {
  AskAssistantDto,
  AskAssistantResponseDto,
  AssistantConversationResponseDto,
  AssistantConversationSummaryDto,
  AssistantMessageResponseDto,
} from './dto/assistant.dto';

/** IA2 / IA5: asistente de datos, solo fundación y admin. */
@Controller('assistant')
@ApiTags('assistant')
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.FOUNDATION)
@ApiUnauthorizedResponse()
@ApiForbiddenResponse({
  description: 'Administrator or foundation role required',
})
export class AssistantController {
  constructor(
    private readonly service: AssistantService,
    private readonly tools: AssistantToolsService,
  ) {}

  @Post('messages')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Ask the data assistant',
    description:
      'Runs the agent with read-only tool calls and stores the question and answer. Patients are pseudonymised for the model and rehydrated in the response.',
  })
  @ApiOkResponse({ type: AskAssistantResponseDto })
  @ApiNotFoundResponse({ description: 'No se encontró la conversación.' })
  @ApiServiceUnavailableResponse({
    description: 'Model not configured or unavailable',
  })
  @HttpCode(200)
  async ask(
    @Body() input: AskAssistantDto,
    @CurrentUser() user: User,
  ): Promise<AskAssistantResponseDto> {
    const { conversation, userMessage, assistantMessage } =
      await this.service.ask(user, input.message, input.conversationId);
    const pseudonyms = new AssistantPseudonymizer(conversation.pseudonyms);
    return {
      conversationId: conversation.id,
      question: this.toMessage(userMessage, pseudonyms),
      answer: this.toMessage(assistantMessage, pseudonyms),
    };
  }

  @Get('conversations')
  @ApiOperation({ summary: "List the current user's assistant conversations" })
  @ApiOkResponse({ type: AssistantConversationSummaryDto, isArray: true })
  async list(
    @CurrentUser() user: User,
  ): Promise<AssistantConversationSummaryDto[]> {
    return (await this.service.listConversations(user)).map((conversation) =>
      AssistantConversationSummaryDto.from(conversation),
    );
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'Get an assistant conversation with its messages' })
  @ApiOkResponse({ type: AssistantConversationResponseDto })
  @ApiNotFoundResponse({ description: 'No se encontró la conversación.' })
  async get(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<AssistantConversationResponseDto> {
    const conversation = await this.service.getConversation(id, user);
    const pseudonyms = new AssistantPseudonymizer(conversation.pseudonyms);
    return {
      ...AssistantConversationSummaryDto.from(conversation),
      messages: conversation.messages.map((message) =>
        this.toMessage(message, pseudonyms),
      ),
    };
  }

  @Delete('conversations/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete an assistant conversation' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'No se encontró la conversación.' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.service.deleteConversation(id, user);
  }

  private toMessage(
    message: Parameters<typeof AssistantMessageResponseDto.from>[0],
    pseudonyms: AssistantPseudonymizer,
  ) {
    return AssistantMessageResponseDto.from(message, pseudonyms, (tool) =>
      this.tools.labelFor(tool),
    );
  }
}
