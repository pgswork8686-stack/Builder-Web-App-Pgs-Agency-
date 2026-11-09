const L: Record<string, string> = {
  pending: "Chờ duyệt", approved: "Đã duyệt", rejected: "Từ chối", cancelled: "Đã hủy", canceled: "Đã hủy",
  active: "Đang hoạt động", suspended: "Tạm khóa", inactive: "Ngừng hoạt động", draft: "Nháp", sent: "Đã gửi",
  paid: "Đã thanh toán", partial: "Thanh toán một phần", partially_paid: "Thanh toán một phần", unpaid: "Chưa thanh toán",
  overdue: "Quá hạn", completed: "Hoàn thành", done: "Hoàn thành", on_hold: "Tạm dừng", pending_approval: "Chờ duyệt",
  signed: "Đã ký", expired: "Hết hạn", terminated: "Đã chấm dứt", void: "Đã hủy", voided: "Đã hủy",
  present: "Có mặt", late: "Đi muộn", absent: "Vắng mặt", leave: "Nghỉ phép", early_leave: "Về sớm", checked_in: "Đã vào ca",
  checked_out: "Đã tan ca", on_time: "Đúng giờ", missing: "Thiếu công", manual: "Thủ công", holiday: "Ngày lễ",
  admin: "Quản trị viên", team_leader: "Trưởng nhóm", employee: "Nhân viên", accountant: "Kế toán", client: "Khách hàng",
  todo: "Cần làm", in_progress: "Đang làm", review: "Chờ nghiệm thu", planning: "Lập kế hoạch",
  invoice: "Hóa đơn", contract: "Hợp đồng", payment: "Thanh toán", expense: "Chi phí", payroll: "Bảng lương", project: "Dự án",
};
/** Nhãn tiếng Việt cho mã trạng thái/vai trò; mã lạ giữ nguyên dạng dễ đọc. */
export function statusLabel(v?: string | null): string {
  if (!v) return "—";
  const k = v.toLowerCase();
  return L[k] ?? v.replace(/_/g, " ");
}
