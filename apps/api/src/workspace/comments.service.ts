import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  Optional,
  NotFoundException,
} from '@nestjs/common';
import { AutomationService } from '../automation/automation.service';
import type { RequestUser } from '../auth/auth.types';
import { NotificationsService } from '../notifications/notifications.service';
import { SupabaseService } from '../supabase/supabase.service';
import type {
  CommentPagination,
  CreateCommentDto,
  UpdateCommentDto,
} from './dto/workspace.dto';
import {
  WorkspaceAccessService,
  type WorkspaceProjectAccess,
} from './workspace-access.service';
import {
  WorkspaceRealtimeGateway,
  type WorkspaceEvent,
} from './workspace-realtime.gateway';

@Injectable()
export class CommentsService {
  private readonly logger = new Logger(CommentsService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly accessService: WorkspaceAccessService,
    private readonly realtime: WorkspaceRealtimeGateway,
    @Optional() private readonly notifications?: NotificationsService,
    @Optional() private readonly automation?: AutomationService,
  ) {}

  private get client() {
    return this.supabaseService.getSystemClient();
  }

  private databaseFailure(
    code: string,
    message: string,
    error: unknown,
  ): never {
    const detail =
      typeof error === 'object' && error && 'message' in error
        ? String(error.message)
        : 'unknown database error';
    this.logger.error(`${code}: ${detail}`);
    throw new InternalServerErrorException({ code, message });
  }

  private emit(event: WorkspaceEvent): void {
    try {
      this.realtime.emitProjectEvent(event);
    } catch (error) {
      this.logger.error(
        `Realtime comment broadcast failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }

  private async accessAndTask(
    projectId: string,
    taskId: string,
    user: RequestUser,
  ) {
    const access = await this.accessService.requireProjectAccess(
      projectId,
      user,
      'COMMENT_ACCESS_DENIED',
    );
    await this.accessService.requireTask(
      projectId,
      taskId,
      'COMMENT_ACCESS_DENIED',
    );
    return access;
  }

  private async notifyCommentCreated(
    projectId: string,
    taskId: string,
    commentId: string,
    user: RequestUser,
  ) {
    if (!this.notifications && !this.automation) return;

    try {
      const { data: task, error } = await this.client
        .from('tasks')
        .select('id,title,project_id,assignee_user_id,reporter_user_id')
        .eq('id', taskId)
        .maybeSingle();
      if (error || !task) return;

      const recipients = [task.assignee_user_id, task.reporter_user_id].filter(
        (recipient): recipient is string =>
          Boolean(recipient) && recipient !== user.profileId,
      );

      await this.notifications?.createForUsers(recipients, {
        type: 'task.comment',
        title: 'Binh luan moi',
        message: `${user.fullName ?? user.email ?? 'Thanh vien'} da binh luan trong cong viec ${task.title}.`,
        entityType: 'task_comment',
        entityId: commentId,
        actionUrl: `/app/projects/${projectId}/tasks/${taskId}`,
        metadata: { projectId, taskId },
        actorUserId: user.profileId,
      });

      await this.automation?.runEvent({
        triggerType: 'task.updated',
        eventKey: `task.comment.created:${commentId}`,
        payload: {
          projectId,
          taskId,
          commentId,
          assigneeUserId: task.assignee_user_id,
          reporterUserId: task.reporter_user_id,
        },
        actorUserId: user.profileId,
        defaultRecipients: recipients,
        title: 'Binh luan moi',
        message: `Cong viec ${task.title} co binh luan moi.`,
        entityType: 'task_comment',
        entityId: commentId,
        actionUrl: `/app/projects/${projectId}/tasks/${taskId}`,
      });
    } catch (error) {
      this.logger.error(
        `Comment side effects failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }

  private mapComment(
    comment: Record<string, any>,
    access: WorkspaceProjectAccess,
    user: RequestUser,
  ) {
    const own = comment.author_user_id === user.profileId;
    const readOnly = access.projectRole === 'viewer';
    return {
      id: comment.id,
      taskId: comment.task_id,
      authorUserId: comment.author_user_id,
      author: comment.author ?? null,
      content: comment.content,
      editedAt: comment.edited_at ?? null,
      createdAt: comment.created_at,
      updatedAt: comment.updated_at,
      canEdit: !readOnly && (access.isAdmin || own),
      canDelete: !readOnly && (access.isManager || own),
    };
  }

  private async getComment(commentId: string) {
    const { data, error } = await this.client
      .from('task_comments')
      .select(
        '*,author:profiles!task_comments_author_user_id_fkey(id,full_name,email,avatar_url)',
      )
      .eq('id', commentId)
      .maybeSingle();
    if (error) {
      this.databaseFailure(
        'COMMENT_LOOKUP_FAILED',
        'Không thể truy vấn bình luận.',
        error,
      );
    }
    if (!data) {
      throw new NotFoundException({
        code: 'COMMENT_NOT_FOUND',
        message: 'Không tìm thấy bình luận.',
      });
    }
    return data as Record<string, any>;
  }

  async list(
    projectId: string,
    taskId: string,
    pagination: CommentPagination,
    user: RequestUser,
  ) {
    const access = await this.accessAndTask(projectId, taskId, user);
    const offset = (pagination.page - 1) * pagination.pageSize;
    const { data, count, error } = await this.client
      .from('task_comments')
      .select(
        '*,author:profiles!task_comments_author_user_id_fkey(id,full_name,email,avatar_url)',
        { count: 'exact' },
      )
      .eq('task_id', taskId)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + pagination.pageSize - 1);
    if (error) {
      this.databaseFailure(
        'COMMENTS_LOOKUP_FAILED',
        'Không thể tải bình luận lúc này.',
        error,
      );
    }
    const total = count ?? 0;
    return {
      items: (data ?? []).map((comment) =>
        this.mapComment(comment, access, user),
      ),
      page: pagination.page,
      pageSize: pagination.pageSize,
      total,
      totalPages: Math.ceil(total / pagination.pageSize),
    };
  }

  async create(
    projectId: string,
    taskId: string,
    dto: CreateCommentDto,
    user: RequestUser,
  ) {
    const access = await this.accessAndTask(projectId, taskId, user);
    if (access.projectRole === 'viewer') {
      throw new ForbiddenException({
        code: 'COMMENT_ACCESS_DENIED',
        message: 'Người xem chỉ có quyền đọc bình luận.',
      });
    }
    const { data, error } = await this.client
      .from('task_comments')
      .insert({
        task_id: taskId,
        author_user_id: user.profileId,
        content: dto.content,
      })
      .select(
        '*,author:profiles!task_comments_author_user_id_fkey(id,full_name,email,avatar_url)',
      )
      .single();
    if (error) {
      this.databaseFailure(
        'COMMENT_CREATE_FAILED',
        'Không thể tạo bình luận lúc này.',
        error,
      );
    }
    this.emit({
      projectId,
      entityId: data.id,
      event: 'comment.created',
      updatedAt: data.updated_at,
      changes: { taskId },
    });
    await this.notifyCommentCreated(projectId, taskId, data.id, user);
    return this.mapComment(data, access, user);
  }

  async update(
    projectId: string,
    taskId: string,
    commentId: string,
    dto: UpdateCommentDto,
    user: RequestUser,
  ) {
    const access = await this.accessAndTask(projectId, taskId, user);
    if (access.projectRole === 'viewer') {
      throw new ForbiddenException({
        code: 'COMMENT_EDIT_DENIED',
        message: 'Người xem chỉ có quyền đọc bình luận.',
      });
    }
    const existing = await this.getComment(commentId);
    if (existing.task_id !== taskId) {
      throw new ForbiddenException({
        code: 'COMMENT_ACCESS_DENIED',
        message: 'Bình luận không thuộc công việc được yêu cầu.',
      });
    }
    if (!access.isAdmin && existing.author_user_id !== user.profileId) {
      throw new ForbiddenException({
        code: 'COMMENT_EDIT_DENIED',
        message: 'Bạn chỉ có thể sửa bình luận của mình.',
      });
    }

    const { data, error } = await this.client
      .from('task_comments')
      .update({ content: dto.content, edited_at: new Date().toISOString() })
      .eq('id', commentId)
      .select(
        '*,author:profiles!task_comments_author_user_id_fkey(id,full_name,email,avatar_url)',
      )
      .single();
    if (error) {
      this.databaseFailure(
        'COMMENT_UPDATE_FAILED',
        'Không thể cập nhật bình luận lúc này.',
        error,
      );
    }
    this.emit({
      projectId,
      entityId: commentId,
      event: 'comment.updated',
      updatedAt: data.updated_at,
      changes: { taskId },
    });
    return this.mapComment(data, access, user);
  }

  async remove(
    projectId: string,
    taskId: string,
    commentId: string,
    user: RequestUser,
  ) {
    const access = await this.accessAndTask(projectId, taskId, user);
    if (access.projectRole === 'viewer') {
      throw new ForbiddenException({
        code: 'COMMENT_DELETE_DENIED',
        message: 'Người xem chỉ có quyền đọc bình luận.',
      });
    }
    const existing = await this.getComment(commentId);
    if (existing.task_id !== taskId) {
      throw new ForbiddenException({
        code: 'COMMENT_ACCESS_DENIED',
        message: 'Bình luận không thuộc công việc được yêu cầu.',
      });
    }
    if (!access.isManager && existing.author_user_id !== user.profileId) {
      throw new ForbiddenException({
        code: 'COMMENT_DELETE_DENIED',
        message: 'Bạn không có quyền xóa bình luận này.',
      });
    }
    const { error } = await this.client
      .from('task_comments')
      .delete()
      .eq('id', commentId);
    if (error) {
      this.databaseFailure(
        'COMMENT_DELETE_FAILED',
        'Không thể xóa bình luận lúc này.',
        error,
      );
    }
    this.emit({
      projectId,
      entityId: commentId,
      event: 'comment.deleted',
      updatedAt: new Date().toISOString(),
      changes: { taskId },
    });
    return { success: true };
  }
}
