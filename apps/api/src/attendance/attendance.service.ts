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
  UpdateAttendanceSettingsDto,
} from './dto/attendance.dto';
import * as crypto from 'crypto';

const DEFAULT_ATTENDANCE_TIMEZONE = 'Asia/Ho_Chi_Minh';

const ATTENDANCE_SETTINGS_COLUMNS = [
  'id',
  'timezone',
  'workday_start_time',
  'workday_end_time',
  'late_grace_minutes',
  'early_leave_grace_minutes',
  'location_required',
  'photo_required',
  'location_radius_meters',
  'office_latitude',
  'office_longitude',
  'created_at',
  'updated_at',
].join(',');

export interface AttendanceSettings {
  id: string;
  timezone: string;
  workday_start_time: string | null;
  workday_end_time: string | null;
  late_grace_minutes: number | null;
  early_leave_grace_minutes: number | null;
  location_required: boolean;
  photo_required: boolean;
  location_radius_meters: number | string | null;
  office_latitude: number | string | null;
  office_longitude: number | string | null;
  created_at: string;
  updated_at: string;
}

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

  /** Read the one canonical attendance_settings row; never select arbitrary schema columns. */
  private async getSettings(): Promise<AttendanceSettings> {
    const { data, error } = await this.client
      .from('attendance_settings')
      .select(ATTENDANCE_SETTINGS_COLUMNS)
      // The database trigger protects the singleton. A limit of two makes a
      // corrupted duplicate state fail .maybeSingle() instead of choosing one.
      .limit(2)
      .maybeSingle();

    if (error) {
      this.logger.error(`Failed to read attendance settings: ${error.message}`);
      throw new InternalServerErrorException({
        code: 'ATTENDANCE_SETTINGS_LOOKUP_FAILED',
        message: 'Không thể đọc cấu hình chấm công.',
      });
    }

    if (!data) {
      throw new InternalServerErrorException({
        code: 'ATTENDANCE_SETTINGS_NOT_CONFIGURED',
        message: 'Chưa có cấu hình chấm công hợp lệ.',
      });
    }

    return data as unknown as AttendanceSettings;
  }

  // Check if user is a client (reject client access to attendance)
  private enforceInternalUser(user: RequestUser) {
    if (user.role === 'client' || !user.role) {
      throw new ForbiddenException({
        code: 'ATTENDANCE_ACCESS_DENIED',
        message: 'Khách hàng không có quyền truy cập chức năng chấm công.',
      });
    }
  }

  private enforceSettingsAdmin(user: RequestUser) {
    if (user.role !== 'admin') {
      throw new ForbiddenException({
        code: 'ATTENDANCE_SETTINGS_ACCESS_DENIED',
        message:
          'Chỉ quản trị viên mới có thể xem hoặc cập nhật cấu hình chấm công.',
      });
    }
  }

  /**
   * Enforce the client-supplied attendance evidence required by the canonical
   * policy. Keep this shared by check-in and check-out so one action cannot
   * bypass a requirement that the other enforces.
   */
  private enforceAttendanceEvidencePolicy(
    dto: Pick<CheckInDto, 'latitude' | 'longitude' | 'photoUploadSessionId'>,
    settings: Pick<AttendanceSettings, 'location_required' | 'photo_required'>,
  ) {
    const hasLocation =
      dto.latitude !== undefined &&
      dto.latitude !== null &&
      dto.longitude !== undefined &&
      dto.longitude !== null;

    if (settings.location_required && !hasLocation) {
      throw new BadRequestException({
        code: 'ATTENDANCE_LOCATION_REQUIRED',
        message: 'Tọa độ GPS là bắt buộc theo chính sách chấm công.',
      });
    }

    if (settings.photo_required && !dto.photoUploadSessionId) {
      throw new BadRequestException({
        code: 'ATTENDANCE_PHOTO_REQUIRED',
        message: 'Ảnh bằng chứng là bắt buộc theo chính sách chấm công.',
      });
    }
  }

  private getAttendanceTimezone(settings?: { timezone?: string | null }) {
    const timezone = settings?.timezone?.trim() || DEFAULT_ATTENDANCE_TIMEZONE;
    try {
      Intl.DateTimeFormat('en-US', { timeZone: timezone });
      return timezone;
    } catch {
      throw new InternalServerErrorException({
        code: 'ATTENDANCE_SETTINGS_INVALID',
        message: 'Múi giờ trong cấu hình chấm công không hợp lệ.',
      });
    }
  }

  // Get local date string for the configured attendance timezone.
  private getVietnamDate(
    date: Date = new Date(),
    timezone = DEFAULT_ATTENDANCE_TIMEZONE,
  ): string {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
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

  // Get minutes of day from date in the configured attendance timezone.
  private getVietnamMinutesOfDay(
    date: Date,
    timezone = DEFAULT_ATTENDANCE_TIMEZONE,
  ): number {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
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

    // Nullable policy values remain unconfigured rather than receiving invented defaults.
    const hasWorkdayStart = !!settings?.workday_start_time;
    const hasWorkdayEnd = !!settings?.workday_end_time;
    const timezone = this.getAttendanceTimezone(settings);

    if (checkInAt && hasWorkdayStart) {
      const checkInMinutes = this.getVietnamMinutesOfDay(checkInAt, timezone);
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
      const checkOutMinutes = this.getVietnamMinutesOfDay(checkOutAt, timezone);
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

  private calculateHaversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371e3; // meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) *
        Math.cos(phi2) *
        Math.sin(deltaLambda / 2) *
        Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  private validateGeofence(
    latitude: number | null | undefined,
    longitude: number | null | undefined,
    settings: any,
  ) {
    if (
      settings?.office_latitude !== null &&
      settings?.office_latitude !== undefined &&
      settings?.office_longitude !== null &&
      settings?.office_longitude !== undefined &&
      settings?.location_radius_meters !== null &&
      settings?.location_radius_meters !== undefined &&
      latitude !== null &&
      latitude !== undefined &&
      longitude !== null &&
      longitude !== undefined
    ) {
      const distance = this.calculateHaversineDistance(
        latitude,
        longitude,
        Number(settings.office_latitude),
        Number(settings.office_longitude),
      );
      if (distance > Number(settings.location_radius_meters)) {
        throw new BadRequestException({
          code: 'OUTSIDE_ALLOWED_LOCATION',
          message: 'Vị trí của bạn nằm ngoài bán kính cho phép chấm công.',
        });
      }
    }
  }

  private assertCoherentSettings(settings: AttendanceSettings) {
    const workdayStart = settings.workday_start_time ?? null;
    const workdayEnd = settings.workday_end_time ?? null;
    if ((workdayStart === null) !== (workdayEnd === null)) {
      throw new BadRequestException({
        code: 'ATTENDANCE_SETTINGS_INVALID',
        message:
          'Giờ bắt đầu và kết thúc phải cùng được cấu hình hoặc cùng để trống.',
      });
    }

    if (workdayStart !== null && workdayEnd !== null) {
      const startMinutes = this.getMinutesFromTime(workdayStart);
      const endMinutes = this.getMinutesFromTime(workdayEnd);
      if (
        !Number.isFinite(startMinutes) ||
        !Number.isFinite(endMinutes) ||
        endMinutes <= startMinutes
      ) {
        throw new BadRequestException({
          code: 'ATTENDANCE_SETTINGS_INVALID',
          message: 'Giờ kết thúc phải sau giờ bắt đầu.',
        });
      }
    }

    const hasLatitude =
      settings.office_latitude !== null &&
      settings.office_latitude !== undefined;
    const hasLongitude =
      settings.office_longitude !== null &&
      settings.office_longitude !== undefined;
    if (hasLatitude !== hasLongitude) {
      throw new BadRequestException({
        code: 'ATTENDANCE_SETTINGS_INVALID',
        message:
          'Vĩ độ và kinh độ văn phòng phải cùng được cấu hình hoặc cùng để trống.',
      });
    }

    const hasRadius =
      settings.location_radius_meters !== null &&
      settings.location_radius_meters !== undefined;
    if (hasLatitude !== hasRadius) {
      throw new BadRequestException({
        code: 'ATTENDANCE_SETTINGS_INVALID',
        message:
          'Vị trí văn phòng và bán kính GPS phải cùng được cấu hình hoặc cùng để trống.',
      });
    }

    if (settings.location_required && !hasLatitude) {
      throw new BadRequestException({
        code: 'ATTENDANCE_SETTINGS_INVALID',
        message:
          'Bắt buộc GPS chỉ có thể được bật khi đã cấu hình vị trí và bán kính văn phòng.',
      });
    }

    if (
      hasLatitude &&
      hasLongitude &&
      (!Number.isFinite(Number(settings.office_latitude)) ||
        !Number.isFinite(Number(settings.office_longitude)) ||
        !Number.isFinite(Number(settings.location_radius_meters)) ||
        Number(settings.location_radius_meters) <= 0)
    ) {
      throw new BadRequestException({
        code: 'ATTENDANCE_SETTINGS_INVALID',
        message: 'Tọa độ hoặc bán kính GPS không hợp lệ.',
      });
    }
  }

  private buildAttendanceSettingsUpdate(
    current: AttendanceSettings,
    dto: UpdateAttendanceSettingsDto,
  ): Record<string, unknown> {
    const finalSettings: AttendanceSettings = { ...current };

    if (dto.timezone !== undefined) finalSettings.timezone = dto.timezone;
    if (dto.workdayStartTime !== undefined)
      finalSettings.workday_start_time = dto.workdayStartTime;
    if (dto.workdayEndTime !== undefined)
      finalSettings.workday_end_time = dto.workdayEndTime;
    if (dto.lateGraceMinutes !== undefined)
      finalSettings.late_grace_minutes = dto.lateGraceMinutes;
    if (dto.earlyLeaveGraceMinutes !== undefined)
      finalSettings.early_leave_grace_minutes = dto.earlyLeaveGraceMinutes;
    if (dto.locationRequired !== undefined)
      finalSettings.location_required = dto.locationRequired;
    if (dto.photoRequired !== undefined)
      finalSettings.photo_required = dto.photoRequired;
    if (dto.locationRadiusMeters !== undefined)
      finalSettings.location_radius_meters = dto.locationRadiusMeters;
    if (dto.officeLatitude !== undefined)
      finalSettings.office_latitude = dto.officeLatitude;
    if (dto.officeLongitude !== undefined)
      finalSettings.office_longitude = dto.officeLongitude;

    this.getAttendanceTimezone(finalSettings);
    this.assertCoherentSettings(finalSettings);

    const update: Record<string, unknown> = {};
    if (dto.timezone !== undefined) update.timezone = dto.timezone;
    if (dto.workdayStartTime !== undefined)
      update.workday_start_time = dto.workdayStartTime;
    if (dto.workdayEndTime !== undefined)
      update.workday_end_time = dto.workdayEndTime;
    if (dto.lateGraceMinutes !== undefined)
      update.late_grace_minutes = dto.lateGraceMinutes;
    if (dto.earlyLeaveGraceMinutes !== undefined)
      update.early_leave_grace_minutes = dto.earlyLeaveGraceMinutes;
    if (dto.locationRequired !== undefined)
      update.location_required = dto.locationRequired;
    if (dto.photoRequired !== undefined)
      update.photo_required = dto.photoRequired;
    if (dto.locationRadiusMeters !== undefined)
      update.location_radius_meters = dto.locationRadiusMeters;
    if (dto.officeLatitude !== undefined)
      update.office_latitude = dto.officeLatitude;
    if (dto.officeLongitude !== undefined)
      update.office_longitude = dto.officeLongitude;

    return update;
  }

  async getAttendanceSettings(user: RequestUser) {
    this.enforceSettingsAdmin(user);
    return this.getSettings();
  }

  async getAttendancePolicy(user: RequestUser) {
    this.enforceInternalUser(user);
    const settings = await this.getSettings();

    return {
      timezone: this.getAttendanceTimezone(settings),
      workdayStartTime: settings.workday_start_time,
      workdayEndTime: settings.workday_end_time,
      lateGraceMinutes: settings.late_grace_minutes,
      earlyLeaveGraceMinutes: settings.early_leave_grace_minutes,
      locationRequired: settings.location_required,
      photoRequired: settings.photo_required,
    };
  }

  async updateAttendanceSettings(
    dto: UpdateAttendanceSettingsDto,
    user: RequestUser,
  ) {
    this.enforceSettingsAdmin(user);

    const current = await this.getSettings();
    const update = this.buildAttendanceSettingsUpdate(current, dto);
    const { data, error } = await this.client
      .from('attendance_settings')
      .update(update)
      .eq('id', current.id)
      .select(ATTENDANCE_SETTINGS_COLUMNS)
      .single();

    if (error || !data) {
      this.logger.error(
        `Failed to update attendance settings: ${error?.message ?? 'no row returned'}`,
      );
      throw new InternalServerErrorException({
        code: 'ATTENDANCE_SETTINGS_UPDATE_FAILED',
        message: 'Không thể cập nhật cấu hình chấm công.',
      });
    }

    return data as unknown as AttendanceSettings;
  }

  // Check In API implementation using atomic DB RPC
  async checkIn(dto: CheckInDto, user: RequestUser) {
    this.enforceInternalUser(user);
    const settings = await this.getSettings();

    this.enforceAttendanceEvidencePolicy(dto, settings);

    // Validate geofence
    this.validateGeofence(dto.latitude, dto.longitude, settings);

    // Verify photo session (validates ownership, expiry, MIME/size exact binding)
    // DB derives the photo path internally from the session — no path returned needed here
    await this.verifyPhotoUploadSession(
      dto.photoUploadSessionId,
      user.profileId,
    );

    const checkInTime = new Date();
    const todayStr = this.getVietnamDate(
      checkInTime,
      this.getAttendanceTimezone(settings),
    );

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
        p_created_by: user.authUserId || user.profileId,
        p_updated_by: user.authUserId || user.profileId,
        p_photo_session_id: dto.photoUploadSessionId ?? null,
      },
    );

    if (error) {
      this.logger.error(
        `RPC phase5_check_in_attendance error: ${error.message} - ${JSON.stringify(error)}`,
      );
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

    this.enforceAttendanceEvidencePolicy(dto, settings);

    const checkOutTime = new Date();
    const todayStr = this.getVietnamDate(
      checkOutTime,
      this.getAttendanceTimezone(settings),
    );

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
        message: 'Không thể kiểm tra thông tin check-in hiện tại.',
      });
    }

    if (!record) {
      throw new BadRequestException({
        code: 'ATTENDANCE_NOT_CHECKED_IN',
        message: 'Bạn chưa thực hiện check-in cho ngày hôm nay.',
      });
    }

    if (record.check_out_at) {
      throw new BadRequestException({
        code: 'ATTENDANCE_ALREADY_CHECKED_OUT',
        message: 'Bạn đã hoàn tất check-out cho ngày hôm nay rồi.',
      });
    }

    const checkInTime = new Date(record.check_in_at);
    if (checkOutTime < checkInTime) {
      throw new BadRequestException({
        code: 'ATTENDANCE_INVALID_TIME_RANGE',
        message: 'Thời gian check-out phải sau thời gian check-in.',
      });
    }

    // Validate geofence
    this.validateGeofence(dto.latitude, dto.longitude, settings);

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
      this.logger.error(
        `RPC phase5_check_out_attendance error: ${error.message} - ${JSON.stringify(error)}`,
      );
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

  // Admin / Team Leader / Accountant attendance lookup API
  async getDirectory(query: AttendanceQuery, user: RequestUser) {
    this.enforceInternalUser(user);

    const isAdmin = user.role === 'admin';
    const isLeader = user.role === 'team_leader';
    const isAccountant = user.role === 'accountant';

    if (!isAdmin && !isLeader && !isAccountant) {
      throw new ForbiddenException({
        code: 'ATTENDANCE_ACCESS_DENIED',
        message: 'Bạn không có quyền truy cập danh sách chấm công nhân viên.',
      });
    }

    // Resolve every team led by the user before applying the directory scope.
    // A leader can own more than one team, so maybeSingle() would incorrectly
    // deny all of their attendance records in that valid state.
    let teamIds: string[] = [];

    if (isLeader) {
      const { data: teams, error: teamError } = await this.client
        .from('teams')
        .select('id')
        .eq('leader_user_id', user.profileId);

      if (teamError) {
        this.logger.error(
          `Failed to resolve team leader scope: ${teamError.message}`,
        );
        throw new InternalServerErrorException({
          code: 'ATTENDANCE_WRITE_FAILED',
          message: 'Không thể xác định phạm vi đội nhóm của bạn.',
        });
      }

      teamIds =
        teams
          ?.map((team: { id?: unknown }) => team.id)
          .filter((id): id is string => typeof id === 'string') ?? [];
    }

    // Raise access denied if team leader queries a different teamId
    if (query.teamId && isLeader && !teamIds.includes(query.teamId)) {
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

    // Embedded PostgREST filters are left joins by default and would leave
    // unrelated attendance parent rows in the result. Both relations must be
    // inner joins so the managed-team filter constrains attendance_records.
    let dbQuery = this.client
      .from('attendance_records')
      .select(
        '*, profile:profiles!attendance_records_user_id_fkey!inner(id, full_name, email, avatar_url, employee_profile:employee_profiles!employee_profiles_user_id_fkey!inner(team_id, department_id))',
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
      dbQuery =
        teamIds.length > 0
          ? dbQuery.in('profile.employee_profile.team_id', teamIds)
          : dbQuery.eq(
              'profile.employee_profile.team_id',
              '00000000-0000-0000-0000-000000000000',
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
      this.logger.error(
        `getDirectory query failed: ${error.message} - ${JSON.stringify(error)}`,
      );
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

      // Hide precise coordinates for non-self unless admin or accountant
      if (!isAdmin && !isAccountant) {
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

    const settings = await this.getSettings();
    const todayStr = this.getVietnamDate(
      new Date(),
      this.getAttendanceTimezone(settings),
    );

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

    const settings = await this.getSettings();
    const todayStr = this.getVietnamDate(
      new Date(),
      this.getAttendanceTimezone(settings),
    );
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
