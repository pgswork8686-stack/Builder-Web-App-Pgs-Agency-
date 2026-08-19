"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Users,
  Search,
  Eye,
  UserPlus,
  Building,
  Shield,
  Briefcase,
  AlertCircle,
  Edit2,
  FolderKanban,
  Trash2,
  CheckCircle2,
  X,
  UserCheck,
  Clock,
  Phone,
  UserX,
} from "lucide-react";
import { peopleApi } from "../../../../lib/api/people";
import { organizationApi } from "../../../../lib/api/organization";
import { projectsApi, type Project } from "../../../../lib/api/projects";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog } from "@/components/ui/dialog";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import {
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
} from "@/components/ui/table";

interface Department {
  id: string;
  name: string;
}

interface Team {
  id: string;
  name: string;
  department_id?: string;
}

interface Person {
  id: string;
  email: string | null;
  fullName: string | null;
  phone?: string | null;
  role: string;
  accountStatus: string;
  employeeProfile: {
    employeeCode: string;
    departmentId?: string | null;
    teamId?: string | null;
    departmentName: string | null;
    teamName: string | null;
    jobTitle: string | null;
    employmentStatus: string;
    joinedDate?: string | null;
  } | null;
}

export default function AdminPeopleDirectoryPage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [employmentStatus, setEmploymentStatus] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Modals state
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [assigningPerson, setAssigningPerson] = useState<Person | null>(null);
  const [deletingPerson, setDeletingPerson] = useState<Person | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Edit Form State
  const [editFullName, setEditFullName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editRole, setEditRole] = useState<
    "admin" | "team_leader" | "employee" | "accountant" | "client"
  >("employee");
  const [editAccountStatus, setEditAccountStatus] = useState<
    "active" | "pending" | "suspended" | "terminated"
  >("active");
  const [editEmployeeCode, setEditEmployeeCode] = useState("");
  const [editDeptId, setEditDeptId] = useState("");
  const [editTeamId, setEditTeamId] = useState("");
  const [editJobTitle, setEditJobTitle] = useState("");
  const [editEmpStatus, setEditEmpStatus] = useState<
    "probation" | "active" | "on_leave" | "terminated"
  >("active");

  // Project Assign Form State
  const [assignedProjectIds, setAssignedProjectIds] = useState<string[]>([]);
  const [projectRole, setProjectRole] = useState<
    "project_manager" | "member" | "viewer"
  >("member");
  const [projectSearch, setProjectSearch] = useState("");

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

      const deptsData = await organizationApi
        .getDepartments()
        .catch(() => []);
      setDepartments(
        deptsData.filter((d: any) => d.isActive ?? d.is_active ?? true),
      );

      const teamsData = await organizationApi.getTeams().catch(() => []);
      setTeams(teamsData.filter((t: any) => t.isActive ?? t.is_active ?? true));

      const projectsRes = await projectsApi.getAdminProjects({
        pageSize: 100,
      });
      setAllProjects(projectsRes.items || []);
    } catch (err: any) {
      setError(err.message || "Không thể tải danh bạ nhân sự");
    } finally {
      setLoading(false);
    }
  }, [q, role, departmentId, teamId, employmentStatus, page]);

  useEffect(() => {
    fetchDirectory();
  }, [fetchDirectory]);

  // Open Edit Modal
  const handleOpenEdit = (person: Person) => {
    setEditingPerson(person);
    setEditFullName(person.fullName || "");
    setEditPhone(person.phone || "");
    setEditRole((person.role as any) || "employee");
    setEditAccountStatus((person.accountStatus as any) || "active");
    setEditEmployeeCode(person.employeeProfile?.employeeCode || "");
    setEditDeptId(person.employeeProfile?.departmentId || "");
    setEditTeamId(person.employeeProfile?.teamId || "");
    setEditJobTitle(person.employeeProfile?.jobTitle || "");
    setEditEmpStatus(
      (person.employeeProfile?.employmentStatus as any) || "active",
    );
  };

  // Submit Edit Person
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPerson) return;

    try {
      setSubmitting(true);
      setError(null);

      await peopleApi.updatePersonFull(editingPerson.id, {
        fullName: editFullName.trim(),
        phone: editPhone.trim() || null,
        role: editRole,
        accountStatus: editAccountStatus,
        employeeCode: editRole !== "client" ? editEmployeeCode.trim() : null,
        departmentId: editRole !== "client" ? editDeptId || null : null,
        teamId: editRole !== "client" ? editTeamId || null : null,
        jobTitle: editRole !== "client" ? editJobTitle.trim() || null : null,
        employmentStatus: editRole !== "client" ? editEmpStatus : undefined,
      });

      setSuccessMsg("Cập nhật thông tin & phân quyền nhân sự thành công!");
      setTimeout(() => setSuccessMsg(null), 4000);
      setEditingPerson(null);
      fetchDirectory();
    } catch (err: any) {
      setError(err.message || "Không thể lưu thông tin nhân sự");
    } finally {
      setSubmitting(false);
    }
  };

  // Open Assign Projects Modal
  const handleOpenAssignProjects = async (person: Person) => {
    setAssigningPerson(person);
    setProjectSearch("");
    try {
      const userProjects = await peopleApi.getUserProjects(person.id);
      setAssignedProjectIds(userProjects.map((up: any) => up.projectId));
    } catch {
      setAssignedProjectIds([]);
    }
  };

  // Toggle Project selection
  const handleToggleProject = (projectId: string) => {
    setAssignedProjectIds((prev) =>
      prev.includes(projectId)
        ? prev.filter((id) => id !== projectId)
        : [...prev, projectId],
    );
  };

  // Save Assign Projects
  const handleSaveAssignProjects = async () => {
    if (!assigningPerson) return;
    try {
      setSubmitting(true);
      setError(null);

      await peopleApi.assignUserProjects(assigningPerson.id, {
        projectIds: assignedProjectIds,
        projectRole,
      });

      setSuccessMsg(
        `Đã phân bổ ${assignedProjectIds.length} dự án cho ${assigningPerson.fullName || assigningPerson.email}!`,
      );
      setTimeout(() => setSuccessMsg(null), 4000);
      setAssigningPerson(null);
    } catch (err: any) {
      setError(err.message || "Không thể phân bổ dự án");
    } finally {
      setSubmitting(false);
    }
  };

  // Delete / Terminate Person
  const handleConfirmDelete = async () => {
    if (!deletingPerson) return;
    try {
      setSubmitting(true);
      setError(null);

      await peopleApi.deletePerson(deletingPerson.id);

      setSuccessMsg(
        `Đã chấm dứt / khóa tài khoản ${deletingPerson.fullName || deletingPerson.email} thành công!`,
      );
      setTimeout(() => setSuccessMsg(null), 4000);
      setDeletingPerson(null);
      fetchDirectory();
    } catch (err: any) {
      setError(err.message || "Không thể khóa tài khoản nhân sự");
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered Teams based on selected Department in Edit modal
  const filteredEditTeams = editDeptId
    ? teams.filter((t) => !t.department_id || t.department_id === editDeptId)
    : teams;

  const filteredProjects = allProjects.filter(
    (p) =>
      p.name.toLowerCase().includes(projectSearch.toLowerCase()) ||
      p.projectCode.toLowerCase().includes(projectSearch.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <SectionHeader
        title="Danh bạ Nhân sự (People Directory)"
        description="Quản lý hồ sơ nhân viên, chức danh, phân quyền vai trò, dự án và tình trạng công tác toàn doanh nghiệp."
        badge={`${total} Nhân sự`}
        action={
          <div className="flex items-center gap-2">
            <Link href="/app/admin/accounts/pending">
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Shield className="w-4 h-4" />}
              >
                Duyệt tài khoản mới
              </Button>
            </Link>
            <Link href="/app/admin/organization">
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Building className="w-4 h-4" />}
              >
                Cơ cấu tổ chức
              </Button>
            </Link>
          </div>
        }
      />

      {/* Success Alert */}
      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{successMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMsg(null)}
            className="text-emerald-600 hover:text-emerald-900"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-rose-500 hover:text-rose-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 5-Dimension Filter Grid */}
      <div className="p-4 rounded-2xl bg-white border border-[#EDF2F7] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 shadow-xs">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8] pointer-events-none" />
          <input
            type="text"
            placeholder="Tìm theo tên, email, mã NV..."
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] text-xs placeholder-[#94A3B8] outline-none focus:bg-white focus:border-[#4F75FF] transition-colors"
          />
        </div>

        <select
          value={role}
          onChange={(e) => {
            setRole(e.target.value);
            setPage(1);
          }}
          className="rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#0F172A] px-3 py-2.5 outline-none focus:bg-white focus:border-[#4F75FF]"
        >
          <option value="">-- Mọi vai trò --</option>
          <option value="admin">Quản trị viên (Admin)</option>
          <option value="team_leader">Trưởng nhóm (Team Leader)</option>
          <option value="employee">Nhân viên (Employee)</option>
          <option value="accountant">Kế toán (Accountant)</option>
          <option value="client">Khách hàng (Client)</option>
        </select>

        <select
          value={departmentId}
          onChange={(e) => {
            setDepartmentId(e.target.value);
            setPage(1);
          }}
          className="rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#0F172A] px-3 py-2.5 outline-none focus:bg-white focus:border-[#4F75FF]"
        >
          <option value="">-- Mọi phòng ban --</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        <select
          value={teamId}
          onChange={(e) => {
            setTeamId(e.target.value);
            setPage(1);
          }}
          className="rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#0F172A] px-3 py-2.5 outline-none focus:bg-white focus:border-[#4F75FF]"
        >
          <option value="">-- Mọi nhóm (Team) --</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>

        <select
          value={employmentStatus}
          onChange={(e) => {
            setEmploymentStatus(e.target.value);
            setPage(1);
          }}
          className="rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#0F172A] px-3 py-2.5 outline-none focus:bg-white focus:border-[#4F75FF]"
        >
          <option value="">-- Tình trạng công tác --</option>
          <option value="active">Đang làm việc (Active)</option>
          <option value="probation">Thử việc (Probation)</option>
          <option value="on_leave">Nghỉ phép (On Leave)</option>
          <option value="terminated">Đã nghỉ việc (Terminated)</option>
        </select>
      </div>

      {/* Directory Table */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      ) : people.length === 0 ? (
        <EmptyState
          icon={<Users className="w-8 h-8 text-[#4F75FF]" />}
          title="Không tìm thấy nhân sự"
          description="Không có hồ sơ nào phù hợp với các tiêu chí tìm kiếm hiện tại."
        />
      ) : (
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Nhân viên</TableHeaderCell>
                <TableHeaderCell>Mã NV</TableHeaderCell>
                <TableHeaderCell>Vai trò</TableHeaderCell>
                <TableHeaderCell>Phòng ban & Nhóm</TableHeaderCell>
                <TableHeaderCell>Chức danh</TableHeaderCell>
                <TableHeaderCell>Tình trạng</TableHeaderCell>
                <TableHeaderCell className="text-right">
                  Thao tác quản trị
                </TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {people.map((person) => {
                const ep = person.employeeProfile;
                return (
                  <TableRow key={person.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar
                          name={person.fullName || person.email || "?"}
                          size="md"
                        />
                        <div>
                          <p className="font-bold text-[#0F172A]">
                            {person.fullName || "Chưa cập nhật"}
                          </p>
                          <p className="text-xs text-[#64748B]">
                            {person.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="font-mono text-xs font-bold text-[#4F75FF]">
                      {ep?.employeeCode || "—"}
                    </TableCell>

                    <TableCell>
                      <Badge
                        variant={
                          person.role === "admin"
                            ? "gold"
                            : person.role === "team_leader"
                              ? "blue"
                              : person.role === "accountant"
                                ? "success"
                                : person.role === "client"
                                  ? "purple"
                                  : "default"
                        }
                        size="sm"
                      >
                        {person.role ? person.role.toUpperCase() : "CHƯA GÁN"}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-xs text-[#64748B]">
                      <p className="text-[#0F172A] font-medium">
                        {ep?.departmentName || "Chưa gán PB"}
                      </p>
                      {ep?.teamName && (
                        <p className="text-[11px] text-[#4F75FF]">
                          Team: {ep.teamName}
                        </p>
                      )}
                    </TableCell>

                    <TableCell className="text-xs text-[#64748B]">
                      {ep?.jobTitle || "—"}
                    </TableCell>

                    <TableCell>
                      <Badge
                        variant={
                          person.accountStatus === "terminated" ||
                          ep?.employmentStatus === "terminated"
                            ? "danger"
                            : ep?.employmentStatus === "active" ||
                                person.accountStatus === "active"
                              ? "success"
                              : ep?.employmentStatus === "probation"
                                ? "gold"
                                : "default"
                        }
                        size="sm"
                      >
                        {person.accountStatus === "terminated"
                          ? "ĐÃ KHÓA"
                          : ep?.employmentStatus || person.accountStatus}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Edit Role & Details */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenEdit(person)}
                          leftIcon={
                            <Edit2 className="w-3.5 h-3.5 text-[#5D87FF]" />
                          }
                          title="Chỉnh sửa thông tin & phân quyền"
                        >
                          Sửa
                        </Button>

                        {/* Assign Projects */}
                        {person.role !== "client" && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleOpenAssignProjects(person)}
                            leftIcon={
                              <FolderKanban className="w-3.5 h-3.5 text-[#5D87FF]" />
                            }
                            title="Phân bổ dự án cho nhân sự"
                          >
                            Dự án
                          </Button>
                        )}

                        {/* Delete / Terminate */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeletingPerson(person)}
                          className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                          title="Khóa / Chấm dứt thành viên"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-[#EDF2F7] text-xs text-[#64748B]">
          <span>
            Trang {page} / {totalPages} ({total} nhân sự)
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Trang trước
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Trang sau
            </Button>
          </div>
        </div>
      )}

      {/* MODAL 1: CHỈNH SỬA THÔNG TIN & PHÂN LẠI QUYỀN */}
      <Dialog
        isOpen={Boolean(editingPerson)}
        onClose={() => !submitting && setEditingPerson(null)}
        title="Chỉnh sửa thông tin & Phân quyền nhân sự"
        description={`Cập nhật vai trò hệ thống, chức danh, phòng ban và trạng thái cho ${editingPerson?.fullName || editingPerson?.email}.`}
        maxWidth="lg"
      >
        <form onSubmit={handleSaveEdit} className="space-y-4 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#24304A] mb-1.5">
                Họ và tên *
              </label>
              <input
                type="text"
                required
                value={editFullName}
                onChange={(e) => setEditFullName(e.target.value)}
                placeholder="Nhập họ và tên đầy đủ"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#EDF2F7] bg-[#F6F8FC] text-xs text-[#24304A] focus:bg-white focus:border-[#5D87FF] outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#24304A] mb-1.5">
                Số điện thoại
              </label>
              <input
                type="tel"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                placeholder="0988xxxxxx"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#EDF2F7] bg-[#F6F8FC] text-xs text-[#24304A] focus:bg-white focus:border-[#5D87FF] outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#24304A] mb-1.5">
                Phân quyền vai trò hệ thống *
              </label>
              <select
                value={editRole}
                onChange={(e) => setEditRole(e.target.value as any)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#EDF2F7] bg-[#F6F8FC] text-xs font-semibold text-[#24304A] focus:bg-white focus:border-[#5D87FF] outline-none"
              >
                <option value="admin">Quản trị viên (Admin)</option>
                <option value="team_leader">
                  Trưởng nhóm / Quản lý (Team Leader)
                </option>
                <option value="employee">Nhân viên thực thi (Employee)</option>
                <option value="accountant">
                  Kế toán & Tài chính (Accountant)
                </option>
                <option value="client">Khách hàng đại diện (Client)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#24304A] mb-1.5">
                Trạng thái tài khoản *
              </label>
              <select
                value={editAccountStatus}
                onChange={(e) => setEditAccountStatus(e.target.value as any)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#EDF2F7] bg-[#F6F8FC] text-xs font-semibold text-[#24304A] focus:bg-white focus:border-[#5D87FF] outline-none"
              >
                <option value="active">Hoạt động bình thường (Active)</option>
                <option value="pending">Chờ phê duyệt (Pending)</option>
                <option value="suspended">
                  Tạm ngưng hoạt động (Suspended)
                </option>
                <option value="terminated">
                  Đã khóa / Thôi việc (Terminated)
                </option>
              </select>
            </div>
          </div>

          {editRole !== "client" && (
            <div className="p-4 rounded-2xl bg-[#F6F8FC] border border-[#EDF2F7] space-y-4">
              <h4 className="text-xs font-extrabold text-[#24304A] uppercase tracking-wider flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-[#5D87FF]" />
                Thông tin hồ sơ nhân sự doanh nghiệp
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#24304A] mb-1.5">
                    Mã nhân viên (Employee Code)
                  </label>
                  <input
                    type="text"
                    value={editEmployeeCode}
                    onChange={(e) => setEditEmployeeCode(e.target.value)}
                    placeholder="VD: NV-001"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#EDF2F7] bg-white text-xs font-mono font-bold text-[#5D87FF] focus:border-[#5D87FF] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#24304A] mb-1.5">
                    Chức danh / Vị trí công việc
                  </label>
                  <input
                    type="text"
                    value={editJobTitle}
                    onChange={(e) => setEditJobTitle(e.target.value)}
                    placeholder="VD: Senior Graphic Designer"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#EDF2F7] bg-white text-xs text-[#24304A] focus:border-[#5D87FF] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#24304A] mb-1.5">
                    Phòng ban
                  </label>
                  <select
                    value={editDeptId}
                    onChange={(e) => {
                      setEditDeptId(e.target.value);
                      setEditTeamId("");
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#EDF2F7] bg-white text-xs text-[#24304A] focus:border-[#5D87FF] outline-none"
                  >
                    <option value="">-- Chưa gán phòng ban --</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#24304A] mb-1.5">
                    Đội nhóm (Team)
                  </label>
                  <select
                    value={editTeamId}
                    onChange={(e) => setEditTeamId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#EDF2F7] bg-white text-xs text-[#24304A] focus:border-[#5D87FF] outline-none"
                  >
                    <option value="">-- Chưa gán đội nhóm --</option>
                    {filteredEditTeams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#24304A] mb-1.5">
                  Tình trạng công tác
                </label>
                <select
                  value={editEmpStatus}
                  onChange={(e) => setEditEmpStatus(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#EDF2F7] bg-white text-xs font-semibold text-[#24304A] focus:border-[#5D87FF] outline-none"
                >
                  <option value="active">Chính thức (Active)</option>
                  <option value="probation">Thử việc (Probation)</option>
                  <option value="on_leave">Nghỉ phép dài hạn (On Leave)</option>
                  <option value="terminated">
                    Đã chấm dứt hợp đồng (Terminated)
                  </option>
                </select>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#EDF2F7]">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={submitting}
              onClick={() => setEditingPerson(null)}
            >
              Hủy bỏ
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={submitting}
            >
              Lưu thay đổi
            </Button>
          </div>
        </form>
      </Dialog>

      {/* MODAL 2: PHÂN BỔ DỰ ÁN CHO NHÂN SỰ */}
      <Dialog
        isOpen={Boolean(assigningPerson)}
        onClose={() => !submitting && setAssigningPerson(null)}
        title="Phân bổ dự án cho nhân sự"
        description={`Chọn các dự án mà ${assigningPerson?.fullName || assigningPerson?.email} sẽ tham gia thực thi.`}
        maxWidth="lg"
      >
        <div className="space-y-4 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8] pointer-events-none" />
              <input
                type="text"
                placeholder="Tìm kiếm dự án theo tên hoặc mã..."
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-[#F6F8FC] border border-[#EDF2F7] text-xs text-[#24304A] focus:bg-white focus:border-[#5D87FF] outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-[#7C879D] shrink-0">
                Vai trò trong dự án:
              </span>
              <select
                value={projectRole}
                onChange={(e) => setProjectRole(e.target.value as any)}
                className="px-3 py-2 rounded-xl border border-[#EDF2F7] bg-[#F6F8FC] text-xs font-semibold text-[#24304A] outline-none focus:border-[#5D87FF]"
              >
                <option value="member">Thành viên (Member)</option>
                <option value="project_manager">Quản lý dự án (PM)</option>
                <option value="viewer">Người quan sát (Viewer)</option>
              </select>
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto rounded-2xl border border-[#EDF2F7] divide-y divide-[#EDF2F7] p-1">
            {filteredProjects.length === 0 ? (
              <p className="p-6 text-center text-xs text-[#7C879D]">
                Không có dự án nào khớp với tìm kiếm.
              </p>
            ) : (
              filteredProjects.map((p) => {
                const isSelected = assignedProjectIds.includes(p.id);
                return (
                  <label
                    key={p.id}
                    className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-[#EEF2FF] border border-[#5D87FF]/20"
                        : "hover:bg-[#F6F8FC]"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleProject(p.id)}
                        className="w-4 h-4 rounded text-[#5D87FF] focus:ring-[#5D87FF]"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-[#5D87FF]">
                            {p.projectCode}
                          </span>
                          <span className="text-xs font-bold text-[#24304A] truncate">
                            {p.name}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#7C879D] truncate">
                          Khách hàng:{" "}
                          {p.clientCompany?.name || "Doanh nghiệp đối tác"}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant={
                        p.status === "active"
                          ? "blue"
                          : p.status === "completed"
                            ? "success"
                            : "default"
                      }
                      size="sm"
                    >
                      {p.status}
                    </Badge>
                  </label>
                );
              })
            )}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-[#EDF2F7]">
            <span className="text-xs font-semibold text-[#5D87FF]">
              Đã chọn: {assignedProjectIds.length} dự án
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={submitting}
                onClick={() => setAssigningPerson(null)}
              >
                Hủy bỏ
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                isLoading={submitting}
                onClick={handleSaveAssignProjects}
              >
                Lưu phân bổ dự án
              </Button>
            </div>
          </div>
        </div>
      </Dialog>

      {/* MODAL 3: XÁC NHẬN KHÓA / CHẤM DỨT THÀNH VIÊN */}
      <DeleteConfirmDialog
        isOpen={Boolean(deletingPerson)}
        onClose={() => !submitting && setDeletingPerson(null)}
        onConfirm={handleConfirmDelete}
        title="Khóa / Chấm dứt tài khoản nhân sự"
        description={`Bạn có chắc chắn muốn khóa và chấm dứt tài khoản của "${deletingPerson?.fullName || deletingPerson?.email}"? Nhân sự này sẽ bị tước quyền truy cập các dự án và hệ thống.`}
        isLoading={submitting}
      />
    </div>
  );
}
