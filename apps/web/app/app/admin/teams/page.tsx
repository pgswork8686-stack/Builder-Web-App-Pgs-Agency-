"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Users2,
  Plus,
  ArrowLeft,
  Loader2,
  Edit3,
  AlertTriangle,
  Filter,
} from "lucide-react";
import { organizationApi } from "../../../../lib/api/organization";
import { peopleApi } from "../../../../lib/api/people";

interface Department {
  id: string;
  code: string;
  name: string;
}

interface Leader {
  id: string;
  fullName: string | null;
  email: string | null;
}

interface Team {
  id: string;
  department_id: string;
  code: string;
  name: string;
  leader_user_id: string | null;
  description: string | null;
  is_active: boolean;
  department?: {
    name: string;
  };
}

export default function AdminTeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterDept, setFilterDept] = useState("");
  const [filterActive, setFilterActive] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [departmentId, setDepartmentId] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [leaderUserId, setLeaderUserId] = useState("");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Edit states
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch teams with filters
      const filterActiveVal =
        filterActive === "true"
          ? true
          : filterActive === "false"
            ? false
            : undefined;
      const teamsData = await organizationApi.getTeams({
        departmentId: filterDept || undefined,
        isActive: filterActiveVal,
        q: searchQuery || undefined,
      });
      setTeams(teamsData);

      // Fetch departments for dropdown
      const deptsData = await organizationApi.getDepartments();
      setDepartments(deptsData.filter((d: any) => d.is_active));

      // Fetch leaders for dropdown (role=team_leader)
      const leadersData = await peopleApi.getPeopleDirectory({
        role: "team_leader",
        pageSize: 100,
      });
      setLeaders(
        (leadersData.items || [])
          .filter((item: any) => item.accountStatus === "active")
          .map((item: any) => ({
            id: item.id,
            fullName: item.fullName,
            email: item.email,
          })),
      );
    } catch (err: any) {
      setError(err.message || "Không thể tải dữ liệu đội nhóm");
    } finally {
      setLoading(false);
    }
  }, [filterDept, filterActive, searchQuery]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!departmentId) {
      setFormError("Vui lòng chọn phòng ban trực thuộc");
      return;
    }
    if (code.trim().length < 2 || code.trim().length > 30) {
      setFormError("Mã đội nhóm phải từ 2 đến 30 ký tự");
      return;
    }
    if (name.trim().length < 2 || name.trim().length > 120) {
      setFormError("Tên đội nhóm phải từ 2 đến 120 ký tự");
      return;
    }

    try {
      setSubmitting(true);
      const newTeam = await organizationApi.createTeam({
        departmentId,
        code: code.trim().toUpperCase(),
        name: name.trim(),
        leaderUserId: leaderUserId || null,
        description: description.trim() || undefined,
      });

      // Reload list to get joined dept name properly
      await fetchData();

      setShowAddForm(false);
      setDepartmentId("");
      setCode("");
      setName("");
      setLeaderUserId("");
      setDescription("");
    } catch (err: any) {
      setFormError(err.message || "Tạo đội nhóm thất bại");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeam) return;
    setFormError(null);

    if (
      editingTeam.name.trim().length < 2 ||
      editingTeam.name.trim().length > 120
    ) {
      setFormError("Tên đội nhóm phải từ 2 đến 120 ký tự");
      return;
    }

    try {
      setSubmitting(true);
      await organizationApi.updateTeam(editingTeam.id, {
        name: editingTeam.name.trim(),
        leaderUserId: editingTeam.leader_user_id || null,
        description: editingTeam.description?.trim() || null,
        isActive: editingTeam.is_active,
      });
      await fetchData();
      setEditingTeam(null);
    } catch (err: any) {
      setFormError(err.message || "Cập nhật đội nhóm thất bại");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] text-[#E2E8F0] p-6 lg:p-12">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <Link
            href="/app/admin/organization"
            className="inline-flex items-center gap-1 text-slate-400 hover:text-cyan-400 text-sm mb-3 transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Cơ cấu tổ chức
          </Link>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent flex items-center gap-3">
            <Users2 className="w-8 h-8 text-cyan-400" />
            Quản Lý Đội Nhóm
          </h1>
        </div>

        <button
          onClick={() => {
            setEditingTeam(null);
            setShowAddForm(!showAddForm);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-black font-semibold rounded-xl transition duration-300 text-sm"
        >
          <Plus className="w-4 h-4" />
          Thêm đội nhóm mới
        </button>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Side: Filter and Listing */}
        <div
          className={
            showAddForm || editingTeam ? "lg:col-span-2" : "lg:col-span-3"
          }
        >
          {/* Filters Bar */}
          <div className="bg-slate-900/30 border border-slate-800 rounded-2xl p-4 mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
                Tìm kiếm
              </label>
              <input
                type="text"
                placeholder="Nhập tên hoặc mã đội..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#161D30] border border-slate-700/60 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition duration-300"
              />
            </div>

            <div>
              <label className="block text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
                Phòng ban
              </label>
              <select
                value={filterDept}
                onChange={(e) => setFilterDept(e.target.value)}
                className="w-full bg-[#161D30] border border-slate-700/60 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 transition duration-300"
              >
                <option value="">Tất cả phòng ban</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    [{d.code}] {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
                Trạng thái
              </label>
              <select
                value={filterActive}
                onChange={(e) => setFilterActive(e.target.value)}
                className="w-full bg-[#161D30] border border-slate-700/60 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 transition duration-300"
              >
                <option value="">Tất cả trạng thái</option>
                <option value="true">Hoạt động</option>
                <option value="false">Tắt</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 bg-slate-900/30 rounded-2xl border border-slate-800">
              <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mb-4" />
              <span className="text-slate-400 text-sm">
                Đang tải danh sách đội nhóm...
              </span>
            </div>
          ) : error ? (
            <div className="p-6 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <div>
                <h4 className="font-bold">Lỗi tải dữ liệu</h4>
                <p className="text-sm mt-1">{error}</p>
                <button
                  onClick={fetchData}
                  className="mt-3 px-4 py-2 bg-red-500 text-black font-semibold rounded-xl text-xs"
                >
                  Thử lại
                </button>
              </div>
            </div>
          ) : teams.length === 0 ? (
            <div className="text-center py-20 bg-slate-900/20 border border-dashed border-slate-850 rounded-2xl">
              <Users2 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-300">
                Chưa có đội nhóm nào
              </h3>
              <p className="text-slate-500 text-sm mt-1 max-w-md mx-auto">
                Bắt đầu phân bổ nhân viên bằng cách cấu hình đội nhóm đầu tiên.
              </p>
            </div>
          ) : (
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/20 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                      <th className="py-4 px-6">Mã</th>
                      <th className="py-4 px-6">Tên đội nhóm</th>
                      <th className="py-4 px-6">Phòng ban</th>
                      <th className="py-4 px-6">Trưởng nhóm</th>
                      <th className="py-4 px-6">Trạng thái</th>
                      <th className="py-4 px-6 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850 text-sm">
                    {teams.map((team) => {
                      const leader = leaders.find(
                        (l) => l.id === team.leader_user_id,
                      );
                      return (
                        <tr
                          key={team.id}
                          className="hover:bg-slate-850/20 transition duration-150"
                        >
                          <td className="py-4 px-6 font-bold text-pink-400">
                            {team.code}
                          </td>
                          <td className="py-4 px-6 font-semibold text-white">
                            {team.name}
                          </td>
                          <td className="py-4 px-6 text-slate-400">
                            {team.department?.name || "—"}
                          </td>
                          <td className="py-4 px-6">
                            {leader ? (
                              <div>
                                <span className="font-semibold text-white">
                                  {leader.fullName}
                                </span>
                                <span className="block text-slate-500 text-xs">
                                  {leader.email}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-500 italic">
                                Chưa phân công
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-6">
                            <span
                              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                                team.is_active
                                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                  : "bg-slate-800 border-slate-700 text-slate-400"
                              }`}
                            >
                              {team.is_active ? "Hoạt động" : "Tắt"}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-right">
                            <button
                              onClick={() => {
                                setShowAddForm(false);
                                setEditingTeam(team);
                              }}
                              className="p-2 hover:bg-slate-800 rounded-xl transition duration-150 text-slate-400 hover:text-cyan-400"
                              title="Chỉnh sửa"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Form (Add or Edit) */}
        {(showAddForm || editingTeam) && (
          <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-2xl p-6 self-start">
            <h2 className="text-xl font-bold text-white mb-6">
              {editingTeam ? "Chỉnh sửa đội nhóm" : "Tạo đội nhóm mới"}
            </h2>

            <form
              onSubmit={editingTeam ? handleEditSubmit : handleCreate}
              className="space-y-4"
            >
              {formError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  <span>{formError}</span>
                </div>
              )}

              {!editingTeam && (
                <div>
                  <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
                    Phòng ban trực thuộc
                  </label>
                  <select
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    className="w-full bg-[#161D30] border border-slate-700/60 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-cyan-500 transition duration-300"
                  >
                    <option value="">-- Chọn phòng ban --</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        [{d.code}] {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
                  Mã đội nhóm
                </label>
                <input
                  type="text"
                  value={editingTeam ? editingTeam.code : code}
                  onChange={(e) => setCode(e.target.value)}
                  disabled={!!editingTeam}
                  placeholder="Ví dụ: GOOGLE-SEO, SYSTEM-TECH"
                  className="w-full bg-[#161D30] border border-slate-700/60 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition duration-300 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
                  Tên đội nhóm
                </label>
                <input
                  type="text"
                  value={editingTeam ? editingTeam.name : name}
                  onChange={(e) =>
                    editingTeam
                      ? setEditingTeam({ ...editingTeam, name: e.target.value })
                      : setName(e.target.value)
                  }
                  placeholder="Ví dụ: Team SEO Google"
                  className="w-full bg-[#161D30] border border-slate-700/60 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition duration-300"
                />
              </div>

              <div>
                <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
                  Trưởng nhóm (Team Leader)
                </label>
                <select
                  value={
                    editingTeam
                      ? editingTeam.leader_user_id || ""
                      : leaderUserId
                  }
                  onChange={(e) =>
                    editingTeam
                      ? setEditingTeam({
                          ...editingTeam,
                          leader_user_id: e.target.value || null,
                        })
                      : setLeaderUserId(e.target.value)
                  }
                  className="w-full bg-[#161D30] border border-slate-700/60 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-cyan-500 transition duration-300"
                >
                  <option value="">-- Chưa phân công --</option>
                  {leaders.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.fullName || "Không tên"} ({l.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
                  Mô tả đội nhóm
                </label>
                <textarea
                  rows={3}
                  value={
                    editingTeam ? editingTeam.description || "" : description
                  }
                  onChange={(e) =>
                    editingTeam
                      ? setEditingTeam({
                          ...editingTeam,
                          description: e.target.value,
                        })
                      : setDescription(e.target.value)
                  }
                  placeholder="Đặc tả trách nhiệm cụ thể của nhóm..."
                  className="w-full bg-[#161D30] border border-slate-700/60 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition duration-300 resize-none"
                />
              </div>

              {editingTeam && (
                <div className="flex items-center gap-2 py-2">
                  <input
                    type="checkbox"
                    id="team_is_active"
                    checked={editingTeam.is_active}
                    onChange={(e) =>
                      setEditingTeam({
                        ...editingTeam,
                        is_active: e.target.checked,
                      })
                    }
                    className="w-4 h-4 accent-cyan-500"
                  />
                  <label
                    htmlFor="team_is_active"
                    className="text-sm text-slate-300 cursor-pointer"
                  >
                    Đội nhóm hoạt động
                  </label>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 text-black font-semibold rounded-xl transition duration-300 text-sm flex items-center justify-center gap-2"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingTeam ? "Cập nhật" : "Khởi tạo"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setEditingTeam(null);
                  }}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl transition duration-300 text-sm"
                >
                  Huỷ
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
