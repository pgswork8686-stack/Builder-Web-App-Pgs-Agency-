import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
  Logger,
  Optional,
} from '@nestjs/common';
import { AutomationService } from '../automation/automation.service';
import { SupabaseService } from '../supabase/supabase.service';
import { RequestUser } from '../auth/auth.types';
import { NotificationsService } from '../notifications/notifications.service';
import {
  CheckInDto,
  CheckOutDto,
  AttendanceQuery,
  AttendanceAdjustmentDto,
} from './dto/attendance.dto';
import * as crypto from 'crypto';

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    @Optional() private readonly notifications?: NotificationsService,
    @Optional() private readonly automation?: AutomationService,
  ) {}

  private get client() {
    return this.supabaseService.getSystemClient();
  }

  // Get active attendance settings
  private async getSettings() {
    const { data, error } = await this.client
      .from('attendance_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException({
        code: 'ATTENDANCE_WRITE_FAILED',
        message: 'Không thể đọc cấu hình chấm công.',
      });
    }

    return data;
  }

  // Check if user is a client (reject client access to attendance)
  private enforceInternalUser(user: RequestUser) {
    if (user.role === 'client') {
      throw new ForbiddenException({
        code: 'ATTENDANCE_ACCESS_DENIED',
        message: 'Khách hàng không có quyền truy cập chức năng chấm công.',
      });
    }
  }

  // Get local date string for Asia/Ho_Chi_Minh timezone
  private getVietnamDate(date: Date = new Date()): string {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.formatToParts(date);
    const year = parts.find((p) => p.type === 'year')?.value;
    const month = parts.find((p) => p.type === 'month')?.value;
    const day = parts.find((p) => p.type === 'day')?.value;
    return `${year}-${month}-${day}`;
  }

  private async notifyAttendanceAdjusted(
    record: any,
    adjustment: any,
    user: RequestUser,
  ) {
    if (!this.notifications && !this.automation) return;
    try {
      await this.notifications?.createForUser({
        recipientUserId: record.user_id,
        type: 'attendance.adjustment_requested',
        title: 'Cham cong da dieu chinh',
        message: 'Ban ghi cham cong cua ban da duoc quan tri vien dieu chinh.',
        entityType: 'attendance_record',
        entityId: record.id,
        actionUrl: '/app/attendance',
        metadata: {
          recordId: record.id,
          attendanceDate: record.attendance_date,
          adjustmentId: adjustment?.id ?? null,
        },
        actorUserId: user.profileId,
      });
      await this.automation?.runEvent({
        triggerType: 'attendance.adjustment_requested',
        eventKey: `attendance.adjustment:${adjustment?.id ?? record.id}:${record.attendance_date}`,
        payload: {
          recordId: record.id,
          attendanceDate: record.attendance_date,
          targetUserId: record.user_id,
          adjustmentId: adjustment?.id ?? null,
        },
        actorUserId: user.profileId,
        defaultRecipients: [record.user_id],
        title: 'Cham cong da dieu chinh',
        message: 'Ban ghi cham cong vua duoc dieu chinh.',
        entityType: 'attendance_record',
        entityId: record.id,
        actionUrl: '/app/attendance',
      });
    } catch (error) {
      this.logger.error(
        `Attendance side effects failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }

  // Parse time string 'HH:MM:SS' into minutes of day
  private getMinutesFromTime(timeStr: string): number {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }

  // Get minutes of day from date in Ho Chi Minh timezone
  private getVietnamMinutesOfDay(date: Date): number {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const hour = Number(parts.find((p) => p.type === 'hour')?.value);
    const minute = Number(parts.find((p) => p.type === 'minute')?.value);
    return hour * 60 + minute;
  }

  // Calculate status, late_minutes, early_leave_minutes based on check-in/out and policy
  private calculateAttendanceMetrics(
    checkInAt: Date | null,
    checkOutAt: Date | null,
    settings: any,
  ) {
    let status:
      | 'present'
      | 'late'
      | 'early_leave'
      | 'late_and_early_leave'
      | 'incomplete' = 'incomplete';
    let lateMinutes = 0;
    let earlyLeaveMinutes = 0;
    let workMinutes: number | null = null;

    if (checkInAt && checkOutAt) {
      workMinutes = Math.max(
        0,
        Math.floor((checkOutAt.getTime() - checkInAt.getTime()) / 60000),
      );
    }

    // BLOCKER 1: Remove Invented HR Policy (late/early metrics remain 0 if workday_start/end is unconfigured)
    const hasWorkdayStart = !!settings?.workday_start_time;
    const hasWorkdayEnd = !!settings?.workday_end_time;

    if (checkInAt && hasWorkdayStart) {
      const checkInMinutes = this.getVietnamMinutesOfDay(checkInAt);
      const policyStartMinutes = this.getMinutesFromTime(
        settings.workday_start_time,
      );
      const lateGrace = settings.late_grace_minutes ?? 0;

      const diff = checkInMinutes - policyStartMinutes;
      if (diff > lateGrace) {
        lateMinutes = diff;
      }
    }

    if (checkOutAt && hasWorkdayEnd) {
      const checkOutMinutes = this.getVietnamMinutesOfDay(checkOutAt);
      const policyEndMinutes = this.getMinutesFromTime(
        settings.workday_end_time,
      );
      const earlyGrace = settings.early_leave_grace_minutes ?? 0;

      const diff = policyEndMinutes - checkOutMinutes;
      if (diff > earlyGrace) {
        earlyLeaveMinutes = diff;
      }
    }

    if (checkInAt && checkOutAt) {
      if (lateMinutes > 0 && earlyLeaveMinutes > 0) {
        status = 'late_and_early_leave';
      } else if (lateMinutes > 0) {
        status = 'late';
      } else if (earlyLeaveMinutes > 0) {
        status = 'early_leave';
      } else {
        status = 'present';
      }
    } else if (checkInAt) {
      status = 'incomplete';
    }

    return { status, lateMinutes, earlyLeaveMinutes, workMinutes };
  }

  // Validate photo upload session matches requirements
  private async verifyPhotoUploadSession(
    sessionId: string | null | undefined,
    userProfileId: string,
  ) {
    if (!sessionId) return null;

    const { data: session, error } = await this.client
      .from('attendance_photo_upload_sessions')
      .select('*')
      .eq('id', sessionId)
      .maybeSingle();

    if (error || !session) {
      throw new BadRequestException({
        code: 'ATTENDANCE_PHOTO_SESSION_INVALID',
        message: 'Phiên tải ảnh lên không hợp lệ.',
      });
    }

    if (session.user_id !== userProfileId) {
      throw new ForbiddenException({
        code: 'ATTENDANCE_PHOTO_SESSION_DENIED',
        message: 'Bạn không sở hữu phiên tải ảnh này.',
      });
    }

    if (new Date(session.expires_at) < new Date()) {
      throw new BadRequestException({
        code: 'ATTENDANCE_PHOTO_SESSION_EXPIRED',
        message: 'Phiên tải ảnh đã hết hạn.',
      });
    }

    if (session.consumed_at) {
      throw new BadRequestException({
        code: 'ATTENDANCE_PHOTO_SESSION_REUSED',
        message: 'Phiên tải ảnh đã được sử dụng.',
      });
    }

    if (session.storage_bucket !== 'attendance-evidence') {
      throw new BadRequestException({
        code: 'ATTENDANCE_PHOTO_MISMATCH',
        message: 'Bucket lưu trữ ảnh không khớp với phiên đăng ký.',
      });
    }

    // Verify the exact object bound to this upload session.
    const pathParts = String(session.expected_path).split('/');
    const expectedName = pathParts.pop();
    const folder = pathParts.join('/');

    if (!expectedName) {
      throw new BadRequestException({
        code: 'ATTENDANCE_PHOTO_MISMATCH',
        message: 'Đường dẫn ảnh trong phiên đăng ký không hợp lệ.',
      });
    }

    const supabaseAdmin = this.supabaseService.getSystemClient();
    const { data: listData, error: listError } = await supabaseAdmin.storage
      .from(session.storage_bucket)
      .list(folder, { search: expectedName });

    const storageObj = listData?.find(
      (item: any) => item.name === expectedName,
    );
    if (listError || !storageObj) {
      throw new BadRequestException({
        code: 'ATTENDANCE_PHOTO_NOT_FOUND',
        message: 'Không tìm thấy tệp ảnh tải lên trong Storage.',
      });
    }

    const actualMime = storageObj.metadata?.mimetype ?? null;
    const actualSize =
      storageObj.metadata?.size === undefined ||
      storageObj.metadata?.size === null
        ? null
        : Number(storageObj.metadata.size);

    if (actualMime !== session.expected_mime) {
      throw new BadRequestException({
        code: 'ATTENDANCE_PHOTO_MISMATCH',
        message: 'Định dạng tệp ảnh không khớp với phiên đăng ký.',
      });
    }

    if (
      actualSize === null ||
      !Number.isFinite(actualSize) ||
      actualSize !== Number(session.expected_size)
    ) {
      throw new BadRequestException({
        code: 'ATTENDANCE_PHOTO_MISMATCH',
        message: 'Kích thước tệp ảnh không khớp với phiên đăng ký.',
      });
    }

    return session.expected_path;
  }

  // Check In API implementation using atomic DB RPC
  async checkIn(dto: CheckInDto, user: RequestUser) {
    this.enforceInternalUser(user);
    const settings = await this.getSettings();

    // Check location requirement
    if (
      settings?.location_required &&
      (dto.latitude === undefined ||
        dto.longitude === undefined ||
        dto.latitude === null ||
        dto.longitude === null)
    ) {
      throw new BadRequestException({
        code: 'ATTENDANCE_LOCATION_REQUIRED',
        message: 'Tọa độ GPS là bắt buộc theo chính sách chấm công.',
      });
    }

    // Check photo requirement
    if (settings?.photo_required && !dto.photoUploadSessionId) {
      throw new BadRequestException({
        code: 'ATTENDANCE_PHOTO_REQUIRED',
        message: 'Ảnh bằng chứng là bắt buộc theo chính sách chấm công.',
      });
    }

    // Verify photo session (validates ownership, expiry, MIME/size exact binding)
    // DB derives the photo path internally from the session — no path returned needed here
    await this.verifyPhotoUploadSession(
      dto.photoUploadSessionId,
      user.profileId,
    );

    const todayStr = this.getVietnamDate();
    const checkInTime = new Date();

    const { status, lateMinutes } = this.calculateAttendanceMetrics(
      checkInTime,
      null,
      settings,
    );

    // Call check-in RPC function — p_photo_path removed; DB derives path from session
    const { data, error } = await this.client.rpc(
      'phase5_check_in_attendance',
      {
        p_user_id: user.profileId,
        p_attendance_date: todayStr,
        p_check_in_at: checkInTime.toISOString(),
        p_latitude: dto.latitude ?? null,
        p_longitude: dto.longitude ?? null,
        p_accuracy_meters: dto.accuracyMeters ?? null,
        p_note: dto.note ?? null,
        p_status: status,
        p_late_minutes: lateMinutes,
        p_source: 'web',
        p_created_by: user.profileId,
        p_updated_by: user.profileId,
        p_photo_session_id: dto.photoUploadSessionId ?? null,
      },
    );

    if (error) {
      const msg = error.message;
      if (error.code === '23505' || msg.includes('duplicate key')) {
        throw new BadRequestException({
          code: 'ATTENDANCE_ALREADY_CHECKED_IN',
          message: 'Bạn đã thực hiện check-in cho ngày hôm nay rồi.',
        });
      }
      if (msg.includes('ATTENDANCE_PHOTO_SESSION_REUSED')) {
        throw new BadRequestException({
          code: 'ATTENDANCE_PHOTO_SESSION_REUSED',
          message: 'Phiên tải ảnh đã được sử dụng.',
        });
      }
      throw new InternalServerErrorException({
        code: 'ATTENDANCE_WRITE_FAILED',
        message: 'Không thể ghi nhận thông tin check-in.',
      });
    }

    return data;
  }

  // Check Out API implementation using atomic DB RPC
  async checkOut(dto: CheckOutDto, user: RequestUser) {
    this.enforceInternalUser(user);
    const settings = await this.getSettings();

    const todayStr = this.getVietnamDate();
    const checkOutTime = new Date();

    // Query current day check-in record first (pre-check for Nest validation)
    const { data: record, error: findError } = await this.client
      .from('attendance_records')
      .select('*')
      .eq('user_id', user.profileId)
      .eq('attendance_date', todayStr)
      .maybeSingle();

    if (findError) {
      throw new InternalServerErrorException({
        code: 'ATTENDANCE_WRITE_FAILED',
        message: 'Lỗi truy vấn bản ghi chấm công ngày hôm nay.',
      });
    }

    if (!record) {
      throw new BadRequestException({
        code: 'ATTENDANCE_NOT_CHECKED_IN',
        message: 'Bạn chưa check-in cho ngày hôm nay.',
      });
    }

    if (record.check_out_at) {
      throw new BadRequestException({
        code: 'ATTENDANCE_ALREADY_CHECKED_OUT',
        message: 'Bạn đã check-out ngày hôm nay rồi.',
      });
    }

    const checkInTime = new Date(record.check_in_at);
    if (checkOutTime < checkInTime) {
      throw new BadRequestException({
        code: 'ATTENDANCE_INVALID_TIME_RANGE',
        message: 'Thời gian check-out phải sau thời gian check-in.',
      });
    }

    // Verify photo session (validates ownership, expiry, MIME/size exact binding)
    // DB derives the photo path internally from the session — no path returned needed here
    await this.verifyPhotoUploadSession(
      dto.photoUploadSessionId,
      user.profileId,
    );

    const { status, lateMinutes, earlyLeaveMinutes, workMinutes } =
      this.calculateAttendanceMetrics(checkInTime, checkOutTime, settings);

    // Call atomic checkout RPC — p_photo_path removed; DB derives path from session
    const { data, error } = await this.client.rpc(
      'phase5_check_out_attendance',
      {
        p_user_id: user.profileId,
        p_attendance_date: todayStr,
        p_checkout_time: checkOutTime.toISOString(),
        p_latitude: dto.latitude ?? null,
        p_longitude: dto.longitude ?? null,
        p_accuracy_meters: dto.accuracyMeters ?? null,
        p_note: dto.note ?? null,
        p_status: status,
        p_late_minutes: lateMinutes,
        p_early_leave_minutes: earlyLeaveMinutes,
        p_work_minutes: workMinutes,
        p_photo_session_id: dto.photoUploadSessionId ?? null,
      },
    );

    if (error) {
      const msg = error.message;
      if (msg.includes('ATTENDANCE_NOT_CHECKED_IN')) {
        throw new BadRequestException({
          code: 'ATTENDANCE_NOT_CHECKED_IN',
          message: 'Bạn chưa check-in cho ngày hôm nay.',
        });
      }
      if (msg.includes('ATTENDANCE_ALREADY_CHECKED_OUT')) {
        throw new BadRequestException({
          code: 'ATTENDANCE_ALREADY_CHECKED_OUT',
          message: 'Bạn đã check-out ngày hôm nay rồi.',
        });
      }
      if (msg.includes('ATTENDANCE_INVALID_TIME_RANGE')) {
        throw new BadRequestException({
          code: 'ATTENDANCE_INVALID_TIME_RANGE',
          message: 'Thời gian check-out phải sau thời gian check-in.',
        });
      }
      if (msg.includes('ATTENDANCE_PHOTO_SESSION_REUSED')) {
        throw new BadRequestException({
          code: 'ATTENDANCE_PHOTO_SESSION_REUSED',
          message: 'Phiên tải ảnh đã được sử dụng.',
        });
      }
      throw new InternalServerErrorException({
        code: 'ATTENDANCE_WRITE_FAILED',
        message: 'Không thể ghi nhận thông tin check-out.',
      });
    }

    await this.notifyAttendanceAdjusted(record, data, user);

    return data;
  }

  // Get employee own attendance history
  async getMyHistory(query: AttendanceQuery, user: RequestUser) {
    this.enforceInternalUser(user);

    let dbQuery = this.client
      .from('attendance_records')
      .select('*', { count: 'exact' })
      .eq('user_id', user.profileId);

    if (query.from) {
      dbQuery = dbQuery.gte('attendance_date', query.from);
    }
    if (query.to) {
      dbQuery = dbQuery.lte('attendance_date', query.to);
    }
    if (query.status) {
      dbQuery = dbQuery.eq('status', query.status);
    }

    const offset = (query.page - 1) * query.pageSize;
    const { data, count, error } = await dbQuery
      .order('attendance_date', { ascending: false })
      .range(offset, offset + query.pageSize - 1);

    if (error) {
      throw new InternalServerErrorException({
        code: 'ATTENDANCE_WRITE_FAILED',
        message: 'Không thể truy vấn lịch sử chấm công cá nhân.',
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

  // Admin / Team Leader attendance lookup API (Blocker 10 - DB Side Filtering before Pagination)
  async getDirectory(query: AttendanceQuery, user: RequestUser) {
    this.enforceInternalUser(user);

    const isAdmin = user.role === 'admin';
    const isLeader = user.role === 'team_leader';

    if (!isAdmin && !isLeader) {
      throw new ForbiddenException({
        code: 'ATTENDANCE_ACCESS_DENIED',
        message: 'Bạn không có quyền truy cập danh sách chấm công nhân viên.',
      });
    }

    // Resolve team leader scope first
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

    // Raise access denied if team leader queries a different teamId
    if (query.teamId && isLeader && query.teamId !== teamIdConstraint) {
      throw new ForbiddenException({
        code: 'ATTENDANCE_ACCESS_DENIED',
        message: 'Bạn chỉ có quyền xem chấm công của đội nhóm của bạn.',
      });
    }

    // Raise access denied if team leader queries departmentId
    if (query.departmentId && isLeader) {
      throw new ForbiddenException({
        code: 'ATTENDANCE_ACCESS_DENIED',
        message:
          'Trưởng nhóm không có quyền xem chấm công theo toàn phòng ban.',
      });
    }

    // Build the DB-side filters
    let dbQuery = this.client
      .from('attendance_records')
      .select(
        '*, profile:profiles!inner(id, full_name, email, avatar_url, employee_profile:employee_profiles!inner(team_id, department_id))',
        { count: 'exact' },
      );

    if (query.from) {
      dbQuery = dbQuery.gte('attendance_date', query.from);
    }
    if (query.to) {
      dbQuery = dbQuery.lte('attendance_date', query.to);
    }
    if (query.status) {
      dbQuery = dbQuery.eq('status', query.status);
    }
    if (query.userId) {
      dbQuery = dbQuery.eq('user_id', query.userId);
    }

    // Apply scoping at DB layer
    if (isLeader) {
      dbQuery = dbQuery.eq(
        'profile.employee_profile.team_id',
        teamIdConstraint,
      );
    } else if (query.teamId) {
      dbQuery = dbQuery.eq('profile.employee_profile.team_id', query.teamId);
    }

    if (query.departmentId) {
      dbQuery = dbQuery.eq(
        'profile.employee_profile.department_id',
        query.departmentId,
      );
    }

    const offset = (query.page - 1) * query.pageSize;
    const { data, count, error } = await dbQuery
      .order('attendance_date', { ascending: false })
      .range(offset, offset + query.pageSize - 1);

    if (error) {
      throw new InternalServerErrorException({
        code: 'ATTENDANCE_WRITE_FAILED',
        message: 'Không thể truy vấn danh sách chấm công nhân sự.',
      });
    }

    // Map profiles/coordinates privacy filters
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
            avatarUrl: row.profile.avatar_url,
            teamId: empProfile?.team_id || null,
            departmentId: empProfile?.department_id || null,
          }
        : null;

      delete rowCopy.profile;

      // Hide precise coordinates for non-self unless admin
      if (!isAdmin) {
        delete rowCopy.check_in_latitude;
        delete rowCopy.check_in_longitude;
        delete rowCopy.check_out_latitude;
        delete rowCopy.check_out_longitude;
      }
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

  // Admin correction/adjustment API using atomic RPC (Blocker 6)
  async adjustRecord(
    recordId: string,
    dto: AttendanceAdjustmentDto,
    user: RequestUser,
  ) {
    this.enforceInternalUser(user);
    if (user.role !== 'admin') {
      throw new ForbiddenException({
        code: 'ATTENDANCE_ACCESS_DENIED',
        message: 'Chỉ quản trị viên mới có thể điều chỉnh bản ghi chấm công.',
      });
    }

    // Get existing record details for Nest validation checks
    const { data: record, error: findError } = await this.client
      .from('attendance_records')
      .select('*')
      .eq('id', recordId)
      .maybeSingle();

    if (findError || !record) {
      throw new NotFoundException({
        code: 'ATTENDANCE_NOT_FOUND',
        message: 'Không tìm thấy bản ghi chấm công cần điều chỉnh.',
      });
    }

    const settings = await this.getSettings();

    const setCheckIn = dto.checkInAt !== undefined;
    const setCheckOut = dto.checkOutAt !== undefined;
    const setStatus = dto.status !== undefined;

    const finalCheckIn = setCheckIn
      ? dto.checkInAt
        ? new Date(dto.checkInAt)
        : null
      : record.check_in_at
        ? new Date(record.check_in_at)
        : null;

    const finalCheckOut = setCheckOut
      ? dto.checkOutAt
        ? new Date(dto.checkOutAt)
        : null
      : record.check_out_at
        ? new Date(record.check_out_at)
        : null;

    if (finalCheckIn && finalCheckOut && finalCheckOut < finalCheckIn) {
      throw new BadRequestException({
        code: 'ATTENDANCE_INVALID_TIME_RANGE',
        message: 'Thời gian check-out phải sau thời gian check-in.',
      });
    }

    const { status, lateMinutes, earlyLeaveMinutes, workMinutes } =
      this.calculateAttendanceMetrics(finalCheckIn, finalCheckOut, settings);

    const finalStatus = setStatus ? dto.status : record.status || status;

    // Call atomic adjustment RPC with omission check flags
    const { data, error } = await this.client.rpc(
      'phase5_adjust_attendance_record',
      {
        p_record_id: recordId,
        p_adjusted_by_profile: user.profileId,
        p_adjusted_by_auth: user.authUserId,
        p_set_check_in: setCheckIn,
        p_check_in_at: finalCheckIn ? finalCheckIn.toISOString() : null,
        p_set_check_out: setCheckOut,
        p_check_out_at: finalCheckOut ? finalCheckOut.toISOString() : null,
        p_set_status: setStatus,
        p_status: finalStatus,
        p_late_minutes: lateMinutes,
        p_early_leave_minutes: earlyLeaveMinutes,
        p_work_minutes: workMinutes,
        p_reason: dto.reason,
      },
    );

    if (error) {
      const msg = error.message;
      if (msg.includes('ATTENDANCE_NOT_FOUND')) {
        throw new NotFoundException({
          code: 'ATTENDANCE_NOT_FOUND',
          message: 'Không tìm thấy bản ghi chấm công.',
        });
      }
      if (msg.includes('ATTENDANCE_INVALID_TIME_RANGE')) {
        throw new BadRequestException({
          code: 'ATTENDANCE_INVALID_TIME_RANGE',
          message: 'Thời gian check-out phải sau thời gian check-in.',
        });
      }
      throw new InternalServerErrorException({
        code: 'ATTENDANCE_WRITE_FAILED',
        message: 'Không thể cập nhật điều chỉnh bản ghi chấm công.',
      });
    }

    return data;
  }

  // Dashboard attendance summary
  async getSummary(user: RequestUser) {
    this.enforceInternalUser(user);

    const todayStr = this.getVietnamDate();

    // Check-in status today
    const { data: todayRecord, error: todayError } = await this.client
      .from('attendance_records')
      .select('*')
      .eq('user_id', user.profileId)
      .eq('attendance_date', todayStr)
      .maybeSingle();

    if (todayError) {
      throw new InternalServerErrorException({
        code: 'ATTENDANCE_WRITE_FAILED',
        message: 'Không thể truy vấn thông tin chấm công hôm nay.',
      });
    }

    // Monthly summary counts
    const startOfMonth = todayStr.substring(0, 8) + '01';
    const { data: monthRecords, error: monthError } = await this.client
      .from('attendance_records')
      .select('status')
      .eq('user_id', user.profileId)
      .gte('attendance_date', startOfMonth)
      .lte('attendance_date', todayStr);

    if (monthError) {
      throw new InternalServerErrorException({
        code: 'ATTENDANCE_WRITE_FAILED',
        message: 'Không thể truy vấn thông tin chấm công tháng này.',
      });
    }

    const presentDays =
      monthRecords?.filter((r) => r.status === 'present').length || 0;
    const lateCount =
      monthRecords?.filter(
        (r) => r.status === 'late' || r.status === 'late_and_early_leave',
      ).length || 0;
    const incompleteCount =
      monthRecords?.filter((r) => r.status === 'incomplete').length || 0;

    return {
      today: todayRecord
        ? {
            checkedIn: true,
            checkInAt: todayRecord.check_in_at,
            checkOutAt: todayRecord.check_out_at,
            status: todayRecord.status,
            workMinutes: todayRecord.work_minutes,
          }
        : {
            checkedIn: false,
            checkInAt: null,
            checkOutAt: null,
            status: null,
            workMinutes: null,
          },
      monthly: {
        presentDays,
        lateCount,
        incompleteCount,
        totalRecords: monthRecords?.length || 0,
      },
    };
  }

  // Signed upload token flow for photo evidence (Blocker 9 - crypto.randomUUID Upload Session)
  async getPhotoUploadSignature(
    fileName: string,
    mimeType: string,
    fileSize: number,
    user: RequestUser,
  ) {
    this.enforceInternalUser(user);

    if (fileSize <= 0 || fileSize > 5242880) {
      throw new BadRequestException({
        code: 'ATTENDANCE_PHOTO_TOO_LARGE',
        message:
          'Kích thước tệp tải lên phải lớn hơn 0 và không vượt quá 5 MB.',
      });
    }

    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimes.includes(mimeType)) {
      throw new BadRequestException({
        code: 'ATTENDANCE_PHOTO_INVALID_MIME',
        message:
          'Định dạng tệp ảnh không được hỗ trợ. Vui lòng tải lên jpeg, png hoặc webp.',
      });
    }

    const todayStr = this.getVietnamDate();
    const [year, month] = todayStr.split('-');

    // Safe extension from MIME
    const extension =
      mimeType === 'image/jpeg'
        ? 'jpg'
        : mimeType === 'image/webp'
          ? 'webp'
          : 'png';

    // Generate secure upload path using crypto.randomUUID() without raw user file name prefixes
    const fileId = crypto.randomUUID();
    const filePath = `attendance/${user.profileId}/${year}/${month}/${fileId}/evidence.${extension}`;

    // Get pre-signed storage upload URL (expires in 15 minutes)
    const supabaseAdmin = this.supabaseService.getSystemClient();
    const { data, error } = await supabaseAdmin.storage
      .from('attendance-evidence')
      .createSignedUploadUrl(filePath);

    if (error) {
      throw new InternalServerErrorException({
        code: 'ATTENDANCE_WRITE_FAILED',
        message: 'Không thể sinh chữ ký tải lên ảnh chấm công.',
      });
    }

    // Insert session tracker record into DB
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    const { data: session, error: sessionError } = await this.client
      .from('attendance_photo_upload_sessions')
      .insert({
        user_id: user.profileId,
        expected_path: filePath,
        expected_mime: mimeType,
        expected_size: fileSize,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .maybeSingle();

    if (sessionError || !session) {
      throw new InternalServerErrorException({
        code: 'ATTENDANCE_WRITE_FAILED',
        message: 'Không thể lưu phiên đăng ký tải lên ảnh.',
      });
    }

    return {
      photoUploadSessionId: session.id,
      signedUrl: data.signedUrl,
      token: data.token,
      path: filePath,
    };
  }
}
