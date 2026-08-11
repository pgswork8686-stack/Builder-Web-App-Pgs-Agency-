"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  AlertTriangle,
  ShieldCheck,
  Briefcase,
  Plus,
  Trash2,
  Key,
  Star,
} from "lucide-react";
import { clientsApi } from "../../../../../lib/api/clients";
import { peopleApi } from "../../../../../lib/api/people";

interface ClientCompany {
  id: string;
  code: string;
  name: string;
  taxCode: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  status: "active" | "inactive";
  notes: string | null;
}

interface Membership {
  id: string;
  userId: string;
  email: string | null;
  fullName: string | null;
  accountStatus: string;
  title: string | null;
  isPrimary: boolean;
}

interface ClientUser {
  id: string;
  fullName: string | null;
  email: string | null;
}

export default function AdminClientDetailPage() {
  const params = useParams();
  const clientId = params.clientId as string;

  const [company, setCompany] = useState<ClientCompany | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [clientUsers, setClientUsers] = useState<ClientUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [userId, setUserId] = useState("");
  const [title, setTitle] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const compData = await clientsApi.getClientCompanyById(clientId);
      setCompany(compData);

      const membersData = await clientsApi.getMemberships(clientId);
      setMemberships(membersData);

      // Load all client users to link (role=client, active)
      const peopleData = await peopleApi.getPeopleDirectory({
        role: "client",
        pageSize: 100,
      });
      setClientUsers(
        (peopleData.items || [])
          .filter((item: any) => item.accountStatus === "active")
          .map((item: any) => ({
            id: item.id,
            fullName: item.fullName,
            email: item.email,
          })),
      );
    } catch (err: any) {
      setError(err.message || "Không thể tải chi tiết khách hàng");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, [clientId]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!userId) {
      setFormError("Vui lòng chọn tài khoản liên kết");
      return;
    }

    try {
      setSubmitting(true);
      await clientsApi.createMembership(clientId, {
        userId,
        title: title.trim() || null,
        isPrimary,
      });
      await loadData();
      setShowAddForm(false);
      setUserId("");
      setTitle("");
      setIsPrimary(false);
    } catch (err: any) {
      setFormError(err.message || "Liên kết tài khoản thất bại");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetPrimary = async (mem: Membership) => {
    try {
      await clientsApi.updateMembership(clientId, mem.id, {
        isPrimary: true,
      });
      await loadData();
    } catch (err: any) {
      alert(err.message || "Cập nhật tài khoản chính thất bại");
    }
  };

  const handleDeleteMember = async (membershipId: string) => {
    if (
      !confirm(
        "Bạn có chắc chắn muốn gỡ bỏ tài khoản này khỏi doanh nghiệp khách hàng?",
      )
    ) {
      return;
    }

    try {
      await clientsApi.deleteMembership(clientId, membershipId);
      setMemberships((prev) => prev.filter((m) => m.id !== membershipId));
    } catch (err: any) {
      alert(err.message || "Gỡ bỏ liên kết thất bại");
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] text-[#E2E8F0] p-6 lg:p-12">
      {/* Header */}
      <div className="max-w-5xl mx-auto mb-8">
        <Link
          href="/app/admin/clients"
          className="inline-flex items-center gap-1 text-slate-400 hover:text-cyan-400 text-sm mb-3 transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Doanh nghiệp khách hàng
        </Link>
        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
          Quản Lý Liên Kết Khách Hàng
        </h1>
      </div>

      {loading ? (
        <div className="max-w-5xl mx-auto flex flex-col items-center justify-center py-20 bg-slate-900/30 rounded-2xl border border-slate-800">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mb-4" />
          <span className="text-slate-400 text-sm">
            Đang tải dữ liệu doanh nghiệp...
          </span>
        </div>
      ) : error || !company ? (
        <div className="max-w-5xl mx-auto p-6 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 shrink-0" />
          <div>
            <h4 className="font-bold">Lỗi tải dữ liệu</h4>
            <p className="text-sm mt-1">
              {error || "Không tìm thấy thông tin doanh nghiệp"}
            </p>
            <button
              onClick={loadData}
              className="mt-3 px-4 py-2 bg-red-500 text-black font-semibold rounded-xl text-xs"
            >
              Thử lại
            </button>
          </div>
        </div>
      ) : (
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Company Profile Detail */}
          <div className="space-y-6">
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
              <div className="w-12 h-12 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400 mb-4">
                <Briefcase className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">
                {company.name}
              </h3>
              <div className="inline-flex px-2 py-0.5 rounded bg-slate-800 text-orange-400 text-xs font-semibold uppercase tracking-wider mb-6">
                Mã: {company.code}
              </div>

              <div className="space-y-4 text-sm border-t border-slate-850 pt-4">
                <div>
                  <span className="block text-slate-500 text-xs font-semibold uppercase tracking-wider">
                    Mã số thuế
                  </span>
                  <span className="text-slate-200">
                    {company.taxCode || "—"}
                  </span>
                </div>
                <div>
                  <span className="block text-slate-500 text-xs font-semibold uppercase tracking-wider">
                    Điện thoại
                  </span>
                  <span className="text-slate-200">{company.phone || "—"}</span>
                </div>
                <div>
                  <span className="block text-slate-500 text-xs font-semibold uppercase tracking-wider">
                    Email nhận tin
                  </span>
                  <span className="text-slate-200">{company.email || "—"}</span>
                </div>
                <div>
                  <span className="block text-slate-500 text-xs font-semibold uppercase tracking-wider">
                    Website
                  </span>
                  {company.website ? (
                    <a
                      href={company.website}
                      target="_blank"
                      rel="noreferrer"
                      className="text-cyan-400 hover:underline"
                    >
                      {company.website}
                    </a>
                  ) : (
                    <span className="text-slate-200">—</span>
                  )}
                </div>
                <div>
                  <span className="block text-slate-500 text-xs font-semibold uppercase tracking-wider">
                    Địa chỉ trụ sở
                  </span>
                  <span className="text-slate-200">
                    {company.address || "—"}
                  </span>
                </div>
                <div>
                  <span className="block text-slate-500 text-xs font-semibold uppercase tracking-wider">
                    Ghi chú
                  </span>
                  <span className="text-slate-400 text-xs">
                    {company.notes || "—"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Portal Accounts Membership Association */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Key className="w-5 h-5 text-cyan-400" />
                  Tài Khoản Portal Liên Kết ({memberships.length})
                </h2>
                <button
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-cyan-500 hover:bg-cyan-600 text-black font-semibold rounded-xl transition duration-300 text-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Liên kết tài khoản
                </button>
              </div>

              {/* Inline Add Membership Form */}
              {showAddForm && (
                <form
                  onSubmit={handleAddMember}
                  className="bg-[#121826] border border-slate-800 p-4 rounded-xl mb-6 space-y-4"
                >
                  <h3 className="text-sm font-bold text-white">
                    Liên kết tài khoản mới
                  </h3>
                  {formError && (
                    <div className="p-2 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      <span>{formError}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
                        Chọn tài khoản khách hàng
                      </label>
                      <select
                        value={userId}
                        onChange={(e) => setUserId(e.target.value)}
                        className="w-full bg-[#1A2338] border border-slate-750 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 transition duration-300"
                      >
                        <option value="">-- Chọn tài khoản client --</option>
                        {clientUsers.map((cu) => (
                          <option key={cu.id} value={cu.id}>
                            {cu.fullName || "Không tên"} ({cu.email})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
                        Chức danh / Vai trò đại diện
                      </label>
                      <input
                        type="text"
                        placeholder="Ví dụ: Đại diện pháp luật, Kỹ sư IT"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full bg-[#1A2338] border border-slate-750 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-650 focus:outline-none focus:border-cyan-500 transition duration-300"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="is_primary_company"
                      checked={isPrimary}
                      onChange={(e) => setIsPrimary(e.target.checked)}
                      className="w-4 h-4 accent-cyan-500"
                    />
                    <label
                      htmlFor="is_primary_company"
                      className="text-sm text-slate-300 cursor-pointer"
                    >
                      Đây là công ty chính liên kết với tài khoản này
                    </label>
                  </div>

                  <div className="flex gap-2 justify-end">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 text-black font-semibold rounded-lg text-xs flex items-center gap-1.5"
                    >
                      {submitting && (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      )}
                      Thêm liên kết
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-lg text-xs"
                    >
                      Huỷ
                    </button>
                  </div>
                </form>
              )}

              {/* Memberships list */}
              {memberships.length === 0 ? (
                <div className="text-center py-10 bg-slate-950/20 border border-dashed border-slate-850 rounded-xl">
                  <Star className="w-8 h-8 text-slate-650 mx-auto mb-2" />
                  <p className="text-slate-500 text-xs">
                    Chưa có tài khoản khách hàng nào được liên kết.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {memberships.map((mem) => (
                    <div
                      key={mem.id}
                      className="flex items-center justify-between p-4 bg-[#121826]/40 border border-slate-850 rounded-xl hover:border-slate-700/60 transition duration-150"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">
                            {mem.fullName || "Chưa cập nhật tên"}
                          </span>
                          {mem.isPrimary && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-[10px] font-bold uppercase rounded-full">
                              <Star className="w-3 h-3 fill-yellow-400" />
                              Chính
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500">
                          {mem.email}
                        </div>
                        {mem.title && (
                          <div className="text-xs text-slate-400 italic">
                            Vị trí: {mem.title}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {!mem.isPrimary && (
                          <button
                            onClick={() => handleSetPrimary(mem)}
                            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition"
                          >
                            Đặt làm chính
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteMember(mem.id)}
                          className="p-2 hover:bg-red-500/10 rounded-lg text-slate-500 hover:text-red-400 transition"
                          title="Gỡ liên kết"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
