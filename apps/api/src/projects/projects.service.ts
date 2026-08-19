import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
  CreateProjectDto,
  CreateProjectMembershipDto,
  CreateProjectServiceDto,
  ProjectListQuery,
  UpdateProjectDto,
  UpdateProjectMembershipDto,
  UpdateProjectServiceItemDto,
  UpdateProjectServiceDto,
} from './dto/project.dto';
import type { AppRole } from '../auth/auth.types';

type ProjectRow = Record<string, any>;

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  private get client() {
    return this.supabaseService.getSystemClient();
  }

  private databaseFailure(code: string, message: string, error: any): never {
    this.logger.error(`${code}: ${error?.message ?? 'unknown database error'}`);
    throw new InternalServerErrorException({ code, message });
  }

  private mapProject(row: ProjectRow) {
    return {
      id: row.id,
      projectCode: row.project_code,
      clientCompanyId: row.client_company_id,
      clientCompany: row.client_company ?? null,
      name: row.name,
      description: row.description ?? null,
      status: row.status,
      priority: row.priority,
      projectManagerUserId: row.project_manager_user_id ?? null,
      projectManager: row.project_manager ?? null,
      startDate: row.start_date ?? null,
      dueDate: row.due_date ?? null,
      completedAt: row.completed_at ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      members: row.project_memberships ?? undefined,
      services: row.project_services ?? undefined,
    };
  }

  private async getProjectRow(projectId: string) {
    const { data, error } = await this.client
      .from('projects')
      .select(
        '*, client_company:client_companies(id,code,name,status), project_manager:profiles!projects_project_manager_user_id_fkey(id,full_name,email,avatar_url)',
      )
      .eq('id', projectId)
      .maybeSingle();

    if (error) {
      this.databaseFailure(
        'PROJECT_LOOKUP_FAILED',
        'Không thể truy vấn dự án lúc này.',
        error,
      );
    }
    if (!data) {
      throw new NotFoundException({
        code: 'PROJECT_NOT_FOUND',
        message: 'Không tìm thấy dự án được yêu cầu.',
      });
    }
    return data;
  }

  private async requireClientCompany(clientCompanyId: string) {
    const { data, error } = await this.client
      .from('client_companies')
      .select('id')
      .eq('id', clientCompanyId)
      .maybeSingle();

    if (error) {
      this.databaseFailure(
        'CLIENT_LOOKUP_FAILED',
        'Không thể kiểm tra công ty khách hàng.',
        error,
      );
    }
    if (!data) {
      throw new NotFoundException({
        code: 'CLIENT_NOT_FOUND',
        message: 'Không tìm thấy công ty khách hàng.',
      });
    }
  }

  private async getActiveProfile(userId: string) {
    const { data, error } = await this.client
      .from('profiles')
      .select('id,role,account_status,full_name,email,avatar_url')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      this.databaseFailure(
        'PROJECT_MEMBER_LOOKUP_FAILED',
        'Không thể kiểm tra người dùng.',
        error,
      );
    }
    if (!data) {
      throw new NotFoundException({
        code: 'PROJECT_MEMBER_NOT_FOUND',
        message: 'Không tìm thấy người dùng được yêu cầu.',
      });
    }
    if (data.account_status !== 'active') {
      throw new BadRequestException({
        code: 'USER_NOT_ACTIVE',
        message: 'Người dùng phải có tài khoản đang hoạt động.',
      });
    }
    return data;
  }

  private async validateProjectManager(userId: string) {
    let profile: ProjectRow;
    try {
      profile = await this.getActiveProfile(userId);
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw new BadRequestException({
          code: 'INVALID_PROJECT_MANAGER',
          message: 'Quản lý dự án phải là người dùng nội bộ đang hoạt động.',
        });
      }
      throw error;
    }
    if (profile.role === 'client') {
      throw new BadRequestException({
        code: 'INVALID_PROJECT_MANAGER',
        message: 'Khách hàng không thể là quản lý dự án.',
      });
    }
    return profile;
  }

  private mapProjectManagerWriteError(error: any): never {
    const message = error?.message ?? '';
    if (
      message.includes('INVALID_PROJECT_MANAGER') ||
      message.includes('INVALID_PROJECT_MEMBER_ROLE') ||
      message.includes('USER_NOT_FOUND') ||
      message.includes('USER_NOT_ACTIVE')
    ) {
      throw new BadRequestException({
        code: 'INVALID_PROJECT_MANAGER',
        message: 'Quản lý dự án phải là người dùng nội bộ đang hoạt động.',
      });
    }
    if (message.includes('PRIMARY_PROJECT_MANAGER_MEMBERSHIP_REQUIRED')) {
      throw new ConflictException({
        code: 'PROJECT_MANAGER_CONSISTENCY_REQUIRED',
        message: 'Không thể thay đổi thành viên quản lý dự án chính.',
      });
    }
    this.databaseFailure(
      'PROJECT_CREATE_FAILED',
      'Không thể tạo dự án lúc này. ' + (error?.message ?? ''),
      error,
    );
  }

  private mapMembershipWriteError(error: any): never {
    const message = error?.message ?? '';
    if (error?.code === '23505') {
      throw new ConflictException({
        code: 'PROJECT_MEMBER_ALREADY_EXISTS',
        message: 'Người dùng đã là thành viên dự án.',
      });
    }
    if (message.includes('USER_NOT_FOUND')) {
      throw new NotFoundException({
        code: 'PROJECT_MEMBER_NOT_FOUND',
        message: 'Không tìm thấy người dùng được yêu cầu.',
      });
    }
    if (message.includes('USER_NOT_ACTIVE')) {
      throw new BadRequestException({
        code: 'USER_NOT_ACTIVE',
        message: 'Người dùng phải có tài khoản đang hoạt động.',
      });
    }
    if (message.includes('INVALID_PROJECT_MEMBER_ROLE')) {
      throw new BadRequestException({
        code: 'INVALID_PROJECT_MEMBER_ROLE',
        message: 'Vai trò thành viên không hợp lệ với người dùng.',
      });
    }
    if (message.includes('CLIENT_CONTACT_COMPANY_MISMATCH')) {
      throw new BadRequestException({
        code: 'CLIENT_CONTACT_COMPANY_MISMATCH',
        message: 'Người dùng client không thuộc công ty của dự án.',
      });
    }
    if (message.includes('PRIMARY_PROJECT_MANAGER_MEMBERSHIP_REQUIRED')) {
      throw new ConflictException({
        code: 'PROJECT_MANAGER_CONSISTENCY_REQUIRED',
        message: 'Không thể thay đổi thành viên quản lý dự án chính.',
      });
    }
    if (message.includes('PROJECT_MEMBER_HAS_ASSIGNED_TASKS')) {
      throw new ConflictException({
        code: 'PROJECT_MEMBER_HAS_ASSIGNED_TASKS',
        message:
          'Không thể xóa thành viên đang được giao công việc trong dự án.',
      });
    }
    this.databaseFailure(
      'PROJECT_MEMBER_WRITE_FAILED',
      'Không thể lưu thành viên dự án lúc này.',
      error,
    );
  }

  async getAdminProjects(filters: ProjectListQuery) {
    const offset = (filters.page - 1) * filters.pageSize;
    let query = this.client
      .from('projects')
      .select(
        '*, client_company:client_companies(id,code,name,status), project_manager:profiles!projects_project_manager_user_id_fkey(id,full_name,email,avatar_url)',
        { count: 'exact' },
      );

    if (filters.q) {
      const term = filters.q.trim();
      query = query.or(`project_code.ilike.%${term}%,name.ilike.%${term}%`);
    }
    if (filters.clientCompanyId) {
      query = query.eq('client_company_id', filters.clientCompanyId);
    }
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.priority) query = query.eq('priority', filters.priority);
    if (filters.projectManagerUserId) {
      query = query.eq('project_manager_user_id', filters.projectManagerUserId);
    }

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + filters.pageSize - 1);

    if (error) {
      this.databaseFailure(
        'PROJECTS_LOOKUP_FAILED',
        'Không thể truy vấn danh sách dự án.',
        error,
      );
    }
    const total = count ?? 0;
    return {
      items: (data ?? []).map((row) => this.mapProject(row)),
      page: filters.page,
      pageSize: filters.pageSize,
      total,
      totalPages: Math.ceil(total / filters.pageSize),
    };
  }

  async getAdminProjectById(projectId: string) {
    return this.mapProject(await this.getProjectRow(projectId));
  }

  async createProject(dto: CreateProjectDto, actorUserId: string) {
    await this.requireClientCompany(dto.clientCompanyId);
    if (dto.projectManagerUserId) {
      await this.validateProjectManager(dto.projectManagerUserId);
    }

    const { data: existing, error: existingError } = await this.client
      .from('projects')
      .select('id')
      .eq('project_code', dto.projectCode)
      .maybeSingle();
    if (existingError) {
      this.databaseFailure(
        'PROJECT_CODE_LOOKUP_FAILED',
        'Không thể kiểm tra mã dự án.',
        existingError,
      );
    }
    if (existing) {
      throw new ConflictException({
        code: 'PROJECT_CODE_ALREADY_EXISTS',
        message: 'Mã dự án đã tồn tại.',
      });
    }

    const { data, error } = await this.client
      .from('projects')
      .insert({
        project_code: dto.projectCode,
        client_company_id: dto.clientCompanyId,
        name: dto.name,
        description: dto.description ?? null,
        status: dto.status,
        priority: dto.priority,
        project_manager_user_id: dto.projectManagerUserId ?? null,
        start_date: dto.startDate ?? null,
        due_date: dto.dueDate ?? null,
        created_by: actorUserId,
        updated_by: actorUserId,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new ConflictException({
          code: 'PROJECT_CODE_ALREADY_EXISTS',
          message: 'Mã dự án đã tồn tại.',
        });
      }
      if (dto.projectManagerUserId) {
        this.mapProjectManagerWriteError(error);
      }
      this.databaseFailure(
        'PROJECT_CREATE_FAILED',
        'Không thể tạo dự án lúc này.',
        error,
      );
    }
    return this.mapProject(data);
  }

  async updateProject(
    projectId: string,
    dto: UpdateProjectDto,
    actorUserId: string,
  ) {
    const existing = await this.getProjectRow(projectId);
    if (dto.clientCompanyId) {
      await this.requireClientCompany(dto.clientCompanyId);
    }
    if (dto.projectManagerUserId) {
      await this.validateProjectManager(dto.projectManagerUserId);
    }

    const effectiveStart =
      dto.startDate !== undefined ? dto.startDate : existing.start_date;
    const effectiveDue =
      dto.dueDate !== undefined ? dto.dueDate : existing.due_date;
    if (effectiveStart && effectiveDue && effectiveDue < effectiveStart) {
      throw new BadRequestException({
        code: 'INVALID_PROJECT_DATE_RANGE',
        message: 'Ngày kết thúc không được trước ngày bắt đầu.',
      });
    }

    const payload: Record<string, unknown> = { updated_by: actorUserId };
    if (dto.clientCompanyId !== undefined)
      payload.client_company_id = dto.clientCompanyId;
    if (dto.name !== undefined) payload.name = dto.name;
    if (dto.description !== undefined)
      payload.description = dto.description ?? null;
    if (dto.status !== undefined) payload.status = dto.status;
    if (dto.priority !== undefined) payload.priority = dto.priority;
    if (dto.projectManagerUserId !== undefined)
      payload.project_manager_user_id = dto.projectManagerUserId;
    if (dto.startDate !== undefined) payload.start_date = dto.startDate;
    if (dto.dueDate !== undefined) payload.due_date = dto.dueDate;

    const { data, error } = await this.client
      .from('projects')
      .update(payload)
      .eq('id', projectId)
      .select()
      .single();

    if (error) {
      if (dto.projectManagerUserId) {
        this.mapProjectManagerWriteError(error);
      }
      if (error.message?.includes('CLIENT_CONTACT_COMPANY_MISMATCH')) {
        throw new BadRequestException({
          code: 'CLIENT_CONTACT_COMPANY_MISMATCH',
          message:
            'Không thể đổi công ty khi thành viên client không thuộc công ty mới.',
        });
      }
      this.databaseFailure(
        'PROJECT_UPDATE_FAILED',
        'Không thể cập nhật dự án lúc này.',
        error,
      );
    }
    return this.mapProject(data);
  }

  async getMemberships(projectId: string) {
    await this.getProjectRow(projectId);
    const { data, error } = await this.client
      .from('project_memberships')
      .select(
        '*, profile:profiles!project_memberships_user_id_fkey(id,full_name,email,avatar_url,role,account_status)',
      )
      .eq('project_id', projectId)
      .order('joined_at', { ascending: true });
    if (error) {
      this.databaseFailure(
        'PROJECT_MEMBERS_LOOKUP_FAILED',
        'Không thể truy vấn thành viên dự án.',
        error,
      );
    }
    return (data ?? []).map((row) => ({
      id: row.id,
      projectId: row.project_id,
      userId: row.user_id,
      projectRole: row.project_role,
      joinedAt: row.joined_at,
      updatedAt: row.updated_at,
      profile: row.profile ?? null,
    }));
  }

  private async validateMembershipRole(
    project: ProjectRow,
    userId: string,
    projectRole: CreateProjectMembershipDto['projectRole'],
  ) {
    const profile = await this.getActiveProfile(userId);
    if (
      (projectRole === 'project_manager' || projectRole === 'member') &&
      profile.role === 'client'
    ) {
      throw new BadRequestException({
        code: 'INVALID_PROJECT_MEMBER_ROLE',
        message: 'Khách hàng không thể nhận vai trò nội bộ của dự án.',
      });
    }
    if (projectRole === 'client_contact') {
      if (profile.role !== 'client') {
        throw new BadRequestException({
          code: 'INVALID_PROJECT_MEMBER_ROLE',
          message: 'Chỉ người dùng client mới có thể là liên hệ khách hàng.',
        });
      }
    }
    if (profile.role === 'client') {
      const { data, error } = await this.client
        .from('client_memberships')
        .select('id')
        .eq('user_id', userId)
        .eq('client_company_id', project.client_company_id)
        .maybeSingle();
      if (error) {
        this.databaseFailure(
          'CLIENT_MEMBERSHIP_LOOKUP_FAILED',
          'Không thể kiểm tra phạm vi công ty khách hàng.',
          error,
        );
      }
      if (!data) {
        throw new BadRequestException({
          code: 'CLIENT_CONTACT_COMPANY_MISMATCH',
          message: 'Liên hệ khách hàng không thuộc công ty của dự án.',
        });
      }
    }
  }

  async createMembership(
    projectId: string,
    dto: CreateProjectMembershipDto,
    actorUserId: string,
  ) {
    const project = await this.getProjectRow(projectId);
    await this.validateMembershipRole(project, dto.userId, dto.projectRole);
    const { data, error } = await this.client
      .from('project_memberships')
      .insert({
        project_id: projectId,
        user_id: dto.userId,
        project_role: dto.projectRole,
        created_by: actorUserId,
      })
      .select()
      .single();
    if (error) {
      this.mapMembershipWriteError(error);
    }
    return data;
  }

  async updateMembership(
    projectId: string,
    membershipId: string,
    dto: UpdateProjectMembershipDto,
  ) {
    const project = await this.getProjectRow(projectId);
    const { data: membership, error: lookupError } = await this.client
      .from('project_memberships')
      .select('*')
      .eq('project_id', projectId)
      .eq('id', membershipId)
      .maybeSingle();
    if (lookupError) {
      this.databaseFailure(
        'PROJECT_MEMBER_LOOKUP_FAILED',
        'Không thể kiểm tra thành viên dự án.',
        lookupError,
      );
    }
    if (!membership) {
      throw new NotFoundException({
        code: 'PROJECT_MEMBER_NOT_FOUND',
        message: 'Không tìm thấy thành viên dự án.',
      });
    }
    if (dto.projectRole) {
      if (
        project.project_manager_user_id === membership.user_id &&
        dto.projectRole !== 'project_manager'
      ) {
        throw new ConflictException({
          code: 'PROJECT_MANAGER_CONSISTENCY_REQUIRED',
          message: 'Không thể hạ vai trò của quản lý dự án chính.',
        });
      }
      await this.validateMembershipRole(
        project,
        membership.user_id,
        dto.projectRole,
      );
    }
    const { data, error } = await this.client
      .from('project_memberships')
      .update({ project_role: dto.projectRole })
      .eq('id', membershipId)
      .select()
      .single();
    if (error) {
      this.mapMembershipWriteError(error);
    }
    return data;
  }

  async deleteMembership(projectId: string, membershipId: string) {
    const project = await this.getProjectRow(projectId);
    const { data: membership, error: lookupError } = await this.client
      .from('project_memberships')
      .select('id,user_id')
      .eq('project_id', projectId)
      .eq('id', membershipId)
      .maybeSingle();
    if (lookupError) {
      this.databaseFailure(
        'PROJECT_MEMBER_LOOKUP_FAILED',
        'Không thể kiểm tra thành viên dự án.',
        lookupError,
      );
    }
    if (!membership) {
      throw new NotFoundException({
        code: 'PROJECT_MEMBER_NOT_FOUND',
        message: 'Không tìm thấy thành viên dự án.',
      });
    }
    if (project.project_manager_user_id === membership.user_id) {
      throw new ConflictException({
        code: 'PROJECT_MANAGER_CONSISTENCY_REQUIRED',
        message: 'Không thể xóa quản lý dự án chính khỏi thành viên.',
      });
    }

    const { data: assignedTasks, error: assignedTasksError } = await this.client
      .from('tasks')
      .select('id')
      .eq('project_id', projectId)
      .eq('assignee_user_id', membership.user_id)
      .limit(1);

    if (assignedTasksError) {
      this.databaseFailure(
        'PROJECT_MEMBER_TASK_LOOKUP_FAILED',
        'Không thể kiểm tra công việc đang giao cho thành viên.',
        assignedTasksError,
      );
    }
    if ((assignedTasks ?? []).length > 0) {
      throw new ConflictException({
        code: 'PROJECT_MEMBER_HAS_ASSIGNED_TASKS',
        message:
          'Không thể xóa thành viên đang được giao công việc trong dự án.',
      });
    }

    const { error } = await this.client
      .from('project_memberships')
      .delete()
      .eq('id', membershipId);
    if (error) {
      this.mapMembershipWriteError(error);
    }
    return { success: true };
  }

  async getProjectServices(projectId: string) {
    await this.getProjectRow(projectId);
    const { data, error } = await this.client
      .from('project_services')
      .select(
        '*, service:services(id,code,service_code,name,description,active), items:project_service_items(*)',
      )
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });
    if (error) {
      this.databaseFailure(
        'PROJECT_SERVICES_LOOKUP_FAILED',
        'Không thể truy vấn dịch vụ dự án.',
        error,
      );
    }
    // Sort items by sort_order
    (data ?? []).forEach((ps: any) => {
      if (ps.items && Array.isArray(ps.items)) {
        ps.items.sort(
          (a: any, b: any) =>
            (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
            (a.project_service_item_code ?? '').localeCompare(
              b.project_service_item_code ?? '',
            ),
        );
      }
    });
    return data ?? [];
  }

  private async requireService(serviceId: string) {
    const { data, error } = await this.client
      .from('services')
      .select('id')
      .eq('id', serviceId)
      .maybeSingle();
    if (error) {
      this.databaseFailure(
        'SERVICE_LOOKUP_FAILED',
        'Không thể kiểm tra dịch vụ.',
        error,
      );
    }
    if (!data) {
      throw new NotFoundException({
        code: 'SERVICE_NOT_FOUND',
        message: 'Không tìm thấy dịch vụ.',
      });
    }
  }

  async createProjectService(
    projectId: string,
    dto: CreateProjectServiceDto,
    actorUserId: string,
  ) {
    await this.getProjectRow(projectId);
    await this.requireService(dto.serviceId);
    if (dto.startedAt && dto.endedAt && dto.endedAt < dto.startedAt) {
      throw new BadRequestException({
        code: 'INVALID_PROJECT_SERVICE_DATE_RANGE',
        message: 'Ngày kết thúc dịch vụ không được trước ngày bắt đầu.',
      });
    }
    const { data, error } = await this.client
      .from('project_services')
      .insert({
        project_id: projectId,
        service_id: dto.serviceId,
        status: dto.status,
        notes: dto.notes ?? null,
        started_at: dto.startedAt ?? null,
        ended_at: dto.endedAt ?? null,
        created_by: actorUserId,
        updated_by: actorUserId,
      })
      .select()
      .single();
    if (error) {
      if (error.code === '23505') {
        throw new ConflictException({
          code: 'PROJECT_SERVICE_ALREADY_EXISTS',
          message: 'Dịch vụ đã được gán cho dự án.',
        });
      }
      this.databaseFailure(
        'PROJECT_SERVICE_CREATE_FAILED',
        'Không thể gán dịch vụ cho dự án.',
        error,
      );
    }

    return data;
  }

  async updateProjectService(
    projectId: string,
    projectServiceId: string,
    dto: UpdateProjectServiceDto,
    actorUserId: string,
  ) {
    await this.getProjectRow(projectId);
    const { data: existing, error: lookupError } = await this.client
      .from('project_services')
      .select('*')
      .eq('project_id', projectId)
      .eq('id', projectServiceId)
      .maybeSingle();
    if (lookupError) {
      this.databaseFailure(
        'PROJECT_SERVICE_LOOKUP_FAILED',
        'Không thể kiểm tra dịch vụ dự án.',
        lookupError,
      );
    }
    if (!existing) {
      throw new NotFoundException({
        code: 'PROJECT_SERVICE_NOT_FOUND',
        message: 'Không tìm thấy dịch vụ dự án.',
      });
    }
    const effectiveStart =
      dto.startedAt !== undefined ? dto.startedAt : existing.started_at;
    const effectiveEnd =
      dto.endedAt !== undefined ? dto.endedAt : existing.ended_at;
    if (effectiveStart && effectiveEnd && effectiveEnd < effectiveStart) {
      throw new BadRequestException({
        code: 'INVALID_PROJECT_SERVICE_DATE_RANGE',
        message: 'Ngày kết thúc dịch vụ không được trước ngày bắt đầu.',
      });
    }
    const payload: Record<string, unknown> = { updated_by: actorUserId };
    if (dto.status !== undefined) payload.status = dto.status;
    if (dto.notes !== undefined) payload.notes = dto.notes;
    if (dto.startedAt !== undefined) payload.started_at = dto.startedAt;
    if (dto.endedAt !== undefined) payload.ended_at = dto.endedAt;
    const { data, error } = await this.client
      .from('project_services')
      .update(payload)
      .eq('id', projectServiceId)
      .select()
      .single();
    if (error) {
      this.databaseFailure(
        'PROJECT_SERVICE_UPDATE_FAILED',
        'Không thể cập nhật dịch vụ dự án.',
        error,
      );
    }
    return data;
  }

  async deleteProjectService(projectId: string, projectServiceId: string) {
    await this.getProjectRow(projectId);
    const { data: existing, error: lookupError } = await this.client
      .from('project_services')
      .select('id')
      .eq('project_id', projectId)
      .eq('id', projectServiceId)
      .maybeSingle();
    if (lookupError) {
      this.databaseFailure(
        'PROJECT_SERVICE_LOOKUP_FAILED',
        'Không thể kiểm tra dịch vụ dự án.',
        lookupError,
      );
    }
    if (!existing) {
      throw new NotFoundException({
        code: 'PROJECT_SERVICE_NOT_FOUND',
        message: 'Không tìm thấy dịch vụ dự án.',
      });
    }
    const { error } = await this.client
      .from('project_services')
      .delete()
      .eq('id', projectServiceId);
    if (error) {
      this.databaseFailure(
        'PROJECT_SERVICE_DELETE_FAILED',
        'Không thể gỡ dịch vụ khỏi dự án.',
        error,
      );
    }
    return { success: true };
  }

  // ============================================================
  // PROJECT SERVICE ITEMS (INSTANCE DELIVERABLES)
  // ============================================================

  private async requireProjectReadAccess(
    userId: string,
    role: AppRole,
    projectId: string,
  ): Promise<ProjectRow> {
    if (role === 'admin') {
      return this.getProjectRow(projectId);
    }
    if (role === 'client') {
      const project = await this.getProjectRow(projectId);
      const { data: membership, error: membershipError } = await this.client
        .from('client_memberships')
        .select('id')
        .eq('user_id', userId)
        .eq('client_company_id', project.client_company_id)
        .maybeSingle();

      if (membershipError) {
        this.databaseFailure(
          'PROJECT_ACCESS_LOOKUP_FAILED',
          'Không thể kiểm tra quyền dự án khách hàng.',
          membershipError,
        );
      }
      if (!membership) {
        throw new NotFoundException({
          code: 'PROJECT_NOT_FOUND',
          message: 'Không tìm thấy dự án.',
        });
      }
      return project;
    }

    // Internal roles: team_leader, employee, accountant
    const { data: membership, error: membershipError } = await this.client
      .from('project_memberships')
      .select('id,project_role')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .maybeSingle();

    if (membershipError) {
      this.databaseFailure(
        'PROJECT_ACCESS_LOOKUP_FAILED',
        'Không thể kiểm tra quyền dự án.',
        membershipError,
      );
    }
    if (!membership) {
      throw new ForbiddenException({
        code: 'PROJECT_ACCESS_DENIED',
        message: 'Bạn không có quyền truy cập dự án này.',
      });
    }

    return this.getProjectRow(projectId);
  }

  private async requireProjectWriteAccess(
    userId: string,
    role: AppRole,
    projectId: string,
  ): Promise<ProjectRow> {
    if (role === 'admin') {
      return this.getProjectRow(projectId);
    }
    if (role === 'client' || role === 'accountant') {
      throw new ForbiddenException({
        code: 'PROJECT_ACCESS_DENIED',
        message: 'Bạn không có quyền cập nhật hạng mục dịch vụ dự án.',
      });
    }

    // Internal roles: team_leader, employee
    const { data: membership, error: membershipError } = await this.client
      .from('project_memberships')
      .select('id,project_role')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .maybeSingle();

    if (membershipError) {
      this.databaseFailure(
        'PROJECT_ACCESS_LOOKUP_FAILED',
        'Không thể kiểm tra quyền dự án.',
        membershipError,
      );
    }
    if (!membership) {
      throw new ForbiddenException({
        code: 'PROJECT_ACCESS_DENIED',
        message: 'Bạn không có quyền truy cập dự án này.',
      });
    }

    return this.getProjectRow(projectId);
  }

  async getProjectServiceItems(
    userId: string,
    role: AppRole,
    projectId: string,
    projectServiceId?: string,
  ) {
    await this.requireProjectReadAccess(userId, role, projectId);

    if (projectServiceId) {
      const { data: projectService, error: psError } = await this.client
        .from('project_services')
        .select('id, project_id')
        .eq('id', projectServiceId)
        .eq('project_id', projectId)
        .maybeSingle();

      if (psError) {
        this.databaseFailure(
          'PROJECT_SERVICE_LOOKUP_FAILED',
          'Không thể kiểm tra dịch vụ dự án.',
          psError,
        );
      }
      if (!projectService) {
        throw new NotFoundException({
          code: 'PROJECT_SERVICE_NOT_FOUND',
          message: 'Không tìm thấy dịch vụ dự án.',
        });
      }
    }

    let query = this.client
      .from('project_service_items')
      .select('*')
      .eq('project_id', projectId);

    if (projectServiceId) {
      query = query.eq('project_service_id', projectServiceId);
    }

    const { data, error } = await query
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      this.databaseFailure(
        'PROJECT_SERVICE_ITEMS_LOOKUP_FAILED',
        'Không thể truy vấn hạng mục dịch vụ dự án.',
        error,
      );
    }

    return data ?? [];
  }

  async updateProjectServiceItem(
    userId: string,
    role: AppRole,
    projectId: string,
    itemId: string,
    dto: UpdateProjectServiceItemDto,
  ) {
    await this.requireProjectWriteAccess(userId, role, projectId);

    const { data: existing, error: lookupError } = await this.client
      .from('project_service_items')
      .select('*')
      .eq('id', itemId)
      .eq('project_id', projectId)
      .maybeSingle();

    if (lookupError) {
      this.databaseFailure(
        'PROJECT_SERVICE_ITEM_LOOKUP_FAILED',
        'Không thể kiểm tra hạng mục dịch vụ dự án.',
        lookupError,
      );
    }
    if (!existing) {
      throw new NotFoundException({
        code: 'PROJECT_SERVICE_ITEM_NOT_FOUND',
        message: 'Không tìm thấy hạng mục dịch vụ dự án.',
      });
    }

    const payload: Record<string, unknown> = {
      updated_by: userId,
    };
    if (dto.name !== undefined) payload.name = dto.name;
    if (dto.description !== undefined) payload.description = dto.description;
    if (dto.status !== undefined) payload.status = dto.status;
    if (dto.sortOrder !== undefined) payload.sort_order = dto.sortOrder;

    const { data, error } = await this.client
      .from('project_service_items')
      .update(payload)
      .eq('id', itemId)
      .eq('project_id', projectId)
      .select()
      .single();

    if (error) {
      this.databaseFailure(
        'PROJECT_SERVICE_ITEM_UPDATE_FAILED',
        'Không thể cập nhật hạng mục dịch vụ dự án.',
        error,
      );
    }

    return data;
  }

  async getInternalProjects(userId: string, page = 1, pageSize = 20) {
    const offset = (page - 1) * pageSize;
    const { data, count, error } = await this.client
      .from('project_memberships')
      .select(
        'project:projects(*, client_company:client_companies(id,code,name), project_manager:profiles!projects_project_manager_user_id_fkey(id,full_name,email))',
        { count: 'exact' },
      )
      .eq('user_id', userId)
      .order('joined_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (error) {
      this.databaseFailure(
        'PROJECTS_LOOKUP_FAILED',
        'Không thể truy vấn dự án của người dùng.',
        error,
      );
    }
    const total = count ?? 0;
    return {
      items: (data ?? [])
        .map((row) => row.project)
        .filter(Boolean)
        .map((row) => this.mapProject(row as ProjectRow)),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getInternalProjectById(userId: string, projectId: string) {
    const { data: membership, error: membershipError } = await this.client
      .from('project_memberships')
      .select('id,project_role')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .maybeSingle();
    if (membershipError) {
      this.databaseFailure(
        'PROJECT_ACCESS_LOOKUP_FAILED',
        'Không thể kiểm tra quyền dự án.',
        membershipError,
      );
    }
    if (!membership) {
      throw new ForbiddenException({
        code: 'PROJECT_ACCESS_DENIED',
        message: 'Bạn không có quyền truy cập dự án này.',
      });
    }
    const { data, error } = await this.client
      .from('projects')
      .select(
        '*, client_company:client_companies(id,code,name), project_manager:profiles!projects_project_manager_user_id_fkey(id,full_name,email,avatar_url), project_memberships(id,user_id,project_role,profile:profiles!project_memberships_user_id_fkey(id,full_name,email,avatar_url)), project_services(id,status,notes,started_at,ended_at,service:services(id,code,name,description,active))',
      )
      .eq('id', projectId)
      .maybeSingle();
    if (error) {
      this.databaseFailure(
        'PROJECT_LOOKUP_FAILED',
        'Không thể truy vấn dự án.',
        error,
      );
    }
    if (!data) {
      throw new NotFoundException({
        code: 'PROJECT_NOT_FOUND',
        message: 'Không tìm thấy dự án.',
      });
    }
    return {
      ...this.mapProject(data),
      currentProjectRole: membership.project_role,
    };
  }

  async getClientProjects(userId: string, page = 1, pageSize = 20) {
    const { data: memberships, error: membershipError } = await this.client
      .from('client_memberships')
      .select('client_company_id')
      .eq('user_id', userId);
    if (membershipError) {
      this.databaseFailure(
        'CLIENT_MEMBERSHIPS_LOOKUP_FAILED',
        'Không thể kiểm tra công ty của khách hàng.',
        membershipError,
      );
    }
    const companyIds = (memberships ?? []).map((row) => row.client_company_id);
    if (companyIds.length === 0) {
      return { items: [], page, pageSize, total: 0, totalPages: 0 };
    }
    const offset = (page - 1) * pageSize;
    const { data, count, error } = await this.client
      .from('projects')
      .select('*, client_company:client_companies(id,code,name)', {
        count: 'exact',
      })
      .in('client_company_id', companyIds)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (error) {
      this.databaseFailure(
        'PROJECTS_LOOKUP_FAILED',
        'Không thể truy vấn dự án khách hàng.',
        error,
      );
    }
    const total = count ?? 0;
    return {
      items: (data ?? []).map((row) => this.mapProject(row)),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getClientProjectById(userId: string, projectId: string) {
    const { data: project, error: projectError } = await this.client
      .from('projects')
      .select(
        '*, client_company:client_companies(id,code,name), project_services(id,status,started_at,ended_at,service:services(id,code,name,description,active))',
      )
      .eq('id', projectId)
      .maybeSingle();
    if (projectError) {
      this.databaseFailure(
        'PROJECT_LOOKUP_FAILED',
        'Không thể truy vấn dự án khách hàng.',
        projectError,
      );
    }
    if (!project) {
      throw new NotFoundException({
        code: 'PROJECT_NOT_FOUND',
        message: 'Không tìm thấy dự án.',
      });
    }
    const { data: membership, error: membershipError } = await this.client
      .from('client_memberships')
      .select('id')
      .eq('user_id', userId)
      .eq('client_company_id', project.client_company_id)
      .maybeSingle();
    if (membershipError) {
      this.databaseFailure(
        'PROJECT_ACCESS_LOOKUP_FAILED',
        'Không thể kiểm tra quyền dự án khách hàng.',
        membershipError,
      );
    }
    if (!membership) {
      throw new NotFoundException({
        code: 'PROJECT_NOT_FOUND',
        message: 'Không tìm thấy dự án.',
      });
    }
    return this.mapProject(project);
  }
}
