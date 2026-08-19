import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
  CreateEmploymentDto,
  UpdateEmploymentDto,
  UpdatePersonFullDto,
  AssignUserProjectsDto,
} from './dto/employment.dto';

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

    // RPC returns JSONB: { items: [...], total: N }
    const rpcData = data ?? {};
    const rows = Array.isArray(rpcData.items) ? rpcData.items : [];
    const total = Number.isFinite(Number(rpcData.total))
      ? Number(rpcData.total)
      : 0;

    const items = rows.map((row: any) => ({
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
      .select('*')
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

    const { data: emp, error: empErr } = await client
      .from('employee_profiles')
      .select('*, department:departments(name), team:teams(name)')
      .eq('user_id', userId)
      .maybeSingle();

    if (empErr) {
      this.logger.warn(
        `Failed to fetch employee_profile for ${userId}: ${empErr.message}`,
      );
    }

    let reportsToFullName: string | null = null;
    if (emp?.reports_to_user_id) {
      const { data: mgr } = await client
        .from('profiles')
        .select('full_name')
        .eq('id', emp.reports_to_user_id)
        .maybeSingle();
      reportsToFullName = mgr?.full_name ?? null;
    }

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
            reportsToFullName,
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
        throw new NotFoundException({
          code: 'TEAM_NOT_FOUND',
          message: 'Không tìm thấy đội nhóm được chọn.',
        });
      }

      // departmentId is REQUIRED when assigning a team
      if (!dto.departmentId) {
        throw new BadRequestException({
          code: 'INVALID_TEAM_DEPARTMENT',
          message: 'Phải chọn phòng ban phù hợp khi gán đội nhóm.',
        });
      }

      if (team.department_id !== dto.departmentId) {
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

    const effectiveTeamId =
      dto.teamId !== undefined ? dto.teamId : current.employeeProfile.teamId;
    const effectiveDepartmentId =
      dto.departmentId !== undefined
        ? dto.departmentId
        : current.employeeProfile.departmentId;

    // Validate team/department consistency using effective values
    if (effectiveTeamId) {
      // Cannot have a team without a department
      if (!effectiveDepartmentId) {
        throw new BadRequestException({
          code: 'INVALID_TEAM_DEPARTMENT',
          message:
            'Không thể xóa phòng ban trong khi đội nhóm vẫn còn được gán. Hãy đồng thời xóa cả đội nhóm.',
        });
      }

      const { data: team } = await client
        .from('teams')
        .select('id, department_id')
        .eq('id', effectiveTeamId)
        .maybeSingle();

      if (!team) {
        throw new NotFoundException({
          code: 'TEAM_NOT_FOUND',
          message: 'Không tìm thấy đội nhóm được chọn.',
        });
      }

      if (team.department_id !== effectiveDepartmentId) {
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
          '*, department:departments(code, name, description), team:teams(code, name, description)',
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

      let managerInfo: {
        fullName: string | null;
        email: string | null;
      } | null = null;
      if (emp.reports_to_user_id) {
        const { data: mgr } = await client
          .from('profiles')
          .select('full_name, email')
          .eq('id', emp.reports_to_user_id)
          .maybeSingle();
        if (mgr) {
          managerInfo = {
            fullName: mgr.full_name ?? null,
            email: mgr.email ?? null,
          };
        }
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
        manager: managerInfo,
      };
    }
  }

  // --- ADMIN EXTENDED MANAGEMENT ---

  async updatePersonFull(
    userId: string,
    dto: UpdatePersonFullDto,
    adminUserId: string,
  ) {
    const client = this.supabaseService.getSystemClient();

    const { data: currentProfile, error: profileErr } = await client
      .from('profiles')
      .select('id, role, account_status')
      .eq('id', userId)
      .maybeSingle();

    if (profileErr || !currentProfile) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'Không tìm thấy tài khoản người dùng.',
      });
    }

    const now = new Date().toISOString();
    const profileUpdates: any = {};
    if (dto.fullName !== undefined) profileUpdates.full_name = dto.fullName;
    if (dto.phone !== undefined) profileUpdates.phone = dto.phone;

    // Handle account status & role changes ensuring check_role_status_consistency
    const targetStatus = dto.accountStatus;
    const targetRole = dto.role !== undefined ? dto.role : currentProfile.role;

    if (
      targetStatus === 'suspended' ||
      targetStatus === 'terminated' ||
      targetStatus === 'rejected'
    ) {
      profileUpdates.account_status = 'rejected';
      profileUpdates.role = null;
      profileUpdates.approved_at = null;
      profileUpdates.approved_by = null;
      profileUpdates.rejected_at = now;
      profileUpdates.rejected_by = adminUserId;
      profileUpdates.rejection_reason = 'Khóa tài khoản bởi Quản trị viên';
    } else if (targetStatus === 'pending') {
      profileUpdates.account_status = 'pending';
      profileUpdates.role = null;
      profileUpdates.approved_at = null;
      profileUpdates.approved_by = null;
      profileUpdates.rejected_at = null;
      profileUpdates.rejected_by = null;
      profileUpdates.rejection_reason = null;
    } else if (
      targetStatus === 'active' ||
      (dto.role && currentProfile.account_status !== 'active')
    ) {
      const activeRole = targetRole || 'employee';
      profileUpdates.account_status = 'active';
      profileUpdates.role = activeRole;
      profileUpdates.approved_at = now;
      profileUpdates.approved_by = adminUserId;
      profileUpdates.rejected_at = null;
      profileUpdates.rejected_by = null;
      profileUpdates.rejection_reason = null;
    } else if (dto.role !== undefined) {
      profileUpdates.role = dto.role;
    }

    if (Object.keys(profileUpdates).length > 0) {
      profileUpdates.updated_at = now;
      const { error: profErr } = await client
        .from('profiles')
        .update(profileUpdates)
        .eq('id', userId);

      if (profErr) {
        this.logger.error(`Failed to update profile: ${profErr.message}`);
        throw new InternalServerErrorException({
          code: 'PROFILE_UPDATE_FAILED',
          message: 'Không thể cập nhật thông tin tài khoản.',
        });
      }
    }

    // 2. Manage employee profile if not client and not rejected/terminated
    const effectiveRole =
      profileUpdates.role !== undefined
        ? profileUpdates.role
        : currentProfile.role;
    const isLocked = profileUpdates.account_status === 'rejected';

    if (isLocked) {
      // Set employee status to terminated
      await client
        .from('employee_profiles')
        .update({
          employment_status: 'terminated',
          left_date: now.split('T')[0],
          updated_by: adminUserId,
          updated_at: now,
        })
        .eq('user_id', userId);

      // Clean up Department Head / Team Leader positions
      await client
        .from('departments')
        .update({
          head_user_id: null,
          updated_by: adminUserId,
          updated_at: now,
        })
        .eq('head_user_id', userId);

      await client
        .from('teams')
        .update({
          leader_user_id: null,
          updated_by: adminUserId,
          updated_at: now,
        })
        .eq('leader_user_id', userId);

      await client.from('project_memberships').delete().eq('user_id', userId);
      await client.from('client_memberships').delete().eq('user_id', userId);
    } else if (effectiveRole === 'client') {
      // Remove employee profile if changing to client
      await client.from('employee_profiles').delete().eq('user_id', userId);
      await client
        .from('departments')
        .update({
          head_user_id: null,
          updated_by: adminUserId,
          updated_at: now,
        })
        .eq('head_user_id', userId);
      await client
        .from('teams')
        .update({
          leader_user_id: null,
          updated_by: adminUserId,
          updated_at: now,
        })
        .eq('leader_user_id', userId);
    } else {
      // If role changed from team_leader to something else, remove team leader assignment
      if (effectiveRole !== 'team_leader') {
        await client
          .from('teams')
          .update({
            leader_user_id: null,
            updated_by: adminUserId,
            updated_at: now,
          })
          .eq('leader_user_id', userId);
      }

      // Upsert employee profile if relevant fields provided
      if (
        dto.employeeCode !== undefined ||
        dto.departmentId !== undefined ||
        dto.teamId !== undefined ||
        dto.jobTitle !== undefined ||
        dto.employmentStatus !== undefined ||
        dto.joinedDate !== undefined
      ) {
        const empPayload: any = {
          user_id: userId,
          updated_by: adminUserId,
          updated_at: now,
        };

        if (dto.employeeCode)
          empPayload.employee_code = dto.employeeCode.toUpperCase();
        if (dto.departmentId !== undefined)
          empPayload.department_id = dto.departmentId || null;
        if (dto.teamId !== undefined) empPayload.team_id = dto.teamId || null;
        if (dto.jobTitle !== undefined)
          empPayload.job_title = dto.jobTitle || null;
        if (dto.employmentStatus)
          empPayload.employment_status = dto.employmentStatus;
        if (dto.joinedDate !== undefined)
          empPayload.joined_date = dto.joinedDate || null;

        // Ensure employee_code exists if record is new
        const { data: existingEmp } = await client
          .from('employee_profiles')
          .select('user_id, employee_code')
          .eq('user_id', userId)
          .maybeSingle();

        if (!existingEmp && !empPayload.employee_code) {
          empPayload.employee_code = `EMP-${userId.slice(0, 6).toUpperCase()}`;
        }
        if (!existingEmp) {
          empPayload.created_by = adminUserId;
        }

        const { error: empErr } = await client
          .from('employee_profiles')
          .upsert(empPayload, { onConflict: 'user_id' });

        if (empErr) {
          this.logger.error(
            `Failed to upsert employee profile: ${empErr.message}`,
          );
        }
      }
    }

    return this.getPersonByUserId(userId);
  }

  async deletePerson(userId: string, adminUserId: string) {
    const client = this.supabaseService.getSystemClient();

    // Check if target exists
    const { data: target, error: targetErr } = await client
      .from('profiles')
      .select('id, role, account_status')
      .eq('id', userId)
      .maybeSingle();

    if (targetErr || !target) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'Không tìm thấy tài khoản người dùng.',
      });
    }

    if (target.id === adminUserId) {
      throw new BadRequestException({
        code: 'CANNOT_TERMINATE_SELF',
        message: 'Không thể tự xóa tài khoản của chính mình.',
      });
    }

    const now = new Date().toISOString();

    // 1. Clear leadership / management / reviewer / assignee positions
    await Promise.allSettled([
      client
        .from('departments')
        .update({
          head_user_id: null,
          updated_by: adminUserId,
          updated_at: now,
        })
        .eq('head_user_id', userId),
      client
        .from('teams')
        .update({
          leader_user_id: null,
          updated_by: adminUserId,
          updated_at: now,
        })
        .eq('leader_user_id', userId),
      client
        .from('employee_profiles')
        .update({
          reports_to_user_id: null,
          updated_by: adminUserId,
          updated_at: now,
        })
        .eq('reports_to_user_id', userId),
      client
        .from('tasks')
        .update({
          assignee_user_id: null,
          updated_by: adminUserId,
          updated_at: now,
        })
        .eq('assignee_user_id', userId),
      client
        .from('tasks')
        .update({
          reporter_user_id: null,
          updated_by: adminUserId,
          updated_at: now,
        })
        .eq('reporter_user_id', userId),
      client
        .from('projects')
        .update({
          project_manager_user_id: null,
          updated_by: adminUserId,
          updated_at: now,
        })
        .eq('project_manager_user_id', userId),
      client
        .from('leave_requests')
        .update({ reviewer_user_id: null, updated_at: now })
        .eq('reviewer_user_id', userId),
      client
        .from('leave_requests')
        .update({ approved_by: null, updated_at: now })
        .eq('approved_by', userId),
      client
        .from('leave_requests')
        .update({ cancelled_by: null, updated_at: now })
        .eq('cancelled_by', userId),
      client
        .from('support_tickets')
        .update({
          assignee_user_id: null,
          updated_by_user_id: adminUserId,
          updated_at: now,
        })
        .eq('assignee_user_id', userId),
      client
        .from('calendar_events')
        .update({
          assignee_user_id: null,
          updated_by_user_id: adminUserId,
          updated_at: now,
        })
        .eq('assignee_user_id', userId),
      client
        .from('invoices')
        .update({ approved_by_user_id: null, updated_at: now })
        .eq('approved_by_user_id', userId),
      client
        .from('contracts')
        .update({ approved_by_user_id: null, updated_at: now })
        .eq('approved_by_user_id', userId),
      client
        .from('profiles')
        .update({ approved_by: null, updated_at: now })
        .eq('approved_by', userId),
      client
        .from('profiles')
        .update({ rejected_by: null, updated_at: now })
        .eq('rejected_by', userId),
    ]);

    // 2. Remove all related dependent records that belong to this user
    await Promise.allSettled([
      client
        .from('account_approval_events')
        .delete()
        .eq('target_user_id', userId),
      client.from('account_approval_events').delete().eq('actor_id', userId),
      client.from('project_memberships').delete().eq('user_id', userId),
      client.from('client_memberships').delete().eq('user_id', userId),
      client.from('employee_profiles').delete().eq('user_id', userId),
      client.from('notification_preferences').delete().eq('user_id', userId),
      client.from('notifications').delete().eq('recipient_user_id', userId),
      client.from('notifications').delete().eq('created_by', userId),
      client.from('payroll_records').delete().eq('user_id', userId),
      client.from('attendance_records').delete().eq('user_id', userId),
      client.from('leave_requests').delete().eq('user_id', userId),
      client.from('expenses').delete().eq('submitted_by_user_id', userId),
      client.from('reimbursements').delete().eq('submitted_by_user_id', userId),
      client.from('support_tickets').delete().eq('sender_user_id', userId),
      client.from('calendar_events').delete().eq('creator_user_id', userId),
      client
        .from('company_documents')
        .delete()
        .eq('uploaded_by_user_id', userId),
      client
        .from('task_attachments')
        .delete()
        .eq('uploaded_by_user_id', userId),
      client.from('task_comments').delete().eq('user_id', userId),
      client.from('task_activity_logs').delete().eq('actor_id', userId),
      client.from('chat_messages').delete().eq('sender_user_id', userId),
      client.from('chat_participants').delete().eq('user_id', userId),
      client.from('chat_reads').delete().eq('user_id', userId),
      client
        .from('direct_conversations')
        .delete()
        .eq('direct_user_low', userId),
      client
        .from('direct_conversations')
        .delete()
        .eq('direct_user_high', userId),
    ]);

    // 3. Delete from Supabase Auth (which cascades to public.profiles)
    let authDeleted = false;
    try {
      if (client.auth?.admin?.deleteUser) {
        const { error: authErr } = await client.auth.admin.deleteUser(userId);
        if (!authErr) {
          authDeleted = true;
        } else {
          this.logger.warn(
            `Auth deleteUser returned error: ${authErr.message}`,
          );
        }
      }
    } catch (authErr: any) {
      this.logger.warn(
        `Supabase auth deleteUser exception: ${authErr?.message || authErr}`,
      );
    }

    // 4. If profile still exists in public.profiles, explicitly delete it
    const { error: deleteProfErr } = await client
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (deleteProfErr && !authDeleted) {
      this.logger.error(
        `Failed to delete user profile from database: ${deleteProfErr.message}`,
      );
      throw new InternalServerErrorException({
        code: 'USER_DELETION_FAILED',
        message: 'Không thể xóa tài khoản người dùng khỏi cơ sở dữ liệu.',
      });
    }

    return {
      success: true,
      message:
        'Đã xóa vĩnh viễn tài khoản người dùng khỏi hệ thống và cơ sở dữ liệu thành công.',
    };
  }

  async getUserProjects(userId: string) {
    const client = this.supabaseService.getSystemClient();

    const { data, error } = await client
      .from('project_memberships')
      .select(
        `
        id,
        project_id,
        project_role,
        joined_at,
        project:projects (
          id,
          project_code,
          name,
          status,
          priority,
          start_date,
          due_date
        )
      `,
      )
      .eq('user_id', userId);

    if (error) {
      this.logger.error(`Failed to get user projects: ${error.message}`);
      return [];
    }

    return (data || []).map((m: any) => ({
      membershipId: m.id,
      projectId: m.project_id,
      projectRole: m.project_role,
      joinedAt: m.joined_at,
      project: m.project,
    }));
  }

  async assignUserProjects(
    userId: string,
    dto: AssignUserProjectsDto,
    adminUserId: string,
  ) {
    const client = this.supabaseService.getSystemClient();

    // Verify user exists and is active
    const { data: profile } = await client
      .from('profiles')
      .select('id, role, account_status')
      .eq('id', userId)
      .maybeSingle();

    if (!profile) {
      throw new NotFoundException({
        code: 'PROFILE_NOT_FOUND',
        message: 'Không tìm thấy thông tin tài khoản người dùng.',
      });
    }

    // Delete existing project memberships for this user
    await client.from('project_memberships').delete().eq('user_id', userId);

    // Insert new memberships
    if (dto.projectIds.length > 0) {
      const inserts = dto.projectIds.map((projId) => ({
        project_id: projId,
        user_id: userId,
        project_role: dto.projectRole || 'member',
        created_by: adminUserId,
      }));

      const { error: insErr } = await client
        .from('project_memberships')
        .insert(inserts);

      if (insErr) {
        this.logger.error(`Failed to assign user projects: ${insErr.message}`);
        throw new InternalServerErrorException({
          code: 'PROJECT_ASSIGNMENT_FAILED',
          message: 'Không thể phân bổ dự án cho nhân sự.',
        });
      }
    }

    return this.getUserProjects(userId);
  }
}
