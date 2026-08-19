import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateDepartmentDto, UpdateDepartmentDto } from './dto/department.dto';
import { CreateTeamDto, UpdateTeamDto } from './dto/team.dto';

@Injectable()
export class OrganizationService {
  private readonly logger = new Logger(OrganizationService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  // --- DEPARTMENTS ---

  private async validateDepartmentHead(headUserId: string) {
    const client = this.supabaseService.getSystemClient();
    const { data: profile, error } = await client
      .from('profiles')
      .select('id, role, account_status')
      .eq('id', headUserId)
      .maybeSingle();

    if (error || !profile) {
      throw new BadRequestException({
        code: 'INVALID_DEPARTMENT_HEAD_NOT_FOUND',
        message: 'Tài khoản được chỉ định làm Trưởng phòng không tồn tại.',
      });
    }

    if (profile.role === 'client') {
      throw new BadRequestException({
        code: 'CLIENT_CANNOT_BE_DEPARTMENT_HEAD',
        message: 'Khách hàng không thể được bổ nhiệm làm Trưởng phòng.',
      });
    }

    if (profile.account_status !== 'active') {
      throw new BadRequestException({
        code: 'INACTIVE_USER_CANNOT_BE_DEPARTMENT_HEAD',
        message:
          'Chỉ tài khoản nội bộ đang hoạt động mới có thể làm Trưởng phòng.',
      });
    }
  }

  async getDepartments() {
    const client = this.supabaseService.getSystemClient();
    const { data, error } = await client
      .from('departments')
      .select(
        '*, head:profiles!departments_head_user_id_fkey(id,full_name,email,avatar_url,role,account_status,employee_profile:employee_profiles(employee_code))',
      )
      .order('sort_order', { ascending: true })
      .order('department_code', { ascending: true });

    if (error) {
      this.logger.error(`Failed to get departments: ${error.message}`);
      throw new InternalServerErrorException({
        code: 'DEPARTMENTS_LOOKUP_FAILED',
        message: 'Không thể truy vấn danh sách phòng ban.',
      });
    }

    return (data || []).map((dep: any) => ({
      id: dep.id,
      departmentCode: dep.department_code,
      code: dep.code,
      name: dep.name,
      description: dep.description,
      sortOrder: dep.sort_order,
      isActive: dep.is_active,
      headUserId: dep.head_user_id,
      headUserCode: dep.head_user_code,
      head: dep.head
        ? {
            id: dep.head.id,
            fullName: dep.head.full_name,
            email: dep.head.email,
            avatarUrl: dep.head.avatar_url,
            employeeCode:
              dep.head.employee_profile?.[0]?.employee_code ??
              dep.head_user_code,
          }
        : null,
      createdAt: dep.created_at,
      updatedAt: dep.updated_at,
    }));
  }

  async getDepartmentById(id: string) {
    const client = this.supabaseService.getSystemClient();
    const { data, error } = await client
      .from('departments')
      .select(
        '*, head:profiles!departments_head_user_id_fkey(id,full_name,email,avatar_url,role,account_status,employee_profile:employee_profiles(employee_code))',
      )
      .eq('id', id)
      .maybeSingle();

    if (error) {
      this.logger.error(`Failed to get department ${id}: ${error.message}`);
      throw new InternalServerErrorException({
        code: 'DEPARTMENT_LOOKUP_FAILED',
        message: 'Không thể kiểm tra thông tin phòng ban lúc này.',
      });
    }

    if (!data) {
      throw new NotFoundException({
        code: 'DEPARTMENT_NOT_FOUND',
        message: 'Không tìm thấy phòng ban được yêu cầu.',
      });
    }

    return {
      id: data.id,
      departmentCode: data.department_code,
      code: data.code,
      name: data.name,
      description: data.description,
      sortOrder: data.sort_order,
      isActive: data.is_active,
      headUserId: data.head_user_id,
      headUserCode: data.head_user_code,
      head: data.head
        ? {
            id: data.head.id,
            fullName: data.head.full_name,
            email: data.head.email,
            avatarUrl: data.head.avatar_url,
            employeeCode:
              data.head.employee_profile?.[0]?.employee_code ??
              data.head_user_code,
          }
        : null,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async createDepartment(dto: CreateDepartmentDto, adminUserId: string) {
    const client = this.supabaseService.getSystemClient();

    // Check unique code
    const { data: existing } = await client
      .from('departments')
      .select('id')
      .eq('code', dto.code.trim().toUpperCase())
      .maybeSingle();

    if (existing) {
      throw new ConflictException({
        code: 'DEPARTMENT_CODE_ALREADY_EXISTS',
        message: 'Mã phòng ban này đã tồn tại trong hệ thống.',
      });
    }

    if (dto.headUserId) {
      await this.validateDepartmentHead(dto.headUserId);
    }

    const { data, error } = await client
      .from('departments')
      .insert({
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        sort_order: dto.sortOrder ?? 0,
        head_user_id: dto.headUserId ?? null,
        created_by: adminUserId,
        updated_by: adminUserId,
      })
      .select()
      .single();

    if (error) {
      this.logger.error(`Failed to create department: ${error.message}`);
      throw new InternalServerErrorException({
        code: 'DEPARTMENT_CREATE_FAILED',
        message: 'Không thể tạo phòng ban lúc này.',
      });
    }

    return this.getDepartmentById(data.id);
  }

  async updateDepartment(
    id: string,
    dto: UpdateDepartmentDto,
    adminUserId: string,
  ) {
    // Check if exists
    await this.getDepartmentById(id);

    if (dto.headUserId !== undefined && dto.headUserId !== null) {
      await this.validateDepartmentHead(dto.headUserId);
    }

    const client = this.supabaseService.getSystemClient();
    const updatePayload: any = {
      updated_by: adminUserId,
    };

    if (dto.name !== undefined) updatePayload.name = dto.name.trim();
    if (dto.description !== undefined)
      updatePayload.description = dto.description?.trim() || null;
    if (dto.sortOrder !== undefined) updatePayload.sort_order = dto.sortOrder;
    if (dto.headUserId !== undefined)
      updatePayload.head_user_id = dto.headUserId;
    if (dto.isActive !== undefined) updatePayload.is_active = dto.isActive;

    const { data, error } = await client
      .from('departments')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      this.logger.error(`Failed to update department ${id}: ${error.message}`);
      throw new InternalServerErrorException({
        code: 'DEPARTMENT_UPDATE_FAILED',
        message: 'Không thể cập nhật phòng ban lúc này.',
      });
    }

    return this.getDepartmentById(data.id);
  }

  // --- TEAMS ---

  async getTeams(departmentId?: string, isActive?: boolean, query?: string) {
    const client = this.supabaseService.getSystemClient();
    let dbQuery = client
      .from('teams')
      .select('*, department:departments(name)');

    if (departmentId) {
      dbQuery = dbQuery.eq('department_id', departmentId);
    }
    if (isActive !== undefined) {
      dbQuery = dbQuery.eq('is_active', isActive);
    }
    if (query) {
      dbQuery = dbQuery.or(`name.ilike.%${query}%,code.ilike.%${query}%`);
    }

    const { data, error } = await dbQuery.order('code', { ascending: true });

    if (error) {
      this.logger.error(`Failed to get teams: ${error.message}`);
      throw new InternalServerErrorException({
        code: 'TEAMS_LOOKUP_FAILED',
        message: 'Không thể truy vấn danh sách đội nhóm.',
      });
    }

    return data || [];
  }

  async getTeamById(id: string) {
    const client = this.supabaseService.getSystemClient();
    const { data, error } = await client
      .from('teams')
      .select('*, department:departments(name)')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      this.logger.error(`Failed to get team ${id}: ${error.message}`);
      throw new InternalServerErrorException({
        code: 'TEAM_LOOKUP_FAILED',
        message: 'Không thể kiểm tra thông tin đội nhóm lúc này.',
      });
    }

    if (!data) {
      throw new NotFoundException({
        code: 'TEAM_NOT_FOUND',
        message: 'Không tìm thấy đội nhóm được yêu cầu.',
      });
    }

    return data;
  }

  async createTeam(dto: CreateTeamDto, adminUserId: string) {
    const client = this.supabaseService.getSystemClient();

    // Verify department exists
    await this.getDepartmentById(dto.departmentId);

    // Verify team code uniqueness within department
    const { data: existing } = await client
      .from('teams')
      .select('id')
      .eq('department_id', dto.departmentId)
      .eq('code', dto.code.trim().toUpperCase())
      .maybeSingle();

    if (existing) {
      throw new ConflictException({
        code: 'TEAM_CODE_ALREADY_EXISTS_IN_DEPARTMENT',
        message: 'Mã đội nhóm này đã tồn tại trong phòng ban.',
      });
    }

    // Verify leaderUserId
    if (dto.leaderUserId) {
      const { data: leaderProfile } = await client
        .from('profiles')
        .select('role, account_status')
        .eq('id', dto.leaderUserId)
        .maybeSingle();

      if (
        !leaderProfile ||
        leaderProfile.role !== 'team_leader' ||
        leaderProfile.account_status !== 'active'
      ) {
        throw new BadRequestException({
          code: 'INVALID_TEAM_LEADER',
          message:
            'Trưởng nhóm phải là tài khoản hoạt động có vai trò Trưởng nhóm (team_leader).',
        });
      }
    }

    const { data, error } = await client
      .from('teams')
      .insert({
        department_id: dto.departmentId,
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        leader_user_id: dto.leaderUserId || null,
        description: dto.description?.trim() || null,
        created_by: adminUserId,
        updated_by: adminUserId,
      })
      .select()
      .single();

    if (error) {
      this.logger.error(`Failed to create team: ${error.message}`);
      throw new InternalServerErrorException({
        code: 'TEAM_CREATE_FAILED',
        message: 'Không thể tạo đội nhóm lúc này.',
      });
    }

    return data;
  }

  async updateTeam(id: string, dto: UpdateTeamDto, adminUserId: string) {
    // Verify team exists
    await this.getTeamById(id);

    const client = this.supabaseService.getSystemClient();

    // Verify leaderUserId if updated
    if (dto.leaderUserId) {
      const { data: leaderProfile } = await client
        .from('profiles')
        .select('role, account_status')
        .eq('id', dto.leaderUserId)
        .maybeSingle();

      if (
        !leaderProfile ||
        leaderProfile.role !== 'team_leader' ||
        leaderProfile.account_status !== 'active'
      ) {
        throw new BadRequestException({
          code: 'INVALID_TEAM_LEADER',
          message:
            'Trưởng nhóm phải là tài khoản hoạt động có vai trò Trưởng nhóm (team_leader).',
        });
      }
    }

    const updatePayload: any = {
      updated_by: adminUserId,
    };

    if (dto.name !== undefined) updatePayload.name = dto.name.trim();
    if (dto.leaderUserId !== undefined)
      updatePayload.leader_user_id = dto.leaderUserId;
    if (dto.description !== undefined)
      updatePayload.description = dto.description?.trim() || null;
    if (dto.isActive !== undefined) updatePayload.is_active = dto.isActive;

    const { data, error } = await client
      .from('teams')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      this.logger.error(`Failed to update team ${id}: ${error.message}`);
      throw new InternalServerErrorException({
        code: 'TEAM_UPDATE_FAILED',
        message: 'Không thể cập nhật đội nhóm lúc này.',
      });
    }

    return data;
  }
}
