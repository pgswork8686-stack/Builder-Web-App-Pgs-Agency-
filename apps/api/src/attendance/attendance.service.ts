import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { RequestUser } from '../auth/auth.types';
import { CheckInDto, CheckOutDto, AttendanceQuery, AttendanceAdjustmentDto } from './dto/attendance.dto';

@Injectable()
export class AttendanceService {
  constructor(private readonly supabaseService: SupabaseService) {}

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
    let status: 'present' | 'late' | 'early_leave' | 'late_and_early_leave' | 'incomplete' = 'incomplete';
    let lateMinutes = 0;
    let earlyLeaveMinutes = 0;
    let workMinutes: number | null = null;

    if (checkInAt && checkOutAt) {
      workMinutes = Math.max(0, Math.floor((checkOutAt.getTime() - checkInAt.getTime()) / 60000));
    }

    if (checkInAt) {
      const checkInMinutes = this.getVietnamMinutesOfDay(checkInAt);
      const policyStartMinutes = this.getMinutesFromTime(settings?.workday_start_time || '08:30:00');
      const lateGrace = settings?.late_grace_minutes || 15;
      
      const diff = checkInMinutes - policyStartMinutes;
      if (diff > lateGrace) {
        lateMinutes = diff;
      }
    }

    if (checkOutAt) {
      const checkOutMinutes = this.getVietnamMinutesOfDay(checkOutAt);
      const policyEndMinutes = this.getMinutesFromTime(settings?.workday_end_time || '17:30:00');
      const earlyGrace = settings?.early_leave_grace_minutes || 15;

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

  // Check In API implementation
  async checkIn(dto: CheckInDto, user: RequestUser) {
    this.enforceInternalUser(user);
    const settings = await this.getSettings();

    // Check location requirement
    if (settings?.location_required && (dto.latitude === undefined || dto.longitude === undefined)) {
      throw new BadRequestException({
        code: 'ATTENDANCE_LOCATION_REQUIRED',
        message: 'Tọa độ GPS là bắt buộc theo chính sách chấm công.',
      });
    }

    // Check photo requirement
    if (settings?.photo_required && !dto.photoPath) {
      throw new BadRequestException({
        code: 'ATTENDANCE_PHOTO_REQUIRED',
        message: 'Ảnh bằng chứng là bắt buộc theo chính sách chấm công.',
      });
    }

    const todayStr = this.getVietnamDate();
    const checkInTime = new Date();

    const { status, lateMinutes, earlyLeaveMinutes } = this.calculateAttendanceMetrics(
      checkInTime,
      null,
      settings,
    );

    // Insert with check constraints and unique constraint to prevent race condition double check-ins
    const { data, error } = await this.client
      .from('attendance_records')
      .insert({
        user_id: user.profileId,
        attendance_date: todayStr,
        check_in_at: checkInTime.toISOString(),
        check_in_latitude: dto.latitude ?? null,
        check_in_longitude: dto.longitude ?? null,
        check_in_accuracy_meters: dto.accuracyMeters ?? null,
        check_in_photo_path: dto.photoPath ?? null,
        check_in_note: dto.note ?? null,
        status,
        late_minutes: lateMinutes,
        source: 'web',
        created_by: user.authUserId,
        updated_by: user.authUserId,
      })
      .select()
      .maybeSingle();

    if (error) {
      if (error.code === '23505') {
        throw new BadRequestException({
          code: 'ATTENDANCE_ALREADY_CHECKED_IN',
          message: 'Bạn đã thực hiện check-in cho ngày hôm nay rồi.',
        });
      }
      throw new InternalServerErrorException({
        code: 'ATTENDANCE_WRITE_FAILED',
        message: 'Không thể ghi nhận thông tin check-in.',
      });
    }

    return data;
  }

  // Check Out API implementation
  async checkOut(dto: CheckOutDto, user: RequestUser) {
    this.enforceInternalUser(user);
    const settings = await this.getSettings();

    const todayStr = this.getVietnamDate();
    const checkOutTime = new Date();

    // Query current day check-in record
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

    const { status, lateMinutes, earlyLeaveMinutes, workMinutes } = this.calculateAttendanceMetrics(
      checkInTime,
      checkOutTime,
      settings,
    );

    const { data, error } = await this.client
      .from('attendance_records')
      .update({
        check_out_at: checkOutTime.toISOString(),
        check_out_latitude: dto.latitude ?? null,
        check_out_longitude: dto.longitude ?? null,
        check_out_accuracy_meters: dto.accuracyMeters ?? null,
        check_out_photo_path: dto.photoPath ?? null,
        check_out_note: dto.note ?? null,
        status,
        late_minutes: lateMinutes,
        early_leave_minutes: earlyLeaveMinutes,
        work_minutes: workMinutes,
        updated_by: user.authUserId,
      })
      .eq('id', record.id)
      .select()
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException({
        code: 'ATTENDANCE_WRITE_FAILED',
        message: 'Không thể ghi nhận thông tin check-out.',
      });
    }

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

  // Admin / Team Leader attendance lookup API
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

    // Scoped visibility: team_leaders can only see employees belonging to their team
    let teamIdConstraint: string | null = null;

    if (isLeader) {
      // Find team led by this user
      const { data: team, error: teamError } = await this.client
        .from('teams')
        .select('id')
        .eq('leader_user_id', user.profileId)
        .maybeSingle();

      if (teamError || !team) {
        // If team leader doesn't lead any team, limit query returns nothing or raise scope restriction
        teamIdConstraint = '00000000-0000-0000-0000-000000000000';
      } else {
        teamIdConstraint = team.id;
      }
    }

    let dbQuery = this.client
      .from('attendance_records')
      .select('*, profile:profiles(id, full_name, email, avatar_url, employee_profile:employee_profiles(team_id, department_id))', { count: 'exact' });

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

    // Filter results according to team leader team scope or admin scope
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
              avatarUrl: row.profile.avatar_url,
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
      // Prevent team leaders from querying other teams
      if (isLeader && query.teamId !== teamIdConstraint) {
        throw new ForbiddenException({
          code: 'ATTENDANCE_ACCESS_DENIED',
          message: 'Bạn chỉ có thể truy vấn chấm công của đội nhóm mình quản lý.',
        });
      }
      filtered = filtered.filter((row: any) => row.employee?.teamId === query.teamId);
    }

    if (query.departmentId) {
      if (isLeader) {
        throw new ForbiddenException({
          code: 'ATTENDANCE_ACCESS_DENIED',
          message: 'Trưởng nhóm không có quyền xem chấm công theo toàn phòng ban.',
        });
      }
      filtered = filtered.filter((row: any) => row.employee?.departmentId === query.departmentId);
    }

    // Map profiles/coordinates privacy filters
    const sanitized = filtered.map((row: any) => {
      const rowCopy = { ...row };
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

  // Admin correction/adjustment API
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

    // Get existing record details
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

    const checkInAt = dto.checkInAt ? new Date(dto.checkInAt) : null;
    const checkOutAt = dto.checkOutAt ? new Date(dto.checkOutAt) : null;

    if (checkInAt && checkOutAt && checkOutAt < checkInAt) {
      throw new BadRequestException({
        code: 'ATTENDANCE_INVALID_TIME_RANGE',
        message: 'Thời gian check-out phải sau thời gian check-in.',
      });
    }

    const { status, lateMinutes, earlyLeaveMinutes, workMinutes } = this.calculateAttendanceMetrics(
      checkInAt,
      checkOutAt,
      settings,
    );

    const finalStatus = dto.status || status;

    const previousData = {
      check_in_at: record.check_in_at,
      check_out_at: record.check_out_at,
      status: record.status,
      late_minutes: record.late_minutes,
      early_leave_minutes: record.early_leave_minutes,
      work_minutes: record.work_minutes,
    };

    const newData = {
      check_in_at: checkInAt ? checkInAt.toISOString() : null,
      check_out_at: checkOutAt ? checkOutAt.toISOString() : null,
      status: finalStatus,
      late_minutes: lateMinutes,
      early_leave_minutes: earlyLeaveMinutes,
      work_minutes: workMinutes,
    };

    // Update record and log adjustment in atomic execution
    const { error: updateError } = await this.client
      .from('attendance_records')
      .update({
        check_in_at: newData.check_in_at,
        check_out_at: newData.check_out_at,
        status: newData.status,
        late_minutes: newData.late_minutes,
        early_leave_minutes: newData.early_leave_minutes,
        work_minutes: newData.work_minutes,
        source: 'admin_adjustment',
        updated_by: user.authUserId,
      })
      .eq('id', recordId);

    if (updateError) {
      throw new InternalServerErrorException({
        code: 'ATTENDANCE_WRITE_FAILED',
        message: 'Không thể cập nhật điều chỉnh bản ghi chấm công.',
      });
    }

    const { data: adjustment, error: logError } = await this.client
      .from('attendance_adjustments')
      .insert({
        attendance_record_id: recordId,
        requested_by: user.profileId,
        approved_by: user.profileId,
        reason: dto.reason,
        previous_data: previousData,
        new_data: newData,
        status: 'approved',
        reviewed_at: new Date().toISOString(),
      })
      .select()
      .maybeSingle();

    if (logError) {
      throw new InternalServerErrorException({
        code: 'ATTENDANCE_WRITE_FAILED',
        message: 'Lỗi ghi chép lịch sử điều chỉnh chấm công.',
      });
    }

    return adjustment;
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

    const presentDays = monthRecords?.filter((r) => r.status === 'present').length || 0;
    const lateCount = monthRecords?.filter((r) => r.status === 'late' || r.status === 'late_and_early_leave').length || 0;
    const incompleteCount = monthRecords?.filter((r) => r.status === 'incomplete').length || 0;

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

  // Signed upload token flow for photo evidence
  async getPhotoUploadSignature(fileName: string, mimeType: string, user: RequestUser) {
    this.enforceInternalUser(user);

    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimes.includes(mimeType)) {
      throw new BadRequestException({
        code: 'ATTENDANCE_WRITE_FAILED',
        message: 'Định dạng tệp ảnh không được hỗ trợ. Vui lòng tải lên jpeg, png hoặc webp.',
      });
    }

    const todayStr = this.getVietnamDate();
    const [year, month] = todayStr.split('-');
    
    // Prefix path mapping
    const fileId = gen_random_uuid();
    const filePath = `attendance/${user.profileId}/${year}/${month}/${fileId}-${fileName}`;

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

    return {
      signedUrl: data.signedUrl,
      token: data.token,
      path: filePath,
    };
  }
}

// Simple UUID generator fallback
function gen_random_uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
