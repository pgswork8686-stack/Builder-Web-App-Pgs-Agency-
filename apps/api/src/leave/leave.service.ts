import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { RequestUser } from '../auth/auth.types';
import {
  LeaveRequestCreateDto,
  LeaveReviewDto,
  LeaveBalanceAdjustmentDto,
  LeaveQuery,
} from './dto/leave.dto';

@Injectable()
export class LeaveService {
  constructor(private readonly supabaseService: SupabaseService) {}

  private get client() {
    return this.supabaseService.getSystemClient();
  }

  private enforceInternalUser(user: RequestUser) {
    if (user.role === 'client') {
      throw new ForbiddenException({
        code: 'LEAVE_ACCESS_DENIED',
        message: 'Khách hàng không có quyền truy cập chức năng nghỉ phép.',
      });
    }
  }

  // Blocker 11: Leave Day Calculation Abstraction
  // Counts only Mon-Fri as standard weekdays (Vietnam standard workday count)
  private calculateTotalDays(startStr: string, endStr: string): number {
    const start = new Date(startStr);
    const end = new Date(endStr);

    let daysCount = 0;
    const current = new Date(start);

    while (current <= end) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        // Exclude Sunday (0) and Saturday (6)
        daysCount++;
      }
      current.setDate(current.getDate() + 1);
    }

    return daysCount;
  }

  // Get active leave types list
  async getLeaveTypes(user: RequestUser) {
    this.enforceInternalUser(user);
    const { data, error } = await this.client
      .from('leave_types')
      .select('*')
      .eq('active', true);

    if (error) {
      throw new InternalServerErrorException({
        code: 'LEAVE_WRITE_FAILED',
        message: 'Không thể tải danh sách loại nghỉ phép.',
      });
    }
    return data;
  }

  // Create a leave request using atomic RPC transaction (Blocker 3)
  async createRequest(dto: LeaveRequestCreateDto, user: RequestUser) {
    this.enforceInternalUser(user);

    if (dto.endDate < dto.startDate) {
      throw new BadRequestException({
        code: 'LEAVE_DATE_RANGE_INVALID',
        message: 'Ngày kết thúc không được trước ngày bắt đầu.',
      });
    }

    const startYear = new Date(dto.startDate).getFullYear();
    const endYear = new Date(dto.endDate).getFullYear();

    // Blocker 11: Multi-year requests rejected with a stable validation error
    if (startYear !== endYear) {
      throw new BadRequestException({
        code: 'LEAVE_YEAR_SPAN_NOT_SUPPORTED',
        message:
          'Đơn xin nghỉ phép kéo dài qua nhiều năm không được hỗ trợ. Vui lòng tách thành các đơn riêng cho từng năm.',
      });
    }

    const totalDays = this.calculateTotalDays(dto.startDate, dto.endDate);

    // Call atomic create RPC
    const { data, error } = await this.client.rpc(
      'phase5_create_leave_request',
      {
        p_user_id: user.profileId,
        p_leave_type_id: dto.leaveTypeId,
        p_start_date: dto.startDate,
        p_end_date: dto.endDate,
        p_total_days: totalDays,
        p_reason: dto.reason ?? '',
      },
    );

    if (error) {
      const msg = error.message;
      if (msg.includes('LEAVE_TYPE_NOT_FOUND')) {
        throw new NotFoundException({
          code: 'LEAVE_TYPE_NOT_FOUND',
          message: 'Loại nghỉ phép không tồn tại.',
        });
      }
      if (msg.includes('LEAVE_DATE_OVERLAP')) {
        throw new BadRequestException({
          code: 'LEAVE_DATE_OVERLAP',
          message:
            'Thời gian nghỉ phép đăng ký bị trùng với lịch nghỉ đã có hoặc đang chờ duyệt.',
        });
      }
      throw new InternalServerErrorException({
        code: 'LEAVE_WRITE_FAILED',
        message: 'Không thể tạo đơn xin nghỉ phép.',
      });
    }

    return data;
  }

  // Get own leave request list
  async getMyRequests(query: LeaveQuery, user: RequestUser) {
    this.enforceInternalUser(user);

    let dbQuery = this.client
      .from('leave_requests')
      .select('*, leave_type:leave_types(*)', { count: 'exact' })
      .eq('user_id', user.profileId);

    if (query.status) {
      dbQuery = dbQuery.eq('status', query.status);
    }
    if (query.leaveTypeId) {
      dbQuery = dbQuery.eq('leave_type_id', query.leaveTypeId);
    }

    const offset = (query.page - 1) * query.pageSize;
    const { data, count, error } = await dbQuery
      .order('created_at', { ascending: false })
      .range(offset, offset + query.pageSize - 1);

    if (error) {
      throw new InternalServerErrorException({
        code: 'LEAVE_WRITE_FAILED',
        message: 'Không thể tải lịch sử nghỉ phép cá nhân.',
      });
    }

    const total = count ?? 0;
    return {
      items: data || [],
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  // Get own leave balance status
  async getMyBalances(user: RequestUser) {
    this.enforceInternalUser(user);

    const currentYear = new Date().getFullYear();

    const { data, error } = await this.client
      .from('leave_balances')
      .select('*, leave_type:leave_types(*)')
      .eq('user_id', user.profileId)
      .eq('year', currentYear);

    if (error) {
      throw new InternalServerErrorException({
        code: 'LEAVE_WRITE_FAILED',
        message: 'Không thể tải số dư phép của bạn.',
      });
    }

    return data || [];
  }

  // Scoped leave directory retrieval (Blocker 10 - DB Side Scoping)
  async getDirectory(query: LeaveQuery, user: RequestUser) {
    this.enforceInternalUser(user);

    const isAdmin = user.role === 'admin';
    const isLeader = user.role === 'team_leader';

    if (!isAdmin && !isLeader) {
      throw new ForbiddenException({
        code: 'LEAVE_ACCESS_DENIED',
        message: 'Bạn không có quyền quản lý đơn nghỉ phép nhân viên.',
      });
    }

    let teamIdConstraint: string | null = null;

    if (isLeader) {
      const { data: team, error: teamError } = await this.client
        .from('teams')
        .select('id')
        .eq('leader_user_id', user.profileId)
        .maybeSingle();

      if (teamError || !team) {
        teamIdConstraint = '00000000-0000-0000-0000-000000000000';
      } else {
        teamIdConstraint = team.id;
      }
    }

    // Leader permission restrictions checked before DB query
    if (query.teamId && isLeader && query.teamId !== teamIdConstraint) {
      throw new ForbiddenException({
        code: 'LEAVE_ACCESS_DENIED',
        message: 'Bạn chỉ có thể xem đơn nghỉ phép của đội nhóm mình quản lý.',
      });
    }

    // Scoped query filter logic on inner join profile scopes
    let dbQuery = this.client
      .from('leave_requests')
      .select(
        '*, leave_type:leave_types(*), profile:profiles!inner(id, full_name, email, employee_profile:employee_profiles!inner(team_id, department_id))',
        { count: 'exact' },
      );

    if (query.status) {
      dbQuery = dbQuery.eq('status', query.status);
    }
    if (query.leaveTypeId) {
      dbQuery = dbQuery.eq('leave_type_id', query.leaveTypeId);
    }
    if (query.userId) {
      dbQuery = dbQuery.eq('user_id', query.userId);
    }

    // Scoped filtering at DB layer
    if (isLeader) {
      dbQuery = dbQuery.eq(
        'profile.employee_profile.team_id',
        teamIdConstraint,
      );
    } else if (query.teamId) {
      dbQuery = dbQuery.eq('profile.employee_profile.team_id', query.teamId);
    }

    const offset = (query.page - 1) * query.pageSize;
    const { data, count, error } = await dbQuery
      .order('created_at', { ascending: false })
      .range(offset, offset + query.pageSize - 1);

    if (error) {
      throw new InternalServerErrorException({
        code: 'LEAVE_WRITE_FAILED',
        message: 'Không thể tải danh sách đơn nghỉ phép.',
      });
    }

    const sanitized = (data || []).map((row: any) => {
      const rowCopy = { ...row };
      const empProfile = Array.isArray(row.profile?.employee_profile)
        ? row.profile.employee_profile[0]
        : row.profile?.employee_profile;

      rowCopy.employee = row.profile
        ? {
            id: row.profile.id,
            fullName: row.profile.full_name,
            email: row.profile.email,
            teamId: empProfile?.team_id || null,
            departmentId: empProfile?.department_id || null,
          }
        : null;

      delete rowCopy.profile;
      return rowCopy;
    });

    const total = count ?? sanitized.length;
    return {
      items: sanitized,
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  // Leave Request Review (Approve/Reject) using atomic RPC transaction (Blocker 4)
  async reviewRequest(
    requestId: string,
    dto: LeaveReviewDto,
    user: RequestUser,
  ) {
    this.enforceInternalUser(user);

    const isAdmin = user.role === 'admin';
    const isLeader = user.role === 'team_leader';

    if (!isAdmin && !isLeader) {
      throw new ForbiddenException({
        code: 'LEAVE_ACCESS_DENIED',
        message: 'Bạn không có quyền duyệt/từ chối đơn nghỉ phép.',
      });
    }

    // Verify team leader scope if leader
    if (isLeader) {
      const { data: requestUserTeam, error: teamQueryError } = await this.client
        .from('leave_requests')
        .select(
          'user_id, profile:profiles(employee_profile:employee_profiles(team_id))',
        )
        .eq('id', requestId)
        .maybeSingle();

      if (teamQueryError || !requestUserTeam) {
        throw new NotFoundException({
          code: 'LEAVE_REQUEST_NOT_FOUND',
          message: 'Không tìm thấy đơn xin nghỉ phép.',
        });
      }

      const profile = (requestUserTeam as any).profile;
      const empProfile = Array.isArray(profile?.employee_profile)
        ? profile.employee_profile[0]
        : profile?.employee_profile;

      const { data: leadingTeam } = await this.client
        .from('teams')
        .select('id')
        .eq('leader_user_id', user.profileId)
        .eq('id', empProfile?.team_id || '')
        .maybeSingle();

      if (!leadingTeam) {
        throw new ForbiddenException({
          code: 'LEAVE_ACCESS_DENIED',
          message:
            'Bạn chỉ có quyền duyệt đơn nghỉ phép cho thành viên thuộc đội nhóm của bạn.',
        });
      }
    }

    // Call atomic review request database function
    const { data, error } = await this.client.rpc(
      'phase5_review_leave_request',
      {
        p_request_id: requestId,
        p_reviewer_id: user.profileId,
        p_action: dto.action,
        p_review_note: dto.reviewNote ?? '',
      },
    );

    if (error) {
      const msg = error.message;
      if (msg.includes('LEAVE_REQUEST_NOT_FOUND')) {
        throw new NotFoundException({
          code: 'LEAVE_REQUEST_NOT_FOUND',
          message: 'Không tìm thấy đơn xin nghỉ phép.',
        });
      }
      if (msg.includes('LEAVE_ALREADY_REVIEWED')) {
        throw new BadRequestException({
          code: 'LEAVE_ALREADY_REVIEWED',
          message: 'Đơn này đã được duyệt hoặc từ chối trước đó.',
        });
      }
      if (msg.includes('LEAVE_SELF_REVIEW_DENIED')) {
        throw new BadRequestException({
          code: 'LEAVE_SELF_REVIEW_DENIED',
          message: 'Bạn không thể tự duyệt đơn nghỉ phép của chính mình.',
        });
      }
      if (msg.includes('LEAVE_BALANCE_NOT_FOUND')) {
        throw new NotFoundException({
          code: 'LEAVE_BALANCE_NOT_FOUND',
          message: 'Không tìm thấy thông tin số dư ngày phép cho nhân sự.',
        });
      }
      if (msg.includes('LEAVE_INSUFFICIENT_BALANCE')) {
        throw new BadRequestException({
          code: 'LEAVE_INSUFFICIENT_BALANCE',
          message: 'Số dư ngày phép khả dụng không đủ.',
        });
      }
      throw new InternalServerErrorException({
        code: 'LEAVE_WRITE_FAILED',
        message: 'Lỗi đồng bộ cơ sở dữ liệu khi duyệt phép.',
      });
    }

    return data;
  }

  // Cancel Leave Request (Blocker 7 - Atomic RPC cancellation)
  async cancelRequest(requestId: string, user: RequestUser) {
    this.enforceInternalUser(user);

    const isAdmin = user.role === 'admin';

    const { data, error } = await this.client.rpc(
      'phase5_cancel_leave_request',
      {
        p_request_id: requestId,
        p_actor_profile_id: user.profileId,
        p_is_admin: isAdmin,
      },
    );

    if (error) {
      const msg = error.message;
      if (msg.includes('LEAVE_REQUEST_NOT_FOUND')) {
        throw new NotFoundException({
          code: 'LEAVE_REQUEST_NOT_FOUND',
          message: 'Không tìm thấy đơn xin nghỉ phép.',
        });
      }
      if (msg.includes('LEAVE_CANCEL_NOT_ALLOWED')) {
        throw new BadRequestException({
          code: 'LEAVE_CANCEL_NOT_ALLOWED',
          message: 'Không thể hủy đơn nghỉ phép ở trạng thái hiện tại.',
        });
      }
      if (msg.includes('LEAVE_ACCESS_DENIED')) {
        throw new ForbiddenException({
          code: 'LEAVE_ACCESS_DENIED',
          message: 'Bạn không có quyền hủy đơn nghỉ phép này.',
        });
      }
      throw new InternalServerErrorException({
        code: 'LEAVE_WRITE_FAILED',
        message: 'Lỗi hủy bỏ đơn nghỉ phép.',
      });
    }

    return data;
  }

  // Admin-only leave balance adjustments using atomic RPC (Blocker 8)
  async adjustBalance(
    balanceId: string,
    dto: LeaveBalanceAdjustmentDto,
    user: RequestUser,
  ) {
    this.enforceInternalUser(user);
    if (user.role !== 'admin') {
      throw new ForbiddenException({
        code: 'LEAVE_ACCESS_DENIED',
        message: 'Chỉ quản trị viên mới có thể điều chỉnh số dư ngày phép.',
      });
    }

    const { data, error } = await this.client.rpc(
      'phase5_adjust_leave_balance',
      {
        p_balance_id: balanceId,
        p_delta_days: dto.deltaDays,
        p_reason: dto.reason,
        p_actor_profile: user.profileId,
      },
    );

    if (error) {
      const msg = error.message;
      if (msg.includes('LEAVE_BALANCE_NOT_FOUND')) {
        throw new NotFoundException({
          code: 'LEAVE_BALANCE_NOT_FOUND',
          message: 'Không tìm thấy thông tin số dư ngày phép cần điều chỉnh.',
        });
      }
      if (msg.includes('LEAVE_INSUFFICIENT_BALANCE')) {
        throw new BadRequestException({
          code: 'LEAVE_INSUFFICIENT_BALANCE',
          message: 'Không thể giảm số dư ngày phép dưới 0 ngày khả dụng.',
        });
      }
      throw new InternalServerErrorException({
        code: 'LEAVE_WRITE_FAILED',
        message: 'Không thể cập nhật số dư phép nhân sự.',
      });
    }

    return data;
  }

  // Get calendar leave overlap occurrences (Internal employees only)
  async getCalendar(from: string, to: string, user: RequestUser) {
    this.enforceInternalUser(user);

    if (!from || !to) {
      throw new BadRequestException(
        'from và to query date parameters là bắt buộc.',
      );
    }

    const { data, error } = await this.client
      .from('leave_requests')
      .select(
        'id, user_id, start_date, end_date, status, leave_type:leave_types(code, name), profile:profiles(full_name)',
      )
      .eq('status', 'approved')
      .or(`start_date.lte.${to},end_date.gte.${from}`);

    if (error) {
      throw new InternalServerErrorException({
        code: 'LEAVE_WRITE_FAILED',
        message: 'Không thể tải lịch nghỉ phép của toàn công ty.',
      });
    }

    // Privacy preservation: strip reason detail from list
    return (data || []).map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      fullName: row.profile?.full_name || 'Nhân sự',
      startDate: row.start_date,
      endDate: row.end_date,
      status: row.status,
      leaveType: row.leave_type?.name || 'Nghỉ phép',
    }));
  }
}
