"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { FolderKanban, ChevronRight } from "lucide-react";
import { projectsApi, type Project } from "@/lib/api/projects";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export default function EmployeeProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProjects() {
      try {
        const res = await projectsApi.getInternalProjects(1, 50);
        setProjects(res?.items || []);
      } catch {
        // Safe load
      } finally {
        setLoading(false);
      }
    }
    loadProjects();
  }, []);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Dự án tham gia (My Active Projects)"
        description="Các dự án mà bạn đang là thành viên thực hiện chuyên môn."
        badge={`${projects.length} Dự án`}
      />

      {projects.length === 0 ? (
        <Card className="p-10 text-center">
          <EmptyState
            icon={<FolderKanban className="w-10 h-10 text-[#7C879D]" />}
            title="Chưa tham gia dự án nào"
            description="Khi được quản lý thêm vào nhóm dự án, các dự án sẽ hiển thị tại đây."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => (
            <Link key={p.id} href={`/app/projects/${p.id}`}>
              <Card className="p-5 space-y-3 hover:border-[#5D87FF]/40 transition-all group">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-[#5D87FF]">
                    {p.projectCode}
                  </span>
                  <Badge
                    variant={p.status === "active" ? "blue" : "default"}
                    size="sm"
                  >
                    {p.status}
                  </Badge>
                </div>
                <h4 className="text-sm font-bold text-[#24304A] group-hover:text-[#5D87FF] transition-colors">
                  {p.name}
                </h4>
                <p className="text-xs text-[#7C879D]">
                  Khách hàng: {p.clientCompany?.name || "—"}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
