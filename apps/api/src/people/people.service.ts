import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateEmploymentDto, UpdateEmploymentDto } from './dto/employment.dto';

@Injectable()
export class PeopleService {
  private readonly logger = new Logger(PeopleService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  // --- ADMIN: PEOPLE DIRECTORY & PROFILES ---

  async getPeopleDirectory(filters: {
    query?: string;
    role?: string;
    departmentId?: string;
    teamId?: string;
    employmentStatus?: string;
    page?: number;
    pageSize?: number;
  }) {
    const pageNum = Math.max(1, filters.page || 1);
    const sizeNum = Math.min(100, Math.max(1, filters.pageSize || 20));
    const offset = (pageNum - 1) * sizeNum;

    const client = this.supabaseService.getSystemClient();

    const { data, error } = await client.rpc('search_people_directory', {
      p_query: filters.query?.trim() || null,
      p_role: filters.role || null,
      p_department_id: filters.departmentId || null,
      p_team_id: filters.teamId || null,
      p_employment_status: filters.employmentStatus || null,
      p_offset: offset,
      p_limit: sizeNum,
    });

    if (error) {
      this.logger.error(
        `Failed to get profiles directory via RPC: ${error.message}`,
      );
      throw new InternalServerErrorException({
        code: 'PEOPLE_LOOKUP_FAILED',
        message: 'Không thể truy vấn danh bạ nhân sự.',
      });
    }

    const total =
      data && data.length > 0 ? parseInt(data[0].total_count, 10) : 0;
    const items = (data || []).map((row: any) => ({
      id: row.id,
      email: row.email || null,
      phone: row.phone || null,
      fullName: row.full_name || null,
      avatarUrl: row.avatar_url || null,
      role: row.role,
      accountStatus: row.account_status,
      employeeProfile: row.employee_code
        ? {
            employeeCode: row.employee_code,
            departmentId: row.department_id || null,
            departmentName: row.department_name || null,
            teamId: row.team_id || null,
            teamName: row.team_name || null,
            jobTitle: row.job_title || null,
            reportsToUserId: row.reports_to_user_id || null,
            employmentStatus: row.employment_status,
            joinedDate: row.joined_date || null,
            leftDate: row.left_date || null,
          }
        : null,
    }));

    const totalPages = Math.ceil(total / sizeNum);

    return {
      items,
      page: pageNum,
      pageSize: sizeNum,
      total,
      totalPages,
    };
  }

  async getPersonByUserId(userId: string) {
    const client = this.supabaseService.getSystemClient();
    const { data: profile, error } = await client
      .from('profiles')
      .select(
        '*, employee_profile:employee_profiles(*, department:departments(name), team:teams(name), manager:profiles!employee_profiles_reports_to_user_id_fkey(full_name))',
      )
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      this.logger.error(`Failed to get profile ${userId}: ${error.message}`);
      throw new InternalServerErrorException({
        code: 'PERSON_LOOKUP_FAILED',
        message: 'Không thể kiểm tra thông tin hồ sơ nhân sự.',
      });
    }

    if (!profile) {
      throw new NotFoundException({
        code: 'PERSON_NOT_FOUND',
        message: 'Không tìm thấy tài khoản người dùng.',
      });
    }

    const emp = profile.employee_profile;
    return {
      id: profile.id,
      email: profile.email ?? null,
      phone: profile.phone ?? null,
      fullName: profile.full_name ?? null,
      avatarUrl: profile.avatar_url ?? null,
      role: profile.role,
      accountStatus: profile.account_status,
      employeeProfile: emp
        ? {
            employeeCode: emp.employee_code,
            departmentId: emp.department_id,
            departmentName: emp.department?.name ?? null,
            teamId: emp.team_id,
            teamName: emp.team?.name ?? null,
            jobTitle: emp.job_title ?? null,
            reportsToUserId: emp.reports_to_user_id ?? null,
            reportsToFullName: emp.manager?.full_name ?? null,
            employmentStatus: emp.employment_status,
            joinedDate: emp.joined_date ?? null,
            leftDate: emp.left_date ?? null,
          }
        : null,
    };
  }

  async createEmploymentProfile(
    userId: string,
    dto: CreateEmploymentDto,
    adminUserId: string,
  ) {
    const client = this.supabaseService.getSystemClient();

    // Verify profile exists
    const { data: profile } = await client
      .from('profiles')
      .select('role, account_status')
      .eq('id', userId)
      .maybeSingle();

    if (!profile) {
      throw new NotFoundException({
        code: 'PROFILE_NOT_FOUND',
        message: 'Không tìm thấy tài khoản để tạo hồ sơ nhân sự.',
      });
    }

    // Role check: Client role is denied employee_profiles row
    if (profile.role === 'client') {
      throw new BadRequestException({
        code: 'CLIENT_EMPLOYEE_PROFILE_DENIED',
        message:
          'Không được phép tạo hồ sơ nhân sự cho tài khoản vai trò Khách hàng (client).',
      });
    }

    // Check account status active
    if (profile.account_status !== 'active') {
      throw new BadRequestException({
        code: 'ACCOUNT_NOT_ACTIVE',
        message:
          'Chỉ được tạo hồ sơ nhân sự cho tài khoản đã được phê duyệt hoạt động.',
      });
    }

    // Check if already exists
    const { data: existing } = await client
      .from('employee_profiles')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      throw new ConflictException({
        code: 'EMPLOYEE_PROFILE_ALREADY_EXISTS',
        message: 'Tài khoản này đã có hồ sơ nhân sự.',
      });
    }

    // Check unique employee code
    const { data: codeDup } = await client
      .from('employee_profiles')
      .select('user_id')
      .eq('employee_code', dto.employeeCode.trim().toUpperCase())
      .maybeSingle();

    if (codeDup) {
      throw new ConflictException({
        code: 'EMPLOYEE_CODE_ALREADY_EXISTS',
        message: 'Mã nhân sự này đã được sử dụng.',
      });
    }

    // Check reports_to_user_id cannot equal user_id
    if (dto.reportsToUserId === userId) {
      throw new BadRequestException({
        code: 'EMPLOYEE_REPORTS_TO_SELF_DENIED',
        message: 'Nhân sự không thể báo cáo công việc cho chính mình.',
      });
    }

    // Validate team/department consistency
    if (dto.teamId) {
      const { data: team } = await client
        .from('teams')
        .select('id, department_id')
        .eq('id', dto.teamId)
        .maybeSingle();

      if (!team) {
        throw new BadRequestException({
          code: 'TEAM_NOT_FOUND',
          message: 'Đội nhóm được chỉ định không tồn tại.',
        });
      }

      // If departmentId supplied, it must match the team's department
      if (dto.departmentId && team.department_id !== dto.departmentId) {
        throw new BadRequestException({
          code: 'INVALID_TEAM_DEPARTMENT',
          message: 'Đội nhóm được chọn không thuộc phòng ban đã chỉ định.',
        });
      }
    }

    const { data, error } = await client
      .from('employee_profiles')
      .insert({
        user_id: userId,
        employee_code: dto.employeeCode.trim().toUpperCase(),
        department_id: dto.departmentId || null,
        team_id: dto.teamId || null,
        job_title: dto.jobTitle?.trim() || null,
        reports_to_user_id: dto.reportsToUserId || null,
        employment_status: dto.employmentStatus,
        joined_date: dto.joinedDate || null,
        created_by: adminUserId,
        updated_by: adminUserId,
      })
      .select()
      .single();

    if (error) {
      this.logger.error(`Failed to create employee profile: ${error.message}`);
      throw new InternalServerErrorException({
        code: 'EMPLOYEE_PROFILE_CREATE_FAILED',
        message: 'Không thể khởi tạo hồ sơ nhân sự.',
      });
    }

    return data;
  }

  async updateEmploymentProfile(
    userId: string,
    dto: UpdateEmploymentDto,
    adminUserId: string,
  ) {
    const client = this.supabaseService.getSystemClient();

    // Verify exists
    const current = await this.getPersonByUserId(userId);
    if (!current.employeeProfile) {
      throw new NotFoundException({
        code: 'EMPLOYEE_PROFILE_NOT_FOUND',
        message: 'Hồ sơ nhân sự của tài khoản này chưa được khởi tạo.',
      });
    }

    // Check reports_to_user_id cannot equal user_id
    if (dto.reportsToUserId === userId) {
      throw new BadRequestException({
        code: 'EMPLOYEE_REPORTS_TO_SELF_DENIED',
        message: 'Nhân sự không thể báo cáo công việc cho chính mình.',
      });
    }

    const teamId =
      dto.teamId !== undefined ? dto.teamId : current.employeeProfile.teamId;

    // Validate team/department consistency using effective values
    if (teamId) {
      const { data: team } = await client
        .from('teams')
        .select('id, department_id')
        .eq('id', teamId)
        .maybeSingle();

      if (!team) {
        throw new BadRequestException({
          code: 'TEAM_NOT_FOUND',
          message: 'Đội nhóm được chỉ định không tồn tại.',
        });
      }

      // Effective deptId after update — if caller provides departmentId use it, else use current
      const effectiveDeptId =
        dto.departmentId !== undefined
          ? dto.departmentId
          : current.employeeProfile.departmentId;

      if (effectiveDeptId && team.department_id !== effectiveDeptId) {
        throw new BadRequestException({
          code: 'INVALID_TEAM_DEPARTMENT',
          message: 'Đội nhóm được chọn không thuộc phòng ban đã chỉ định.',
        });
      }
    }

    const updatePayload: any = {
      updated_by: adminUserId,
    };

    if (dto.departmentId !== undefined)
      updatePayload.department_id = dto.departmentId;
    if (dto.teamId !== undefined) updatePayload.team_id = dto.teamId;
    if (dto.jobTitle !== undefined)
      updatePayload.job_title = dto.jobTitle?.trim() || null;
    if (dto.reportsToUserId !== undefined)
      updatePayload.reports_to_user_id = dto.reportsToUserId;
    if (dto.employmentStatus !== undefined)
      updatePayload.employment_status = dto.employmentStatus;
    if (dto.joinedDate !== undefined)
      updatePayload.joined_date = dto.joinedDate;
    if (dto.leftDate !== undefined) updatePayload.left_date = dto.leftDate;

    // Auto fill leftDate if status terminates
    if (dto.employmentStatus === 'terminated' && !updatePayload.left_date) {
      updatePayload.left_date = new Date().toISOString().split('T')[0];
    }

    const { data, error } = await client
      .from('employee_profiles')
      .update(updatePayload)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      this.logger.error(`Failed to update employee profile: ${error.message}`);
      throw new InternalServerErrorException({
        code: 'EMPLOYEE_PROFILE_UPDATE_FAILED',
        message: 'Không thể cập nhật hồ sơ nhân sự.',
      });
    }

    return data;
  }

  // --- TEAM LEADER: TEAM MEMBERS SCOPE ---

  async getTeamMembersForLeader(leaderUserId: string) {
    const client = this.supabaseService.getSystemClient();

    // Fetch teams led by this leader
    const { data: teams, error: teamsError } = await client
      .from('teams')
      .select('id')
      .eq('leader_user_id', leaderUserId)
      .eq('is_active', true);

    if (teamsError) {
      this.logger.error(
        `Failed to lookup teams for leader: ${teamsError.message}`,
      );
      throw new InternalServerErrorException({
        code: 'TEAMS_LOOKUP_FAILED',
        message: 'Không thể kiểm tra phạm vi quản lý đội nhóm.',
      });
    }

    const teamIds = (teams || []).map((t) => t.id);
    if (teamIds.length === 0) {
      return [];
    }

    // Query profiles in those teams
    const { data: members, error: membersError } = await client
      .from('employee_profiles')
      .select(
        'user_id, employee_code, job_title, employment_status, joined_date, profile:profiles(email, full_name, avatar_url, role)',
      )
      .in('team_id', teamIds);

    if (membersError) {
      this.logger.error(
        `Failed to lookup team members: ${membersError.message}`,
      );
      throw new InternalServerErrorException({
        code: 'TEAM_MEMBERS_LOOKUP_FAILED',
        message: 'Không thể truy vấn danh sách thành viên đội nhóm.',
      });
    }

    return (members || []).map((m) => {
      const p = m.profile as any;
      return {
        id: m.user_id,
        email: p?.email ?? null,
        fullName: p?.full_name ?? null,
        avatarUrl: p?.avatar_url ?? null,
        role: p?.role ?? null,
        employeeCode: m.employee_code,
        jobTitle: m.job_title ?? null,
        employmentStatus: m.employment_status,
        joinedDate: m.joined_date ?? null,
      };
    });
  }

  // --- ME OWN ORGANIZATION SCOPE ---

  async getOwnOrganizationContext(userId: string, role: string) {
    const client = this.supabaseService.getSystemClient();

    if (role === 'client') {
      // Client looks up client_memberships
      const { data: memberships, error } = await client
        .from('client_memberships')
        .select('*, client_company:client_companies(*)')
        .eq('user_id', userId);

      if (error) {
        this.logger.error(`Failed to get client memberships: ${error.message}`);
        throw new InternalServerErrorException({
          code: 'CLIENT_MEMBERSHIPS_LOOKUP_FAILED',
          message: 'Không thể truy cập thông tin liên kết khách hàng.',
        });
      }

      const companies = (memberships || []).map((m) => ({
        id: m.client_company.id,
        code: m.client_company.code,
        name: m.client_company.name,
        taxCode: m.client_company.tax_code ?? null,
        email: m.client_company.email ?? null,
        phone: m.client_company.phone ?? null,
        website: m.client_company.website ?? null,
        address: m.client_company.address ?? null,
        status: m.client_company.status,
        title: m.title ?? null,
        isPrimary: m.is_primary,
      }));

      return {
        type: 'client',
        companies,
      };
    } else {
      // Internal roles: employee context
      const { data: emp, error } = await client
        .from('employee_profiles')
        .select(
          '*, department:departments(code, name, description), team:teams(code, name, description), manager:profiles!employee_profiles_reports_to_user_id_fkey(full_name, email)',
        )
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        this.logger.error(`Failed to get employee context: ${error.message}`);
        throw new InternalServerErrorException({
          code: 'EMPLOYEE_CONTEXT_LOOKUP_FAILED',
          message: 'Không thể truy cập thông tin vị trí phòng ban nhân sự.',
        });
      }

      if (!emp) {
        return {
          type: 'internal',
          employee: null,
          department: null,
          team: null,
          manager: null,
        };
      }

      return {
        type: 'internal',
        employee: {
          employeeCode: emp.employee_code,
          jobTitle: emp.job_title ?? null,
          employmentStatus: emp.employment_status,
          joinedDate: emp.joined_date ?? null,
        },
        department: emp.department
          ? {
              code: emp.department.code,
              name: emp.department.name,
            }
          : null,
        team: emp.team
          ? {
              code: emp.team.code,
              name: emp.team.name,
            }
          : null,
        manager: emp.manager
          ? {
              fullName: emp.manager.full_name ?? null,
              email: emp.manager.email ?? null,
            }
          : null,
      };
    }
  }
}
