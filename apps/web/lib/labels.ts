const L: Record<string, string> = {
  pending: "Chờ duyệt", approved: "Đã duyệt", rejected: "Từ chối", cancelled: "Đã hủy", canceled: "Đã hủy",
  active: "Đang hoạt động", suspended: "Tạm khóa", inactive: "Ngừng hoạt động", draft: "Nháp", sent: "Đã gửi",
  paid: "Đã thanh toán", partial: "Thanh toán một phần", partially_paid: "Thanh toán một phần", unpaid: "Chưa thanh toán",
  overdue: "Quá hạn", completed: "Hoàn thành", done: "Hoàn thành", on_hold: "Tạm dừng", pending_approval: "Chờ duyệt",
  signed: "Đã ký", expired: "Hết hạn", terminated: "Đã chấm dứt", void: "Đã hủy", voided: "Đã hủy",
  present: "Có mặt", late: "Đi muộn", absent: "Vắng mặt", leave: "Nghỉ phép", early_leave: "Về sớm", checked_in: "Đã vào ca",
  checked_out: "Đã tan ca", on_time: "Đúng giờ", missing: "Thiếu công", manual: "Thủ công", holiday: "Ngày lễ",
  admin: "Quản trị viên", team_leader: "Trưởng nhóm", employee: "Nhân viên", accountant: "Kế toán", client: "Khách hàng",
  low: "Thấp", medium: "Trung bình", high: "Cao", urgent: "Khẩn cấp", normal: "Bình thường", archived: "Đã lưu trữ",
  todo: "Cần làm", in_progress: "Đang làm", review: "Chờ nghiệm thu", planning: "Lập kế hoạch",
  invoice: "Hóa đơn", contract: "Hợp đồng", payment: "Thanh toán", expense: "Chi phí", payroll: "Bảng lương", project: "Dự án",
};
/** Nhãn tiếng Việt cho mã trạng thái/vai trò; mã lạ giữ nguyên dạng dễ đọc. */
export function statusLabel(v?: string | null): string {
  if (!v) return "—";
  const k = v.toLowerCase();
  return L[k] ?? v.replace(/_/g, " ");
}

/** Lỗi kỹ thuật (tiếng Anh từ trình duyệt/API) → câu tiếng Việt người dùng hiểu được. */
export function viError(err: unknown, fallback = "Đã xảy ra lỗi. Vui lòng thử lại."): string {
  const msg = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  if (!msg) return fallback;
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(msg))
    return "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.";
  if (/invalid or expired|jwt|token|unauthori[sz]ed|missing or invalid authorization/i.test(msg))
    return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
  if (/forbidden|access denied/i.test(msg)) return "Bạn không có quyền thực hiện thao tác này.";
  if (/internal server error/i.test(msg)) return "Máy chủ đang gặp sự cố. Vui lòng thử lại sau.";
  return msg;
}
