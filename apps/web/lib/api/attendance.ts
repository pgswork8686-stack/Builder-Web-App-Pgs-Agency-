import { request } from "./client";

export interface AttendanceRecord {
  id: string;
  user_id: string;
  employee?: {
    full_name?: string;
    work_email?: string;
    employee_code?: string;
  } | null;
  attendance_date: string;
  check_in_at: string | null;
  check_out_at: string | null;
  status:
    | "present"
    | "late"
    | "early_leave"
    | "late_and_early_leave"
    | "incomplete"
    | "absent"
    | "on_leave";
  late_minutes: number;
  early_leave_minutes: number;
  work_minutes: number | null;
  check_in_note: string | null;
  check_out_note: string | null;
  check_in_photo_path: string | null;
  check_out_photo_path: string | null;
}

export interface AttendanceSummary {
  today: {
    checkedIn: boolean;
    checkInAt: string | null;
    checkOutAt: string | null;
    status: string | null;
    workMinutes: number | null;
  };
  monthly: {
    presentDays: number;
    lateCount: number;
    incompleteCount: number;
    totalRecords: number;
  };
}

/** Canonical singleton returned by the admin-only attendance settings API. */
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

export interface UpdateAttendanceSettings {
  timezone?: string;
  workdayStartTime?: string | null;
  workdayEndTime?: string | null;
  lateGraceMinutes?: number | null;
  earlyLeaveGraceMinutes?: number | null;
  locationRequired?: boolean;
  photoRequired?: boolean;
  locationRadiusMeters?: number | null;
  officeLatitude?: number | null;
  officeLongitude?: number | null;
}

export interface AttendanceQuery {
  from?: string;
  to?: string;
  userId?: string;
  teamId?: string;
  departmentId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

/** Policy requirements returned by GET /attendance/policy for staff UI. */
export interface AttendancePolicy {
  timezone: string;
  workdayStartTime: string | null;
  workdayEndTime: string | null;
  lateGraceMinutes: number | null;
  earlyLeaveGraceMinutes: number | null;
  locationRequired: boolean;
  photoRequired: boolean;
}

export function getAttendanceErrorMessage(error: any): string {
  const code = error?.code || error?.data?.code;
  switch (code) {
    case "ATTENDANCE_LOCATION_REQUIRED":
      return "Tọa độ GPS là bắt buộc theo chính sách chấm công. Vui lòng bật vị trí trình duyệt.";
    case "ATTENDANCE_PHOTO_REQUIRED":
      return "Ảnh bằng chứng khuôn mặt là bắt buộc theo chính sách. Vui lòng chụp hoặc chọn ảnh.";
    case "OUTSIDE_ALLOWED_LOCATION":
      return "Vị trí của bạn nằm ngoài bán kính cho phép chấm công của văn phòng.";
    case "ATTENDANCE_ALREADY_CHECKED_IN":
      return "Bạn đã thực hiện vào ca (check-in) cho ngày hôm nay rồi.";
    case "ATTENDANCE_NOT_CHECKED_IN":
      return "Bạn chưa thực hiện vào ca cho ngày hôm nay.";
    case "ATTENDANCE_ALREADY_CHECKED_OUT":
      return "Bạn đã hoàn tất tan ca (check-out) cho ngày hôm nay rồi.";
    case "ATTENDANCE_INVALID_TIME_RANGE":
      return "Thời gian tan ca phải sau thời gian vào ca.";
    case "ATTENDANCE_PHOTO_SESSION_INVALID":
      return "Phiên chụp ảnh không hợp lệ. Vui lòng chọn lại ảnh.";
    case "ATTENDANCE_PHOTO_SESSION_EXPIRED":
      return "Phiên chụp ảnh đã hết hạn (quá 15 phút). Vui lòng chụp lại ảnh mới.";
    case "ATTENDANCE_PHOTO_SESSION_REUSED":
      return "Phiên ảnh đã được sử dụng trước đó. Vui lòng chọn ảnh mới.";
    case "ATTENDANCE_PHOTO_NOT_FOUND":
      return "Không tìm thấy tệp ảnh tải lên trong bộ nhớ. Vui lòng thử lại.";
    case "ATTENDANCE_PHOTO_TOO_LARGE":
      return "Ảnh tải lên vượt quá dung lượng cho phép (tối đa 5 MB).";
    case "ATTENDANCE_PHOTO_INVALID_MIME":
      return "Định dạng ảnh không hợp lệ (hệ thống chỉ chấp nhận JPEG, PNG, WEBP).";
    case "ATTENDANCE_SETTINGS_NOT_CONFIGURED":
      return "Hệ thống chưa có cấu hình chấm công hợp lệ từ quản trị viên.";
    case "ATTENDANCE_SETTINGS_INVALID":
      return "Cấu hình chấm công hệ thống không hợp lệ.";
    case "ATTENDANCE_WRITE_FAILED":
      return "Không thể ghi nhận dữ liệu chấm công. Vui lòng thử lại sau giây lát.";
    default:
      return error?.message || "Thao tác chấm công thất bại. Vui lòng thử lại.";
  }
}

export const attendanceApi = {
  getPolicy: (): Promise<AttendancePolicy> => {
    return request("/attendance/policy");
  },

  getSettings: (): Promise<AttendanceSettings> => {
    return request("/attendance/settings");
  },

  updateSettings: (
    payload: UpdateAttendanceSettings,
  ): Promise<AttendanceSettings> => {
    return request("/attendance/settings", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  getSummary: (): Promise<AttendanceSummary> => {
    return request("/attendance/summary");
  },

  getMyHistory: (
    query: AttendanceQuery = {},
  ): Promise<{
    items: AttendanceRecord[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> => {
    const params = new URLSearchParams();
    if (query.from) params.append("from", query.from);
    if (query.to) params.append("to", query.to);
    if (query.status) params.append("status", query.status);
    if (query.page) params.append("page", query.page.toString());
    if (query.pageSize) params.append("pageSize", query.pageSize.toString());

    return request(`/attendance/me?${params.toString()}`);
  },

  checkIn: (payload: {
    latitude?: number | null;
    longitude?: number | null;
    accuracyMeters?: number | null;
    photoUploadSessionId?: string | null;
    note?: string | null;
  }): Promise<AttendanceRecord> => {
    return request("/attendance/check-in", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  checkOut: (payload: {
    latitude?: number | null;
    longitude?: number | null;
    accuracyMeters?: number | null;
    photoUploadSessionId?: string | null;
    note?: string | null;
  }): Promise<AttendanceRecord> => {
    return request("/attendance/check-out", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  getPhotoUploadSignature: (
    fileName: string,
    mimeType: string,
    fileSize: number,
  ): Promise<{
    photoUploadSessionId: string;
    signedUrl: string;
    token: string;
    path: string;
  }> => {
    return request("/attendance/signed-upload", {
      method: "POST",
      body: JSON.stringify({ fileName, mimeType, fileSize }),
    });
  },

  getDirectory: (
    query: AttendanceQuery = {},
  ): Promise<{
    items: (AttendanceRecord & { employee?: any })[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> => {
    const params = new URLSearchParams();
    if (query.from) params.append("from", query.from);
    if (query.to) params.append("to", query.to);
    if (query.userId) params.append("userId", query.userId);
    if (query.teamId) params.append("teamId", query.teamId);
    if (query.departmentId) params.append("departmentId", query.departmentId);
    if (query.status) params.append("status", query.status);
    if (query.page) params.append("page", query.page.toString());
    if (query.pageSize) params.append("pageSize", query.pageSize.toString());

    return request(`/attendance/directory?${params.toString()}`);
  },

  adjustRecord: (
    recordId: string,
    payload: {
      checkInAt?: string | null;
      checkOutAt?: string | null;
      status?: string;
      reason: string;
    },
  ): Promise<any> => {
    return request(`/attendance/records/${recordId}/adjust`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};
