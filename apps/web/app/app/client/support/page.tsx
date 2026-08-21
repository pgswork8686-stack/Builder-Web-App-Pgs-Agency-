"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  MessageSquare,
  LifeBuoy,
  Plus,
  Clock,
  Phone,
  Mail,
  Send,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  fetchSupportTickets,
  fetchSupportTicketById,
  createSupportTicket,
  sendTicketMessage,
  SupportTicket,
} from "@/lib/api/support";

const CATEGORY_MAP: Record<string, string> = {
  technical: "Kỹ thuật & Bug",
  billing: "Thanh toán & Hóa đơn",
  project_scope: "Yêu cầu phát sinh dự án",
  bug_report: "Báo lỗi hệ thống",
  general: "Hỗ trợ chung",
};

const STATUS_MAP: Record<
  string,
  { label: string; variant: "warning" | "blue" | "success" | "default" }
> = {
  open: { label: "Mới tiếp nhận", variant: "warning" },
  in_progress: { label: "Đang xử lý", variant: "blue" },
  waiting_client: { label: "Chờ phản hồi", variant: "warning" },
  resolved: { label: "Đã xử lý", variant: "success" },
  closed: { label: "Đã đóng", variant: "default" },
};

export default function ClientSupportPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(
    null,
  );

  // Form submit ticket
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("general");
  const [priority, setPriority] = useState("medium");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Reply message
  const [replyContent, setReplyContent] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetchSupportTickets();
      setTickets(res.items);
    } catch (err) {
      console.error("Failed to load tickets", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    try {
      setSubmitting(true);
      const newTicket = await createSupportTicket({
        title: title.trim(),
        description: description.trim(),
        category,
        priority,
      });
      setTitle("");
      setDescription("");
      loadData();
      setSelectedTicket(newTicket);
    } catch (err: any) {
      alert(err?.message || "Không thể gửi yêu cầu hỗ trợ.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectTicket = async (id: string) => {
    try {
      const ticket = await fetchSupportTicketById(id);
      setSelectedTicket(ticket);
    } catch (err: any) {
      alert(err?.message || "Không thể tải chi tiết yêu cầu.");
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyContent.trim()) return;

    try {
      setSendingReply(true);
      await sendTicketMessage(selectedTicket.id, {
        content: replyContent.trim(),
      });
      setReplyContent("");
      handleSelectTicket(selectedTicket.id);
    } catch (err: any) {
      alert(err?.message || "Không thể gửi tin nhắn phản hồi.");
    } finally {
      setSendingReply(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Trung tâm Hỗ trợ Khách hàng (Help Desk)"
        description="Gửi yêu cầu hỗ trợ, theo dõi tiến độ giải quyết và trao đổi trực tiếp với Quản lý dự án PGS Agency."
        badge="Help Desk 24/7"
      />

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left Column: Submit Ticket or Ticket Details */}
        <div className="md:col-span-7 space-y-6">
          {selectedTicket ? (
            <Card className="p-6 space-y-4 border border-[#EAEFF4] dark:border-[#334155]">
              <div className="flex items-center justify-between pb-3 border-b border-[#EAEFF4] dark:border-[#334155]">
                <div>
                  <span className="font-mono text-xs font-bold text-[#5D87FF]">
                    {selectedTicket.ticket_code || "YC"}
                  </span>
                  <h3 className="text-base font-bold text-[#2A3547] dark:text-white mt-0.5">
                    {selectedTicket.title}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      (STATUS_MAP[selectedTicket.status]?.variant as any) ||
                      "warning"
                    }
                    size="sm"
                  >
                    {STATUS_MAP[selectedTicket.status]?.label ||
                      selectedTicket.status}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedTicket(null)}
                  >
                    Tạo yêu cầu mới
                  </Button>
                </div>
              </div>

              <div className="p-3.5 bg-[#F6F8FC] dark:bg-[#0F172A] rounded-xl text-xs text-[#2A3547] dark:text-white leading-relaxed">
                {selectedTicket.description}
              </div>

              {/* Message thread */}
              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {selectedTicket.messages?.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-3 rounded-xl text-xs ${
                      msg.sender?.role === "client"
                        ? "bg-[#ECF2FF] text-[#2A3547] ml-6 border border-[#5D87FF]/20"
                        : "bg-white dark:bg-[#1E293B] text-[#2A3547] dark:text-white mr-6 border border-[#EAEFF4] dark:border-[#334155]"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1 font-semibold text-[11px]">
                      <span>{msg.sender?.full_name || "Thành viên"}</span>
                      <span className="text-[#7C879D] font-normal">
                        {new Date(msg.created_at).toLocaleTimeString("vi-VN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="leading-relaxed whitespace-pre-wrap">
                      {msg.content}
                    </p>
                  </div>
                ))}
              </div>

              {/* Reply Form */}
              <form onSubmit={handleSendReply} className="flex gap-2 pt-2">
                <input
                  type="text"
                  placeholder="Nhập nội dung phản hồi..."
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs rounded-xl border border-[#EAEFF4] dark:border-[#334155] bg-transparent text-[#2A3547] dark:text-white"
                />
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={sendingReply}
                  leftIcon={<Send className="w-3.5 h-3.5" />}
                >
                  Gửi
                </Button>
              </form>
            </Card>
          ) : (
            <Card className="p-6 space-y-4 border border-[#EAEFF4] dark:border-[#334155]">
              <h4 className="text-sm font-bold text-[#2A3547] dark:text-white">
                Gửi yêu cầu hỗ trợ mới
              </h4>

              <form onSubmit={handleCreateTicket} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-[#7C879D] block mb-1">
                    Tiêu đề yêu cầu *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Cần chỉnh sửa thiết kế banner trang chủ..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-[#EAEFF4] dark:border-[#334155] bg-transparent text-[#2A3547] dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-[#7C879D] block mb-1">
                      Danh mục
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-[#EAEFF4] dark:border-[#334155] bg-transparent text-[#2A3547] dark:text-white"
                    >
                      {Object.entries(CATEGORY_MAP).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[#7C879D] block mb-1">
                      Mức độ ưu tiên
                    </label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-[#EAEFF4] dark:border-[#334155] bg-transparent text-[#2A3547] dark:text-white"
                    >
                      <option value="low">Thấp</option>
                      <option value="medium">Bình thường</option>
                      <option value="high">Cao</option>
                      <option value="urgent">Khẩn cấp</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#7C879D] block mb-1">
                    Mô tả chi tiết *
                  </label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Mô tả cụ thể nội dung cần hỗ trợ hoặc đính kèm link..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-[#EAEFF4] dark:border-[#334155] bg-transparent text-[#2A3547] dark:text-white"
                  />
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={submitting}
                  leftIcon={<Plus className="w-4 h-4" />}
                >
                  {submitting ? "Đang gửi..." : "Gửi yêu cầu hỗ trợ"}
                </Button>
              </form>
            </Card>
          )}
        </div>

        {/* Right Column: Ticket History & Contact Info */}
        <div className="md:col-span-5 space-y-6">
          <Card className="p-5 border border-[#EAEFF4] dark:border-[#334155]">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-[#7C879D] uppercase tracking-wider">
                Yêu cầu đã gửi của bạn
              </h4>
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<RefreshCw className="w-3 h-3" />}
                onClick={loadData}
              >
                Làm mới
              </Button>
            </div>

            {loading ? (
              <p className="text-xs text-[#7C879D]">Đang tải...</p>
            ) : tickets.length === 0 ? (
              <p className="text-xs text-[#7C879D]">
                Chưa có yêu cầu hỗ trợ nào.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-72 overflow-y-auto">
                {tickets.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => handleSelectTicket(t.id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer ${
                      selectedTicket?.id === t.id
                        ? "border-[#5D87FF] bg-[#ECF2FF]/40"
                        : "border-[#EAEFF4] dark:border-[#334155] hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B]/50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-xs font-bold text-[#5D87FF]">
                        {t.ticket_code || "YC"}
                      </span>
                      <Badge
                        variant={
                          (STATUS_MAP[t.status]?.variant as any) || "warning"
                        }
                        size="sm"
                      >
                        {STATUS_MAP[t.status]?.label || t.status}
                      </Badge>
                    </div>
                    <p className="text-xs font-semibold text-[#2A3547] dark:text-white truncate">
                      {t.title}
                    </p>
                    <p className="text-[11px] text-[#7C879D] mt-1">
                      {new Date(t.created_at).toLocaleDateString("vi-VN")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Contact Box */}
          <Card className="p-5 border border-[#EAEFF4] dark:border-[#334155] space-y-3 bg-[#F8FAFC] dark:bg-[#0F172A]">
            <h4 className="text-xs font-bold text-[#7C879D] uppercase tracking-wider">
              Kênh liên hệ khẩn cấp
            </h4>
            <div className="flex items-center gap-3 text-xs text-[#2A3547] dark:text-white">
              <Phone className="w-4 h-4 text-[#5D87FF]" />
              <span>
                Hotline CSKH: <strong>1900 8686</strong>
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-[#2A3547] dark:text-white">
              <Mail className="w-4 h-4 text-[#13DEB9]" />
              <span>
                Email: <strong>contact@pgsagency.vn</strong>
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-[#2A3547] dark:text-white">
              <Clock className="w-4 h-4 text-[#FFAE1F]" />
              <span>Giờ làm việc: 08:30 - 17:30 (Thứ 2 - Thứ 6)</span>
            </div>
            <div className="pt-2">
              <Link href="/app/chat">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  leftIcon={<MessageSquare className="w-4 h-4" />}
                >
                  Mở Tin nhắn Nội bộ
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
