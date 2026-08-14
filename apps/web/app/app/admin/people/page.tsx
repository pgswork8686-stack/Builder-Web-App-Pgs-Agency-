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
} from "lucide-react";
import { peopleApi } from "../../../../lib/api/people";
import { organizationApi } from "../../../../lib/api/organization";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
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
    fetchDirectory();
  }, [fetchDirectory]);

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <SectionHeader
        title="Danh bạ Nhân sự (People Directory)"
        description="Quản lý hồ sơ nhân viên, chức danh, phòng ban và tình trạng công tác toàn doanh nghiệp."
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

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
          <span>{error}</span>
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
          <option value="leave">Nghỉ phép (On Leave)</option>
          <option value="terminated">Đã nghỉ việc (Terminated)</option>
        </select>
      </div>

      {/* Directory Table */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
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
                <TableHeaderCell className="text-right">Hồ sơ</TableHeaderCell>
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
                            : person.role
                              ? "blue"
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
                          ep?.employmentStatus === "active"
                            ? "success"
                            : ep?.employmentStatus === "probation"
                              ? "gold"
                              : "default"
                        }
                        size="sm"
                      >
                        {ep?.employmentStatus || person.accountStatus}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-right">
                      <Link href={`/app/admin/people/${person.id}`}>
                        <Button
                          variant="ghost"
                          size="sm"
                          leftIcon={<Eye className="w-4 h-4 text-[#4F75FF]" />}
                        >
                          Chi tiết
                        </Button>
                      </Link>
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
    </div>
  );
}
