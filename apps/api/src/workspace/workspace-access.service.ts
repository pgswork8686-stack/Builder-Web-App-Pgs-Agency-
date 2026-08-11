import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { RequestUser } from '../auth/auth.types';
import { SupabaseService } from '../supabase/supabase.service';

export interface WorkspaceProjectAccess {
  isAdmin: boolean;
  isManager: boolean;
  projectRole: string;
}

@Injectable()
export class WorkspaceAccessService {
  private readonly logger = new Logger(WorkspaceAccessService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  private get client() {
    return this.supabaseService.getSystemClient();
  }

  private databaseFailure(code: string, error: unknown): never {
    const message =
      typeof error === 'object' && error && 'message' in error
        ? String(error.message)
        : 'unknown database error';
    this.logger.error(`${code}: ${message}`);
    throw new InternalServerErrorException({
      code,
      message: 'Không thể kiểm tra quyền dự án lúc này.',
    });
  }

  async requireProjectAccess(
    projectId: string,
    user: RequestUser,
    deniedCode: string,
  ): Promise<WorkspaceProjectAccess> {
    if (user.role === 'client') {
      throw new ForbiddenException({
        code: deniedCode,
        message: 'Không có quyền truy cập workspace nội bộ.',
      });
    }

    const { data: project, error: projectError } = await this.client
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .maybeSingle();
    if (projectError)
      this.databaseFailure('PROJECT_LOOKUP_FAILED', projectError);
    if (!project) {
      throw new NotFoundException({
        code: 'PROJECT_NOT_FOUND',
        message: 'Không tìm thấy dự án.',
      });
    }

    if (user.role === 'admin') {
      return {
        isAdmin: true,
        isManager: true,
        projectRole: 'project_manager',
      };
    }

    const { data: membership, error } = await this.client
      .from('project_memberships')
      .select('project_role')
      .eq('project_id', projectId)
      .eq('user_id', user.profileId)
      .maybeSingle();
    if (error) this.databaseFailure('PROJECT_ACCESS_LOOKUP_FAILED', error);
    if (!membership || membership.project_role === 'client_contact') {
      throw new ForbiddenException({
        code: deniedCode,
        message: 'Bạn không có quyền truy cập workspace của dự án này.',
      });
    }

    return {
      isAdmin: false,
      isManager: membership.project_role === 'project_manager',
      projectRole: String(membership.project_role),
    };
  }

  async requireTask(
    projectId: string,
    taskId: string,
    deniedCode: string,
  ): Promise<Record<string, any>> {
    const { data: task, error } = await this.client
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .maybeSingle();
    if (error) this.databaseFailure('TASK_LOOKUP_FAILED', error);
    if (!task) {
      throw new NotFoundException({
        code: 'TASK_NOT_FOUND',
        message: 'Không tìm thấy công việc.',
      });
    }
    if (task.project_id !== projectId) {
      throw new ForbiddenException({
        code: deniedCode,
        message: 'Công việc không thuộc dự án được yêu cầu.',
      });
    }
    return task as Record<string, any>;
  }
}
