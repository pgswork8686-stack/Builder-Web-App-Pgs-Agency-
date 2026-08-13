import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { RequestUser } from '../auth/auth.types';
import { AutomationService } from '../automation/automation.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateTaskDto, TaskListQuery, UpdateTaskDto } from './dto/task.dto';
import { WorkspaceRealtimeGateway } from '../workspace/workspace-realtime.gateway';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    @Optional() private readonly realtime?: WorkspaceRealtimeGateway,
    @Optional() private readonly notifications?: NotificationsService,
    @Optional() private readonly automation?: AutomationService,
  ) {}

  private get client() {
    return this.supabaseService.getSystemClient();
  }

  private databaseFailure(code: string, message: string, error: any): never {
    this.logger.error(`${code}: ${error?.message ?? 'unknown database error'}`);
    throw new InternalServerErrorException({ code, message });
  }

  private emit(
    projectId: string,
    entityId: string,
    event: 'task.created' | 'task.updated',
    updatedAt: string,
    changes?: Record<string, unknown>,
  ): void {
    try {
      this.realtime?.emitProjectEvent({
        projectId,
        entityId,
        event,
        updatedAt,
        changes,
      });
    } catch (error) {
      this.logger.error(
        `Realtime task broadcast failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }

  private async runTaskSideEffects(
    triggerType: 'task.created' | 'task.assigned' | 'task.updated',
    eventKey: string,
    task: Record<string, any>,
    actor: RequestUser,
    previousTask?: Record<string, any>,
  ) {
    try {
      if (
        triggerType === 'task.assigned' &&
        task.assignee_user_id &&
        task.assignee_user_id !== actor.profileId
      ) {
        await this.notifications?.createForUser({
          recipientUserId: task.assignee_user_id,
          type: 'task.assigned',
          title: 'Cong viec moi',
          message: `Ban duoc giao cong viec: ${task.title}.`,
          entityType: 'task',
          entityId: task.id,
          actionUrl: `/app/projects/${task.project_id}/tasks/${task.id}`,
          metadata: { projectId: task.project_id },
          actorUserId: actor.profileId,
        });
      }

      await this.automation?.runEvent({
        triggerType,
        eventKey,
        payload: {
          taskId: task.id,
          projectId: task.project_id,
          title: task.title,
          status: task.status,
          priority: task.priority,
          assigneeUserId: task.assignee_user_id,
          previousStatus: previousTask?.status ?? null,
          previousAssigneeUserId: previousTask?.assignee_user_id ?? null,
        },
        actorUserId: actor.profileId,
        defaultRecipients: task.assignee_user_id ? [task.assignee_user_id] : [],
        title:
          triggerType === 'task.assigned'
            ? 'Cong viec moi'
            : 'Cap nhat cong viec',
        message: `Cong viec ${task.title} da duoc cap nhat.`,
        entityType: 'task',
        entityId: task.id,
        actionUrl: `/app/projects/${task.project_id}/tasks/${task.id}`,
      });
    } catch (error) {
      this.logger.error(
        `Task side effects failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }

  private async requireProject(projectId: string) {
    const { data, error } = await this.client
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .maybeSingle();
    if (error) {
      this.databaseFailure(
        'PROJECT_LOOKUP_FAILED',
        'Không thể kiểm tra dự án.',
        error,
      );
    }
    if (!data) {
      throw new NotFoundException({
        code: 'PROJECT_NOT_FOUND',
        message: 'Không tìm thấy dự án.',
      });
    }
  }

  private async getAccess(projectId: string, user: RequestUser) {
    if (user.role === 'client') {
      throw new ForbiddenException({
        code: 'TASK_ACCESS_DENIED',
        message: 'Khách hàng không có quyền truy cập công việc nội bộ.',
      });
    }
    await this.requireProject(projectId);
    if (user.role === 'admin') {
      return { isAdmin: true, projectRole: 'project_manager' as const };
    }
    const { data, error } = await this.client
      .from('project_memberships')
      .select('project_role')
      .eq('project_id', projectId)
      .eq('user_id', user.profileId)
      .maybeSingle();
    if (error) {
      this.databaseFailure(
        'PROJECT_ACCESS_LOOKUP_FAILED',
        'Không thể kiểm tra quyền truy cập dự án.',
        error,
      );
    }
    if (!data) {
      throw new ForbiddenException({
        code: 'PROJECT_ACCESS_DENIED',
        message: 'Bạn không phải thành viên của dự án.',
      });
    }
    return { isAdmin: false, projectRole: data.project_role as string };
  }

  private async getTaskRow(projectId: string, taskId: string) {
    const { data, error } = await this.client
      .from('tasks')
      .select(
        '*, assignee:profiles!tasks_assignee_user_id_fkey(id,full_name,email,avatar_url), reporter:profiles!tasks_reporter_user_id_fkey(id,full_name,email)',
      )
      .eq('project_id', projectId)
      .eq('id', taskId)
      .maybeSingle();
    if (error) {
      this.databaseFailure(
        'TASK_LOOKUP_FAILED',
        'Không thể truy vấn công việc.',
        error,
      );
    }
    if (!data) {
      throw new NotFoundException({
        code: 'TASK_NOT_FOUND',
        message: 'Không tìm thấy công việc.',
      });
    }
    return data;
  }

  private async validateAssignee(projectId: string, userId: string) {
    const { data, error } = await this.client
      .from('project_memberships')
      .select(
        'id, profile:profiles!project_memberships_user_id_fkey(role,account_status)',
      )
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) {
      this.databaseFailure(
        'PROJECT_MEMBER_LOOKUP_FAILED',
        'Không thể kiểm tra người nhận việc.',
        error,
      );
    }
    if (!data) {
      throw new BadRequestException({
        code: 'TASK_ASSIGNEE_NOT_PROJECT_MEMBER',
        message: 'Người nhận việc phải là thành viên của dự án.',
      });
    }

    const profile = Array.isArray(data.profile)
      ? data.profile[0]
      : data.profile;
    if (
      !profile ||
      profile.role === 'client' ||
      profile.account_status !== 'active'
    ) {
      throw new BadRequestException({
        code: 'TASK_ASSIGNEE_INVALID_USER',
        message: 'Người nhận việc phải là thành viên nội bộ đang hoạt động.',
      });
    }
  }

  private async validateParent(
    projectId: string,
    parentTaskId: string,
    taskId?: string,
  ) {
    if (taskId && parentTaskId === taskId) {
      throw new BadRequestException({
        code: 'TASK_SELF_PARENT_DENIED',
        message: 'Công việc không thể là cha của chính nó.',
      });
    }
    const { data, error } = await this.client
      .from('tasks')
      .select('id,project_id')
      .eq('id', parentTaskId)
      .maybeSingle();
    if (error) {
      this.databaseFailure(
        'PARENT_TASK_LOOKUP_FAILED',
        'Không thể kiểm tra công việc cha.',
        error,
      );
    }
    if (!data) {
      throw new BadRequestException({
        code: 'PARENT_TASK_NOT_FOUND',
        message: 'Không tìm thấy công việc cha.',
      });
    }
    if (data.project_id !== projectId) {
      throw new BadRequestException({
        code: 'INVALID_PARENT_TASK_PROJECT',
        message: 'Công việc cha phải thuộc cùng dự án.',
      });
    }
  }

  private mapWriteError(error: any): never {
    const message = error?.message ?? '';
    const code = error?.code ?? '';
    if (message.includes('TASK_ASSIGNEE_NOT_PROJECT_MEMBER')) {
      throw new BadRequestException({
        code: 'TASK_ASSIGNEE_NOT_PROJECT_MEMBER',
        message: 'Người nhận việc phải là thành viên dự án.',
      });
    }
    if (message.includes('TASK_ASSIGNEE_INVALID_USER')) {
      throw new BadRequestException({
        code: 'TASK_ASSIGNEE_INVALID_USER',
        message: 'Người nhận việc phải là thành viên nội bộ đang hoạt động.',
      });
    }
    if (message.includes('PARENT_TASK_NOT_FOUND') || code === 'P4034') {
      throw new BadRequestException({
        code: 'PARENT_TASK_NOT_FOUND',
        message: 'Không tìm thấy công việc cha.',
      });
    }
    if (message.includes('INVALID_PARENT_TASK_PROJECT') || code === 'P4036') {
      throw new BadRequestException({
        code: 'INVALID_PARENT_TASK_PROJECT',
        message: 'Công việc cha phải thuộc cùng dự án.',
      });
    }
    if (message.includes('TASK_SELF_PARENT_DENIED') || code === 'P4035') {
      throw new BadRequestException({
        code: 'TASK_SELF_PARENT_DENIED',
        message: 'Công việc không thể là cha của chính nó.',
      });
    }
    if (message.includes('INVALID_TASK_DATE_RANGE') || code === 'P4037') {
      throw new BadRequestException({
        code: 'INVALID_TASK_DATE_RANGE',
        message: 'Ngày hết hạn không được trước ngày bắt đầu.',
      });
    }
    if (message.includes('TASK_NOT_FOUND') || code === 'P4030') {
      throw new NotFoundException({
        code: 'TASK_NOT_FOUND',
        message: 'Không tìm thấy công việc.',
      });
    }
    if (message.includes('TASK_PROJECT_CHANGED') || code === 'P4031') {
      // Safe error mapping: do not reveal task cross-project existence
      throw new NotFoundException({
        code: 'TASK_NOT_FOUND',
        message: 'Không tìm thấy công việc.',
      });
    }
    if (message.includes('TASK_ORDERING_RPC_REQUIRED')) {
      throw new InternalServerErrorException({
        code: 'TASK_WRITE_FAILED',
        message: 'Yêu cầu cập nhật vị trí Kanban không hợp lệ.',
      });
    }
    this.databaseFailure(
      'TASK_WRITE_FAILED',
      'Không thể lưu công việc lúc này.',
      error,
    );
  }

  async getTasks(projectId: string, filters: TaskListQuery, user: RequestUser) {
    const access = await this.getAccess(projectId, user);
    const offset = (filters.page - 1) * filters.pageSize;
    let query = this.client
      .from('tasks')
      .select(
        '*, assignee:profiles!tasks_assignee_user_id_fkey(id,full_name,email,avatar_url)',
        { count: 'exact' },
      );
    query = query.eq('project_id', projectId);
    if (filters.q) query = query.ilike('title', `%${filters.q.trim()}%`);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.priority) query = query.eq('priority', filters.priority);
    if (filters.assigneeUserId)
      query = query.eq('assignee_user_id', filters.assigneeUserId);
    if (filters.parentTaskId)
      query = query.eq('parent_task_id', filters.parentTaskId);

    const { data, count, error } = await query
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + filters.pageSize - 1);
    if (error) {
      this.databaseFailure(
        'TASKS_LOOKUP_FAILED',
        'Không thể truy vấn danh sách công việc.',
        error,
      );
    }
    const total = count ?? 0;
    return {
      items: (data ?? []).map((task) => ({
        ...task,
        canUpdateStatus:
          access.isAdmin ||
          access.projectRole === 'project_manager' ||
          task.assignee_user_id === user.profileId,
      })),
      page: filters.page,
      pageSize: filters.pageSize,
      total,
      totalPages: Math.ceil(total / filters.pageSize),
    };
  }

  async getTask(projectId: string, taskId: string, user: RequestUser) {
    const access = await this.getAccess(projectId, user);
    const task = await this.getTaskRow(projectId, taskId);
    return {
      ...task,
      canUpdateStatus:
        access.isAdmin ||
        access.projectRole === 'project_manager' ||
        task.assignee_user_id === user.profileId,
    };
  }

  async createTask(projectId: string, dto: CreateTaskDto, user: RequestUser) {
    const access = await this.getAccess(projectId, user);
    if (!access.isAdmin && access.projectRole !== 'project_manager') {
      throw new ForbiddenException({
        code: 'TASK_ACCESS_DENIED',
        message: 'Chỉ quản lý dự án mới có thể tạo công việc.',
      });
    }
    if (dto.assigneeUserId) {
      await this.validateAssignee(projectId, dto.assigneeUserId);
    }
    if (dto.parentTaskId) {
      await this.validateParent(projectId, dto.parentTaskId);
    }
    const { data, error } = await this.client
      .from('tasks')
      .insert({
        project_id: projectId,
        parent_task_id: dto.parentTaskId ?? null,
        title: dto.title,
        description: dto.description ?? null,
        status: dto.status,
        priority: dto.priority,
        assignee_user_id: dto.assigneeUserId ?? null,
        reporter_user_id: user.profileId,
        start_date: dto.startDate ?? null,
        due_date: dto.dueDate ?? null,
        sort_order: dto.sortOrder,
        created_by: user.profileId,
        updated_by: user.profileId,
      })
      .select()
      .single();
    if (error) this.mapWriteError(error);
    this.emit(projectId, data.id, 'task.created', data.updated_at, {
      status: data.status,
    });
    await this.runTaskSideEffects(
      'task.created',
      `task.created:${data.id}`,
      data,
      user,
    );
    if (data.assignee_user_id) {
      await this.runTaskSideEffects(
        'task.assigned',
        `task.assigned:${data.id}:${data.assignee_user_id}`,
        data,
        user,
      );
    }
    return data;
  }

  async updateTask(
    projectId: string,
    taskId: string,
    dto: UpdateTaskDto,
    user: RequestUser,
  ) {
    const access = await this.getAccess(projectId, user);
    if (!access.isAdmin && access.projectRole === 'viewer') {
      throw new ForbiddenException({
        code: 'TASK_ACCESS_DENIED',
        message: 'Người xem chỉ có quyền đọc công việc.',
      });
    }
    const existing = await this.getTaskRow(projectId, taskId);
    const manager = access.isAdmin || access.projectRole === 'project_manager';
    if (!manager) {
      const fields = Object.keys(dto);
      const assigned = existing.assignee_user_id === user.profileId;
      if (!assigned || fields.some((field) => field !== 'status')) {
        throw new ForbiddenException({
          code: 'TASK_ACCESS_DENIED',
          message: 'Thành viên được giao việc chỉ có thể cập nhật trạng thái.',
        });
      }
    }

    if (dto.assigneeUserId) {
      await this.validateAssignee(projectId, dto.assigneeUserId);
    }
    if (dto.parentTaskId) {
      await this.validateParent(projectId, dto.parentTaskId, taskId);
    }
    const effectiveStart =
      dto.startDate !== undefined ? dto.startDate : existing.start_date;
    const effectiveDue =
      dto.dueDate !== undefined ? dto.dueDate : existing.due_date;
    if (effectiveStart && effectiveDue && effectiveDue < effectiveStart) {
      throw new BadRequestException({
        code: 'INVALID_TASK_DATE_RANGE',
        message: 'Ngày hết hạn không được trước ngày bắt đầu.',
      });
    }

    let data: Record<string, any> | null = null;

    if (dto.status !== undefined) {
      // CASE B: status is provided, perform single atomic RPC update
      const { data: statusData, error } = await this.client.rpc(
        'phase4_update_task_atomic',
        {
          p_project_id: projectId,
          p_task_id: taskId,
          p_actor_user_id: user.profileId,
          p_set_parent_task: dto.parentTaskId !== undefined,
          p_parent_task_id: dto.parentTaskId ?? null,
          p_set_title: dto.title !== undefined,
          p_title: dto.title ?? null,
          p_set_description: dto.description !== undefined,
          p_description: dto.description ?? null,
          p_set_status: true,
          p_status: dto.status,
          p_set_priority: dto.priority !== undefined,
          p_priority: dto.priority ?? null,
          p_set_assignee: dto.assigneeUserId !== undefined,
          p_assignee_user_id: dto.assigneeUserId ?? null,
          p_set_start_date: dto.startDate !== undefined,
          p_start_date: dto.startDate ?? null,
          p_set_due_date: dto.dueDate !== undefined,
          p_due_date: dto.dueDate ?? null,
        },
      );
      if (error) this.mapWriteError(error);
      data = (Array.isArray(statusData) ? statusData[0] : statusData) as Record<
        string,
        any
      > | null;
    } else {
      // CASE A: status is NOT provided, perform normal tasks table update
      const payload: Record<string, unknown> = { updated_by: user.profileId };
      if (dto.parentTaskId !== undefined)
        payload.parent_task_id = dto.parentTaskId;
      if (dto.title !== undefined) payload.title = dto.title;
      if (dto.description !== undefined)
        payload.description = dto.description ?? null;
      if (dto.priority !== undefined) payload.priority = dto.priority;
      if (dto.assigneeUserId !== undefined)
        payload.assignee_user_id = dto.assigneeUserId;
      if (dto.startDate !== undefined) payload.start_date = dto.startDate;
      if (dto.dueDate !== undefined) payload.due_date = dto.dueDate;

      if (Object.keys(payload).length > 1) {
        const { data: updated, error } = await this.client
          .from('tasks')
          .update(payload)
          .eq('id', taskId)
          .select()
          .single();
        if (error) this.mapWriteError(error);
        data = updated as Record<string, any>;
      } else {
        data = existing;
      }
    }

    if (!data) {
      this.databaseFailure(
        'TASK_WRITE_FAILED',
        'Không thể lưu công việc lúc này.',
        new Error('Task mutation returned no row'),
      );
    }
    this.emit(projectId, taskId, 'task.updated', data.updated_at, {
      status: data.status,
    });
    await this.runTaskSideEffects(
      'task.updated',
      `task.updated:${taskId}:${data.updated_at}`,
      data,
      user,
      existing,
    );
    if (
      data.assignee_user_id &&
      data.assignee_user_id !== existing.assignee_user_id
    ) {
      await this.runTaskSideEffects(
        'task.assigned',
        `task.assigned:${taskId}:${data.assignee_user_id}`,
        data,
        user,
        existing,
      );
    }
    return data;
  }
}
