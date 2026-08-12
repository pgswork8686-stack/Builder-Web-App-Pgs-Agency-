import { request } from "./client";

export interface AttendanceRecord {
  id: string;
  user_id: string;
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

export const attendanceApi = {
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
  ): Promise<{
    photoUploadSessionId: string;
    signedUrl: string;
    token: string;
    path: string;
  }> => {
    return request("/attendance/signed-upload", {
      method: "POST",
      body: JSON.stringify({ fileName, mimeType }),
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
