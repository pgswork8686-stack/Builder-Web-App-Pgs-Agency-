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
  Search,
} from "lucide-react";
import { organizationApi } from "../../../../lib/api/organization";
import { peopleApi } from "../../../../lib/api/people";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";

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

      const filterActiveVal =
        filterActive === "true"
          ? true
          : filterActive === "false"
            ? false
            : undefined;

      const [teamsData, deptsData, peopleData] = await Promise.all([
        organizationApi.getTeams({
          departmentId: filterDept || undefined,
          isActive: filterActiveVal,
        }),
        organizationApi.getDepartments(),
        peopleApi.getPeopleDirectory({ pageSize: 100 }),
      ]);

      setTeams(teamsData);
      setDepartments(deptsData);
      setLeaders(
        (peopleData.items || []).map((p: any) => ({
          id: p.id,
          fullName: p.fullName,
          email: p.email,
        })),
      );
    } catch (err: any) {
      setError(err.message || "Không thể tải dữ liệu đội nhóm");
    } finally {
      setLoading(false);
    }
  }, [filterDept, filterActive]);

  useEffect(() => {
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
        leaderUserId: leaderUserId || undefined,
        description: description.trim() || undefined,
      });

      setTeams((prev) => [...prev, newTeam]);
      setShowAddForm(false);
      setCode("");
      setName("");
      setDepartmentId("");
      setLeaderUserId("");
      setDescription("");
    } catch (err: any) {
      setFormError(err.message || "Tạo đội nhóm thất bại");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (team: Team) => {
    try {
      const updated = await organizationApi.updateTeam(team.id, {
        isActive: !team.is_active,
      });
      setTeams((prev) =>
        prev.map((t) =>
          t.id === team.id ? { ...t, is_active: updated.is_active } : t,
        ),
      );
    } catch (err: any) {
      alert(err.message || "Thay đổi trạng thái thất bại");
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
      const updated = await organizationApi.updateTeam(editingTeam.id, {
        name: editingTeam.name.trim(),
        leaderUserId: editingTeam.leader_user_id || null,
        description: editingTeam.description?.trim() || null,
        isActive: editingTeam.is_active,
      });

      setTeams((prev) =>
        prev.map((t) => (t.id === updated.id ? updated : t)),
      );
      setEditingTeam(null);
    } catch (err: any) {
      setFormError(err.message || "Cập nhật đội nhóm thất bại");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredTeams = teams.filter((t) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      t.code.toLowerCase().includes(q) ||
      (t.department?.name && t.department.name.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <SectionHeader
        title="Quản Lý Đội Nhóm"
        description="Quản trị đội nhóm nghiệp vụ, phòng ban trực thuộc và phân công trưởng nhóm."
        badge={`${teams.length} Đội nhóm`}
        action={
          <div className="flex items-center gap-3">
            <Link href="/app/admin/organization">
              <Button variant="secondary" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />}>
                Cơ cấu tổ chức
              </Button>
            </Link>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setEditingTeam(null);
                setShowAddForm(true);
              }}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Thêm đội nhóm mới
            </Button>
          </div>
        }
      />

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-4 rounded-2xl border border-[#EDF2F7] shadow-xs">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên, mã đội nhóm..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#0F172A] outline-none focus:bg-white focus:border-[#4F75FF]"
          />
        </div>

        <select
          value={filterDept}
          onChange={(e) => setFilterDept(e.target.value)}
          className="bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] text-xs px-3 py-2 rounded-xl outline-none focus:bg-white focus:border-[#4F75FF]"
        >
          <option value="">-- Mọi phòng ban --</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} ({d.code})
            </option>
          ))}
        </select>

        <select
          value={filterActive}
          onChange={(e) => setFilterActive(e.target.value)}
          className="bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] text-xs px-3 py-2 rounded-xl outline-none focus:bg-white focus:border-[#4F75FF]"
        >
          <option value="">-- Mọi trạng thái --</option>
          <option value="true">Đang hoạt động</option>
          <option value="false">Tạm ngưng</option>
        </select>
      </div>

      {error ? (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
          <Button variant="danger" size="sm" onClick={fetchData}>
            Thử lại
          </Button>
        </div>
      ) : null}

      {/* Main Table Card */}
      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-[#4F75FF] animate-spin mb-3" />
            <span className="text-xs text-[#64748B]">
              Đang tải danh sách đội nhóm...
            </span>
          </div>
        ) : filteredTeams.length === 0 ? (
          <EmptyState
            icon={<Users2 className="w-8 h-8 text-[#4F75FF]" />}
            title="Chưa có đội nhóm nào"
            description="Bắt đầu tạo cơ cấu làm việc bằng cách thêm đội nhóm đầu tiên."
            actionLabel="Thêm đội nhóm"
            onAction={() => setShowAddForm(true)}
          />
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Mã đội nhóm</TableHeaderCell>
                  <TableHeaderCell>Tên đội nhóm</TableHeaderCell>
                  <TableHeaderCell>Phòng ban trực thuộc</TableHeaderCell>
                  <TableHeaderCell>Trưởng nhóm</TableHeaderCell>
                  <TableHeaderCell>Trạng thái</TableHeaderCell>
                  <TableHeaderCell className="text-right">Thao tác</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredTeams.map((team) => {
                  const leader = leaders.find((l) => l.id === team.leader_user_id);
                  const dept = departments.find((d) => d.id === team.department_id);
                  return (
                    <TableRow key={team.id}>
                      <TableCell className="font-mono font-bold text-[#4F75FF]">
                        {team.code}
                      </TableCell>
                      <TableCell>
                        <div className="font-bold text-[#0F172A]">{team.name}</div>
                        {team.description && (
                          <div className="text-[11px] text-[#64748B] line-clamp-1">
                            {team.description}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-[#0F172A] font-medium">
                        {dept?.name || team.department?.name || "—"}
                      </TableCell>
                      <TableCell className="text-xs text-[#64748B]">
                        {leader?.fullName || (
                          <span className="text-[#94A3B8] italic">Chưa chỉ định</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => handleUpdateStatus(team)}
                          className="cursor-pointer"
                        >
                          <Badge
                            variant={team.is_active ? "success" : "default"}
                            size="sm"
                          >
                            {team.is_active ? "Đang hoạt động" : "Tạm ngưng"}
                          </Badge>
                        </button>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingTeam(team)}
                          leftIcon={<Edit3 className="w-3.5 h-3.5" />}
                        >
                          Sửa
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>

      {/* Modal Add Team */}
      {showAddForm && (
        <Dialog
          isOpen={showAddForm}
          onClose={() => setShowAddForm(false)}
          maxWidth="md"
          title="Tạo đội nhóm mới"
          description="Thiết lập đội nhóm nghiệp vụ mới vào phòng ban."
        >
          <form onSubmit={handleCreate} className="space-y-4 pt-2">
            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{formError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#64748B] uppercase mb-1">
                Phòng ban trực thuộc *
              </label>
              <select
                required
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] outline-none focus:bg-white focus:border-[#4F75FF]"
              >
                <option value="">-- Chọn phòng ban --</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#64748B] uppercase mb-1">
                Mã đội nhóm *
              </label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="VD: SEO-ONPAGE, DEV-FE"
                className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs font-mono text-[#0F172A] outline-none focus:bg-white focus:border-[#4F75FF]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#64748B] uppercase mb-1">
                Tên đội nhóm *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="VD: Nhóm SEO Onpage & Content"
                className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] outline-none focus:bg-white focus:border-[#4F75FF]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#64748B] uppercase mb-1">
                Trưởng nhóm quản lý
              </label>
              <select
                value={leaderUserId}
                onChange={(e) => setLeaderUserId(e.target.value)}
                className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] outline-none focus:bg-white focus:border-[#4F75FF]"
              >
                <option value="">-- Chưa chỉ định trưởng nhóm --</option>
                {leaders.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.fullName || l.email}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#64748B] uppercase mb-1">
                Mô tả nhiệm vụ
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Mô tả phạm vi hoạt động của nhóm..."
                className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] outline-none focus:bg-white focus:border-[#4F75FF] resize-none"
              />
            </div>

            <div className="border-t border-[#EDF2F7] pt-4 flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowAddForm(false)}
              >
                Hủy bỏ
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={submitting}
                isLoading={submitting}
              >
                Khởi tạo đội nhóm
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* Modal Edit Team */}
      {editingTeam && (
        <Dialog
          isOpen={!!editingTeam}
          onClose={() => setEditingTeam(null)}
          maxWidth="md"
          title="Chỉnh sửa đội nhóm"
          description={`Cập nhật thông tin đội nhóm: ${editingTeam.code}`}
        >
          <form onSubmit={handleEditSubmit} className="space-y-4 pt-2">
            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{formError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#64748B] uppercase mb-1">
                Phòng ban trực thuộc *
              </label>
              <select
                required
                value={editingTeam.department_id}
                onChange={(e) =>
                  setEditingTeam({
                    ...editingTeam,
                    department_id: e.target.value,
                  })
                }
                className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] outline-none focus:bg-white focus:border-[#4F75FF]"
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#64748B] uppercase mb-1">
                Mã đội nhóm (Cố định)
              </label>
              <input
                type="text"
                disabled
                value={editingTeam.code}
                className="w-full bg-[#F1F5F9] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs font-mono text-[#64748B] cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#64748B] uppercase mb-1">
                Tên đội nhóm *
              </label>
              <input
                type="text"
                required
                value={editingTeam.name}
                onChange={(e) =>
                  setEditingTeam({ ...editingTeam, name: e.target.value })
                }
                className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] outline-none focus:bg-white focus:border-[#4F75FF]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#64748B] uppercase mb-1">
                Trưởng nhóm quản lý
              </label>
              <select
                value={editingTeam.leader_user_id || ""}
                onChange={(e) =>
                  setEditingTeam({
                    ...editingTeam,
                    leader_user_id: e.target.value || null,
                  })
                }
                className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] outline-none focus:bg-white focus:border-[#4F75FF]"
              >
                <option value="">-- Chưa chỉ định trưởng nhóm --</option>
                {leaders.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.fullName || l.email}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#64748B] uppercase mb-1">
                Mô tả nhiệm vụ
              </label>
              <textarea
                rows={3}
                value={editingTeam.description || ""}
                onChange={(e) =>
                  setEditingTeam({
                    ...editingTeam,
                    description: e.target.value,
                  })
                }
                className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] outline-none focus:bg-white focus:border-[#4F75FF] resize-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="edit_team_active"
                checked={editingTeam.is_active}
                onChange={(e) =>
                  setEditingTeam({
                    ...editingTeam,
                    is_active: e.target.checked,
                  })
                }
                className="w-4 h-4 accent-[#4F75FF] cursor-pointer"
              />
              <label
                htmlFor="edit_team_active"
                className="text-xs font-semibold text-[#0F172A] cursor-pointer select-none"
              >
                Đội nhóm đang hoạt động
              </label>
            </div>

            <div className="border-t border-[#EDF2F7] pt-4 flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setEditingTeam(null)}
              >
                Hủy bỏ
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={submitting}
                isLoading={submitting}
              >
                Lưu thay đổi
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
