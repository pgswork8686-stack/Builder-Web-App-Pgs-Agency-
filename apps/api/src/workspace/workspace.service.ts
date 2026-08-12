import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import type { RequestUser } from '../auth/auth.types';
import { SupabaseService } from '../supabase/supabase.service';
import type {
  BoardQuery,
  CalendarQuery,
  MoveTaskDto,
} from './dto/workspace.dto';
import { WorkspaceAccessService } from './workspace-access.service';
import {
  WorkspaceRealtimeGateway,
  type WorkspaceEvent,
} from './workspace-realtime.gateway';

const ACTIVE_STATUSES = ['todo', 'in_progress', 'review', 'done'] as const;

@Injectable()
export class WorkspaceService {
  private readonly logger = new Logger(WorkspaceService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly accessService: WorkspaceAccessService,
    private readonly realtime: WorkspaceRealtimeGateway,
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
      const detail = error instanceof Error ? error.message : 'unknown error';
      this.logger.error(`Realtime broadcast failed: ${detail}`);
    }
  }

  async getBoard(projectId: string, filters: BoardQuery, user: RequestUser) {
    const access = await this.accessService.requireProjectAccess(
      projectId,
      user,
      'PROJECT_ACCESS_DENIED',
    );

    let query = this.client
      .from('tasks')
      .select(
        'id,project_id,parent_task_id,title,status,priority,assignee_user_id,start_date,due_date,completed_at,sort_order,created_at,updated_at,assignee:profiles!tasks_assignee_user_id_fkey(id,full_name,email,avatar_url)',
        { count: 'exact' },
      );
    query = query.eq('project_id', projectId);
    if (filters.status) {
      query = query.eq('status', filters.status);
    } else {
      query = query.in('status', [...ACTIVE_STATUSES]);
    }
    if (filters.q) query = query.ilike('title', `%${filters.q}%`);
    if (filters.priority) query = query.eq('priority', filters.priority);
    if (filters.assigneeUserId) {
      query = query.eq('assignee_user_id', filters.assigneeUserId);
    }

    const { data, count, error } = await query
      .order('status', { ascending: true })
      .order('sort_order', { ascending: true })
      .order('id', { ascending: true })
      .range(0, 499);
    if (error) {
      this.databaseFailure(
        'BOARD_LOOKUP_FAILED',
        'Không thể tải bảng công việc lúc này.',
        error,
      );
    }

    const canReorder = access.isManager;
    const items = (data ?? []).map((task) => ({
      ...task,
      canReorder,
      canUpdateStatus:
        canReorder ||
        (access.projectRole !== 'viewer' &&
          task.assignee_user_id === user.profileId),
    }));

    return {
      todo: items.filter((task) => task.status === 'todo'),
      inProgress: items.filter((task) => task.status === 'in_progress'),
      review: items.filter((task) => task.status === 'review'),
      done: items.filter((task) => task.status === 'done'),
      canReorder,
      total: count ?? items.length,
      truncated: (count ?? items.length) > 500,
      limit: 500,
    };
  }

  async getCalendar(
    projectId: string,
    range: CalendarQuery,
    user: RequestUser,
  ) {
    await this.accessService.requireProjectAccess(
      projectId,
      user,
      'PROJECT_ACCESS_DENIED',
    );

    const intersection = [
      `and(start_date.not.is.null,due_date.not.is.null,start_date.lte.${range.to},due_date.gte.${range.from})`,
      `and(start_date.is.null,due_date.gte.${range.from},due_date.lte.${range.to})`,
      `and(due_date.is.null,start_date.gte.${range.from},start_date.lte.${range.to})`,
    ].join(',');

    const { data, error } = await this.client
      .from('tasks')
      .select(
        'id,title,status,priority,start_date,due_date,assignee:profiles!tasks_assignee_user_id_fkey(id,full_name,email,avatar_url)',
      )
      .eq('project_id', projectId)
      .or(intersection)
      .order('start_date', { ascending: true, nullsFirst: false })
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('id', { ascending: true });
    if (error) {
      this.databaseFailure(
        'CALENDAR_LOOKUP_FAILED',
        'Không thể tải lịch công việc lúc này.',
        error,
      );
    }

    return (data ?? []).map((task) => ({
      taskId: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      assignee: task.assignee ?? null,
      startDate: task.start_date ?? null,
      dueDate: task.due_date ?? null,
    }));
  }

  async moveTask(
    projectId: string,
    taskId: string,
    dto: MoveTaskDto,
    user: RequestUser,
  ) {
    const access = await this.accessService.requireProjectAccess(
      projectId,
      user,
      'KANBAN_MOVE_DENIED',
    );
    if (!access.isManager) {
      throw new ForbiddenException({
        code: 'KANBAN_MOVE_DENIED',
        message: 'Chỉ Admin hoặc quản lý dự án mới có thể kéo và sắp xếp.',
      });
    }
    await this.accessService.requireTask(
      projectId,
      taskId,
      'KANBAN_MOVE_DENIED',
    );

    const { data, error } = await this.client.rpc('move_task_on_board', {
      p_task_id: taskId,
      p_target_status: dto.status,
      p_actor_user_id: user.profileId,
      p_before_task_id: dto.beforeTaskId ?? null,
      p_after_task_id: dto.afterTaskId ?? null,
    });
    if (error) {
      if (String(error.message).includes('KANBAN_TARGET_INVALID')) {
        throw new BadRequestException({
          code: 'KANBAN_TARGET_INVALID',
          message: 'Vị trí đích trên bảng công việc không hợp lệ.',
        });
      }
      this.databaseFailure(
        'TASK_REORDER_FAILED',
        'Không thể di chuyển công việc lúc này.',
        error,
      );
    }

    const moved = Array.isArray(data) ? data[0] : data;
    this.emit({
      projectId,
      entityId: taskId,
      event: 'task.moved',
      updatedAt: moved?.updated_at ?? new Date().toISOString(),
      changes: { status: dto.status, sortOrder: moved?.sort_order },
    });
    return moved;
  }
}
