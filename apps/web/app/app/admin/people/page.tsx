"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  UserSquare2,
  ArrowLeft,
  Loader2,
  AlertTriangle,
  Eye,
  UserPlus,
  Building,
  Users,
} from "lucide-react";
import { peopleApi } from "../../../../lib/api/people";
import { organizationApi } from "../../../../lib/api/organization";

interface Department {
  id: string;
  name: string;
}

interface Team {
  id: string;
  name: string;
}

interface Person {
  id: string;
  email: string | null;
  fullName: string | null;
  role: string;
  accountStatus: string;
  employeeProfile: {
    employeeCode: string;
    departmentName: string | null;
    teamName: string | null;
    jobTitle: string | null;
    employmentStatus: string;
  } | null;
}

export default function AdminPeopleDirectoryPage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [employmentStatus, setEmploymentStatus] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchDirectory = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await peopleApi.getPeopleDirectory({
        q: q || undefined,
        role: role || undefined,
        departmentId: departmentId || undefined,
        teamId: teamId || undefined,
        employmentStatus: employmentStatus || undefined,
        page,
        pageSize: 15,
      });

      setPeople(data.items);
      setTotalPages(data.totalPages);
      setTotal(data.total);

      // Load depts & teams for filters
      const deptsData = await organizationApi.getDepartments();
      setDepartments(deptsData.filter((d: any) => d.is_active));

      const teamsData = await organizationApi.getTeams();
      setTeams(teamsData.filter((t: any) => t.is_active));
    } catch (err: any) {
      setError(err.message || "Không thể tải danh bạ nhân sự");
    } finally {
      setLoading(false);
    }
  }, [q, role, departmentId, teamId, employmentStatus, page]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchDirectory();
  }, [fetchDirectory]);

  return (
    <div className="min-h-screen bg-[#0B0F19] text-[#E2E8F0] p-6 lg:p-12">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-10">
        <Link
          href="/app/admin/organization"
          className="inline-flex items-center gap-1 text-slate-400 hover:text-cyan-400 text-sm mb-3 transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Cơ cấu tổ chức
        </Link>
        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent flex items-center gap-3">
          <UserSquare2 className="w-8 h-8 text-cyan-400" />
          Danh Bạ Nhân Sự ({total})
        </h1>
      </div>

      {/* Filters Bar */}
      <div className="max-w-7xl mx-auto bg-slate-900/30 border border-slate-800 rounded-2xl p-6 mb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div>
          <label className="block text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
            Tìm kiếm
          </label>
          <input
            type="text"
            placeholder="Họ tên, email, mã..."
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            className="w-full bg-[#161D30] border border-slate-700/60 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition duration-300"
          />
        </div>

        <div>
          <label className="block text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
            Vai trò hệ thống
          </label>
          <select
            value={role}
            onChange={(e) => {
              setRole(e.target.value);
              setPage(1);
            }}
            className="w-full bg-[#161D30] border border-slate-700/60 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 transition duration-300"
          >
            <option value="">Tất cả vai trò</option>
            <option value="admin">Quản trị viên (admin)</option>
            <option value="team_leader">Trưởng nhóm (team_leader)</option>
            <option value="employee">Nhân viên (employee)</option>
            <option value="accountant">Kế toán (accountant)</option>
            <option value="client">Khách hàng (client)</option>
          </select>
        </div>

        <div>
          <label className="block text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
            Phòng ban
          </label>
          <select
            value={departmentId}
            onChange={(e) => {
              setDepartmentId(e.target.value);
              setPage(1);
            }}
            className="w-full bg-[#161D30] border border-slate-700/60 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 transition duration-300"
          >
            <option value="">Tất cả phòng ban</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
            Đội nhóm
          </label>
          <select
            value={teamId}
            onChange={(e) => {
              setTeamId(e.target.value);
              setPage(1);
            }}
            className="w-full bg-[#161D30] border border-slate-700/60 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 transition duration-300"
          >
            <option value="">Tất cả đội nhóm</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
            Trạng thái nhân sự
          </label>
          <select
            value={employmentStatus}
            onChange={(e) => {
              setEmploymentStatus(e.target.value);
              setPage(1);
            }}
            className="w-full bg-[#161D30] border border-slate-700/60 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 transition duration-300"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="probation">Thử việc (probation)</option>
            <option value="active">Chính thức (active)</option>
            <option value="on_leave">Nghỉ phép (on_leave)</option>
            <option value="terminated">Đã nghỉ việc (terminated)</option>
          </select>
        </div>
      </div>

      {/* Directory Table */}
      <div className="max-w-7xl mx-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-slate-900/30 rounded-2xl border border-slate-800">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mb-4" />
            <span className="text-slate-400 text-sm">
              Đang tải danh bạ nhân sự...
            </span>
          </div>
        ) : error ? (
          <div className="p-6 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 shrink-0" />
            <div>
              <h4 className="font-bold">Lỗi tải dữ liệu</h4>
              <p className="text-sm mt-1">{error}</p>
              <button
                onClick={fetchDirectory}
                className="mt-3 px-4 py-2 bg-red-500 text-black font-semibold rounded-xl text-xs"
              >
                Thử lại
              </button>
            </div>
          </div>
        ) : people.length === 0 ? (
          <div className="text-center py-20 bg-slate-900/20 border border-dashed border-slate-850 rounded-2xl">
            <UserSquare2 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-300">
              Không tìm thấy nhân sự phù hợp
            </h3>
            <p className="text-slate-500 text-sm mt-1 max-w-md mx-auto">
              Hãy thử làm sạch bộ lọc hoặc thay đổi từ khoá tìm kiếm.
            </p>
          </div>
        ) : (
          <>
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden mb-6">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/20 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                      <th className="py-4 px-6">Mã nhân sự</th>
                      <th className="py-4 px-6">Họ tên / Email</th>
                      <th className="py-4 px-6">Vai trò hệ thống</th>
                      <th className="py-4 px-6">Vị trí phòng ban / Đội nhóm</th>
                      <th className="py-4 px-6">Chức danh</th>
                      <th className="py-4 px-6">Trạng thái nhân sự</th>
                      <th className="py-4 px-6 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850 text-sm">
                    {people.map((person) => (
                      <tr
                        key={person.id}
                        className="hover:bg-slate-850/20 transition duration-150"
                      >
                        <td className="py-4 px-6 font-bold text-slate-300">
                          {person.employeeProfile?.employeeCode || (
                            <span className="text-slate-600 italic">
                              Chưa tạo hồ sơ
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6">
                          <div className="font-semibold text-white">
                            {person.fullName || "Chưa cập nhật tên"}
                          </div>
                          <div className="text-slate-500 text-xs">
                            {person.email}
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span className="inline-flex px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-xs font-semibold uppercase tracking-wide">
                            {person.role}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          {person.employeeProfile ? (
                            <div className="space-y-1">
                              <span className="flex items-center gap-1 text-slate-300 text-xs">
                                <Building className="w-3.5 h-3.5 text-slate-500" />
                                {person.employeeProfile.departmentName || "—"}
                              </span>
                              <span className="flex items-center gap-1 text-slate-400 text-xs">
                                <Users className="w-3.5 h-3.5 text-slate-550" />
                                {person.employeeProfile.teamName || "—"}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-slate-300">
                          {person.employeeProfile?.jobTitle || "—"}
                        </td>
                        <td className="py-4 px-6">
                          {person.employeeProfile ? (
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                                person.employeeProfile.employmentStatus ===
                                "active"
                                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                  : person.employeeProfile.employmentStatus ===
                                      "probation"
                                    ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                                    : person.employeeProfile
                                          .employmentStatus === "on_leave"
                                      ? "bg-blue-500/10 border-blue-500/20 text-blue-400"
                                      : "bg-red-500/10 border-red-500/20 text-red-400"
                              }`}
                            >
                              {person.employeeProfile.employmentStatus ===
                              "active"
                                ? "Chính thức"
                                : person.employeeProfile.employmentStatus ===
                                    "probation"
                                  ? "Thử việc"
                                  : person.employeeProfile.employmentStatus ===
                                      "on_leave"
                                    ? "Nghỉ phép"
                                    : "Đã nghỉ việc"}
                            </span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-right">
                          <Link
                            href={`/app/admin/people/${person.id}`}
                            className="inline-flex p-2 hover:bg-slate-800 rounded-xl transition duration-150 text-slate-400 hover:text-cyan-400"
                            title="Chi tiết hồ sơ"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-between items-center bg-slate-900/10 border border-slate-850 p-4 rounded-xl">
                <span className="text-xs text-slate-500">
                  Hiển thị trang {page} / {totalPages} (Tổng {total} bản ghi)
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 disabled:opacity-40 text-slate-300 text-xs rounded-lg transition"
                  >
                    Trước
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 disabled:opacity-40 text-slate-300 text-xs rounded-lg transition"
                  >
                    Sau
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
