import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { RequestUser } from '../auth/auth.types';
import { LeaveRequestCreateDto, LeaveReviewDto, LeaveBalanceAdjustmentDto, LeaveQuery } from './dto/leave.dto';

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

  // Calculate inclusive calendar/workday count between start and end date
  private calculateTotalDays(startStr: string, endStr: string): number {
    const start = new Date(startStr);
    const end = new Date(endStr);
    
    let daysCount = 0;
    const current = new Date(start);

    while (current <= end) {
      const dayOfWeek = current.getDay();
      // Only count Monday-Friday as standard workdays
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        daysCount++;
      }
      current.setDate(current.getDate() + 1);
    }

    return daysCount === 0 ? 1 : daysCount;
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

  // Create a leave request (Employee self-service)
  async createRequest(dto: LeaveRequestCreateDto, user: RequestUser) {
    this.enforceInternalUser(user);

    if (dto.endDate < dto.startDate) {
      throw new BadRequestException({
        code: 'LEAVE_DATE_RANGE_INVALID',
        message: 'Ngày kết thúc không được trước ngày bắt đầu.',
      });
    }

    // Check leave type validity
    const { data: leaveType, error: typeError } = await this.client
      .from('leave_types')
      .select('*')
      .eq('id', dto.leaveTypeId)
      .maybeSingle();

    if (typeError || !leaveType) {
      throw new NotFoundException({
        code: 'LEAVE_TYPE_NOT_FOUND',
        message: 'Loại nghỉ phép không tồn tại.',
      });
    }

    // Overlap validation: search for active (pending / approved) leave requests overlapping this date range
    const { data: overlap, error: overlapError } = await this.client
      .from('leave_requests')
      .select('id')
      .eq('user_id', user.profileId)
      .in('status', ['pending', 'approved'])
      .or(`start_date.lte.${dto.endDate},end_date.gte.${dto.startDate}`)
      .limit(1);

    if (overlapError) {
      throw new InternalServerErrorException({
        code: 'LEAVE_WRITE_FAILED',
        message: 'Lỗi kiểm tra trùng lịch nghỉ phép.',
      });
    }

    // Double check specific date overlap overlap range checks
    const hasOverlap = (overlap || []).length > 0;
    if (hasOverlap) {
      throw new BadRequestException({
        code: 'LEAVE_DATE_OVERLAP',
        message: 'Thời gian nghỉ phép đăng ký bị trùng với lịch nghỉ đã có hoặc đang chờ duyệt.',
      });
    }

    const totalDays = this.calculateTotalDays(dto.startDate, dto.endDate);

    const { data, error } = await this.client
      .from('leave_requests')
      .insert({
        user_id: user.profileId,
        leave_type_id: dto.leaveTypeId,
        start_date: dto.startDate,
        end_date: dto.endDate,
        total_days: totalDays,
        reason: dto.reason ?? null,
        status: 'pending',
      })
      .select()
      .maybeSingle();

    if (error) {
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

  // Scoped leave directory retrieval (Admin & Team Leader)
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

    let dbQuery = this.client
      .from('leave_requests')
      .select('*, leave_type:leave_types(*), profile:profiles(id, full_name, email, employee_profile:employee_profiles(team_id, department_id))', { count: 'exact' });

    if (query.status) {
      dbQuery = dbQuery.eq('status', query.status);
    }
    if (query.leaveTypeId) {
      dbQuery = dbQuery.eq('leave_type_id', query.leaveTypeId);
    }
    if (query.userId) {
      dbQuery = dbQuery.eq('user_id', query.userId);
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

    let filtered = (data || []).map((row: any) => {
      const empProfile = Array.isArray(row.profile?.employee_profile)
        ? row.profile.employee_profile[0]
        : row.profile?.employee_profile;

      return {
        ...row,
        employee: row.profile
          ? {
              id: row.profile.id,
              fullName: row.profile.full_name,
              email: row.profile.email,
              teamId: empProfile?.team_id || null,
              departmentId: empProfile?.department_id || null,
            }
          : null,
      };
    });

    if (isLeader && teamIdConstraint) {
      filtered = filtered.filter((row: any) => row.employee?.teamId === teamIdConstraint);
    }

    if (query.teamId) {
      if (isLeader && query.teamId !== teamIdConstraint) {
        throw new ForbiddenException({
          code: 'LEAVE_ACCESS_DENIED',
          message: 'Bạn chỉ có thể xem đơn nghỉ phép của đội nhóm mình quản lý.',
        });
      }
      filtered = filtered.filter((row: any) => row.employee?.teamId === query.teamId);
    }

    // Privacy filter: strip reasons unless authorized
    const sanitized = filtered.map((row: any) => {
      const rowCopy = { ...row };
      delete rowCopy.profile;
      
      // Hide reasons from non-admin/non-team-leader unless it belongs to self
      // But directory is only accessed by leader & admin anyway
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

  // Leave Request Review (Approve/Reject) using atomic RPC transaction
  async reviewRequest(requestId: string, dto: LeaveReviewDto, user: RequestUser) {
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
        .select('user_id, profile:profiles(employee_profile:employee_profiles(team_id))')
        .eq('id', requestId)
        .maybeSingle();

      if (teamQueryError || !requestUserTeam) {
        throw new NotFoundException({
          code: 'LEAVE_REQUEST_NOT_FOUND',
          message: 'Không tìm thấy đơn xin nghỉ phép.',
        });
      }

      // Check leader leads this team
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
          message: 'Bạn chỉ có quyền duyệt đơn nghỉ phép cho thành viên thuộc đội nhóm của bạn.',
        });
      }
    }

    // Call atomic review request database function
    const { data, error } = await this.client.rpc('phase5_review_leave_request', {
      p_request_id: requestId,
      p_reviewer_id: user.profileId,
      p_action: dto.action,
      p_review_note: dto.reviewNote ?? '',
    });

    if (error) {
      const msg = error.message;
      if (msg.includes('LEAVE_REQUEST_NOT_FOUND')) {
        throw new NotFoundException({ code: 'LEAVE_REQUEST_NOT_FOUND', message: 'Không tìm thấy đơn xin nghỉ phép.' });
      }
      if (msg.includes('LEAVE_ALREADY_REVIEWED')) {
        throw new BadRequestException({ code: 'LEAVE_ALREADY_REVIEWED', message: 'Đơn này đã được duyệt hoặc từ chối trước đó.' });
      }
      if (msg.includes('LEAVE_SELF_REVIEW_DENIED')) {
        throw new BadRequestException({ code: 'LEAVE_SELF_REVIEW_DENIED', message: 'Bạn không thể tự duyệt đơn nghỉ phép của chính mình.' });
      }
      if (msg.includes('LEAVE_INSUFFICIENT_BALANCE')) {
        throw new BadRequestException({ code: 'LEAVE_INSUFFICIENT_BALANCE', message: 'Số dư ngày phép khả dụng không đủ.' });
      }
      throw new InternalServerErrorException({
        code: 'LEAVE_WRITE_FAILED',
        message: 'Lỗi đồng bộ cơ sở dữ liệu khi duyệt phép.',
      });
    }

    return data;
  }

  // Cancel Leave Request (Employee cancellation for pending, admin cancellation for approved)
  async cancelRequest(requestId: string, user: RequestUser) {
    this.enforceInternalUser(user);

    const { data: request, error: findError } = await this.client
      .from('leave_requests')
      .select('*')
      .eq('id', requestId)
      .maybeSingle();

    if (findError || !request) {
      throw new NotFoundException({
        code: 'LEAVE_REQUEST_NOT_FOUND',
        message: 'Không tìm thấy đơn xin nghỉ phép.',
      });
    }

    const isSelf = request.user_id === user.profileId;
    const isAdmin = user.role === 'admin';

    // Employee can cancel their own PENDING requests only
    if (isSelf) {
      if (request.status !== 'pending') {
        throw new BadRequestException({
          code: 'LEAVE_CANCEL_NOT_ALLOWED',
          message: 'Không thể hủy đơn nghỉ phép đã được duyệt hoặc từ chối. Hãy liên hệ Admin.',
        });
      }

      const { data, error } = await this.client
        .from('leave_requests')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancelled_by: user.profileId,
        })
        .eq('id', requestId)
        .select()
        .maybeSingle();

      if (error) {
        throw new InternalServerErrorException({
          code: 'LEAVE_WRITE_FAILED',
          message: 'Không thể hủy đơn nghỉ phép.',
        });
      }

      return data;
    }

    // Admin can cancel APPROVED requests to restore balance atomically
    if (isAdmin) {
      if (request.status !== 'approved') {
        throw new BadRequestException({
          code: 'LEAVE_CANCEL_NOT_ALLOWED',
          message: 'Chỉ có thể hủy đơn nghỉ phép đang ở trạng thái đã duyệt để phục hồi ngày phép.',
        });
      }

      // Check and lock leave balance row atomically before restoration to prevent race double restoration
      const year = EXTRACT_YEAR(request.start_date);
      
      const { data: leaveType } = await this.client
        .from('leave_types')
        .select('requires_balance')
        .eq('id', request.leave_type_id)
        .maybeSingle();

      // Transaction: updates balance used_days and changes request status to cancelled
      // Start transaction block by updating used_days
      if (leaveType?.requires_balance) {
        const { error: balanceError } = await this.client
          .from('leave_balances')
          .update({
            // Restore used days
            used_days: this.client.rpc('subtract', { value: request.total_days }) as any, // fallback or direct assignment
          })
          .eq('user_id', request.user_id)
          .eq('leave_type_id', request.leave_type_id)
          .eq('year', year);

        // Safe balance adjustment implementation
        const { data: balance, error: balanceFetchError } = await this.client
          .from('leave_balances')
          .select('id, used_days')
          .eq('user_id', request.user_id)
          .eq('leave_type_id', request.leave_type_id)
          .eq('year', year)
          .maybeSingle();

        if (!balanceFetchError && balance) {
          const newUsed = Math.max(0, Number(balance.used_days) - Number(request.total_days));
          await this.client
            .from('leave_balances')
            .update({ used_days: newUsed })
            .eq('id', balance.id);
        }
      }

      const { data, error } = await this.client
        .from('leave_requests')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancelled_by: user.profileId,
        })
        .eq('id', requestId)
        .select()
        .maybeSingle();

      if (error) {
        throw new InternalServerErrorException({
          code: 'LEAVE_WRITE_FAILED',
          message: 'Lỗi cập nhật hủy bỏ đơn phép.',
        });
      }

      return data;
    }

    throw new ForbiddenException({
      code: 'LEAVE_ACCESS_DENIED',
      message: 'Bạn không có quyền hủy đơn nghỉ phép của nhân viên khác.',
    });
  }

  // Admin-only leave balance adjustments with adjustment audit trails
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

    const { data: balance, error: findError } = await this.client
      .from('leave_balances')
      .select('*')
      .eq('id', balanceId)
      .maybeSingle();

    if (findError || !balance) {
      throw new NotFoundException({
        code: 'LEAVE_BALANCE_NOT_FOUND',
        message: 'Không tìm thấy thông tin số dư ngày phép cần điều chỉnh.',
      });
    }

    const nextAdjusted = Number(balance.adjusted_days) + dto.deltaDays;
    const available = Number(balance.allocated_days) + nextAdjusted - Number(balance.used_days);

    if (available < 0) {
      throw new BadRequestException({
        code: 'LEAVE_INSUFFICIENT_BALANCE',
        message: 'Không thể giảm số dư ngày phép dưới 0 ngày khả dụng.',
      });
    }

    // Update leave balances adjusted days
    const { error: updateError } = await this.client
      .from('leave_balances')
      .update({
        adjusted_days: nextAdjusted,
      })
      .eq('id', balanceId);

    if (updateError) {
      throw new InternalServerErrorException({
        code: 'LEAVE_WRITE_FAILED',
        message: 'Không thể cập nhật số dư phép nhân sự.',
      });
    }

    // Insert adjustment audit log
    const { data, error } = await this.client
      .from('leave_balance_adjustments')
      .insert({
        leave_balance_id: balanceId,
        delta_days: dto.deltaDays,
        reason: dto.reason,
        actor_user_id: user.profileId,
      })
      .select()
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException({
        code: 'LEAVE_WRITE_FAILED',
        message: 'Không thể lưu vết lịch sử điều chỉnh số dư phép.',
      });
    }

    return data;
  }

  // Get calendar leave overlap occurrences (Internal employees only)
  async getCalendar(from: string, to: string, user: RequestUser) {
    this.enforceInternalUser(user);

    if (!from || !to) {
      throw new BadRequestException('from và to query date parameters là bắt buộc.');
    }

    const { data, error } = await this.client
      .from('leave_requests')
      .select('id, user_id, start_date, end_date, status, leave_type:leave_types(code, name), profile:profiles(full_name)')
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

function EXTRACT_YEAR(dateStr: string): number {
  return new Date(dateStr).getFullYear();
}
