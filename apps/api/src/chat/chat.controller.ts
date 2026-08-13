import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ActiveAccountGuard } from '../auth/active-account.guard';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ChatService } from './chat.service';
import {
  ChatConversationQuerySchema,
  ChatMessageQuerySchema,
  CreateDirectConversationSchema,
  SendChatMessageSchema,
} from './dto/chat.dto';

@Controller('chat')
@Roles('admin', 'team_leader', 'employee', 'accountant', 'client')
@UseGuards(AuthGuard, ActiveAccountGuard, RolesGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('conversations')
  async listConversations(
    @Query() rawQuery: Record<string, string>,
    @CurrentUser() user: RequestUser,
  ) {
    const parsed = ChatConversationQuerySchema.safeParse(rawQuery);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: parsed.error.errors.map((item) => item.message).join(', '),
      });
    }
    return this.chatService.listConversations(parsed.data, user);
  }

  @Get('unread-count')
  async unreadCount(@CurrentUser() user: RequestUser) {
    return this.chatService.unreadCount(user);
  }

  @Post('direct')
  async createDirect(@Body() body: unknown, @CurrentUser() user: RequestUser) {
    const parsed = CreateDirectConversationSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: parsed.error.errors.map((item) => item.message).join(', '),
      });
    }
    return this.chatService.createDirectConversation(parsed.data, user);
  }

  @Post('projects/:projectId')
  async getProjectConversation(
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.chatService.getOrCreateProjectConversation(projectId, user);
  }

  @Get('conversations/:id')
  async getConversation(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.chatService.getConversationById(id, user);
  }

  @Get('conversations/:id/messages')
  async listMessages(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Query() rawQuery: Record<string, string>,
    @CurrentUser() user: RequestUser,
  ) {
    const parsed = ChatMessageQuerySchema.safeParse(rawQuery);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: parsed.error.errors.map((item) => item.message).join(', '),
      });
    }
    return this.chatService.listMessages(id, parsed.data, user);
  }

  @Post('conversations/:id/messages')
  async sendMessage(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
  ) {
    const parsed = SendChatMessageSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: parsed.error.errors.map((item) => item.message).join(', '),
      });
    }
    return this.chatService.sendMessage(id, parsed.data, user);
  }

  @Post('conversations/:id/read')
  async markRead(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.chatService.markRead(id, user);
  }
}
