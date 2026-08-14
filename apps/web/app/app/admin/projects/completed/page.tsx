"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, FolderKanban, Search, ChevronLeft } from "lucide-react";
import { projectsApi, type Project } from "@/lib/api/projects";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export default function AdminCompletedProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await projectsApi.getAdminProjects({ page: 1, pageSize: 20, status: "completed" });
        setProjects(res?.items || []);
      } catch {
        // Safe load
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Dự án Hoàn thành (Completed Projects)"
        description="Lưu trữ và tra cứu hồ sơ các dự án đã nghiệm thu và bàn giao thành công."
        badge={`${projects.length} Dự án`}
        action={
          <Link href="/app/admin/projects">
            <Button variant="secondary" size="sm" leftIcon={<ChevronLeft className="w-4 h-4" />}>
              Tất cả dự án
            </Button>
          </Link>
        }
      />

      {projects.length === 0 ? (
        <Card className="p-10 text-center">
          <EmptyState
            icon={<CheckCircle2 className="w-10 h-10 text-[#13DEB9]" />}
            title="Chưa có dự án nào hoàn thành"
            description="Khi một dự án chuyển sang trạng thái Nghiệm thu / Hoàn tất, dự án sẽ được lưu trữ tại đây."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => (
            <Card key={p.id} className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-[#5D87FF]">{p.projectCode}</span>
                <Badge variant="success" size="sm">Đã hoàn thành</Badge>
              </div>
              <h4 className="text-sm font-bold text-[#24304A]">{p.name}</h4>
              <p className="text-xs text-[#7C879D]">Khách hàng: {p.clientCompany?.name || "—"}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
