"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronLeft } from "lucide-react";
import { projectsApi, type Project } from "@/lib/api/projects";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function ClientCompletedProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await projectsApi.getClientProjects(1, 20);
        setProjects((res?.items || []).filter((p) => p.status === "completed"));
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
        title="Dự án Hoàn thành & Bàn giao"
        description="Lịch sử các sản phẩm và dự án agency đã bàn giao nghiệm thu thành công."
        badge={`${projects.length} Dự án`}
        action={
          <Link href="/app/client/projects">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<ChevronLeft className="w-4 h-4" />}
            >
              Dự án đang làm
            </Button>
          </Link>
        }
      />

      {projects.length === 0 ? (
        <Card className="p-10 text-center">
          <EmptyState
            icon={<CheckCircle2 className="w-10 h-10 text-[#13DEB9]" />}
            title="Chưa có dự án nào hoàn thành"
            description="Các dự án sau khi hoàn tất nghiệm thu sản phẩm sẽ được lưu trữ tại đây."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {projects.map((p) => (
            <Card key={p.id} className="p-5 space-y-2">
              <span className="font-mono text-xs font-bold text-[#5D87FF]">
                {p.projectCode}
              </span>
              <h4 className="text-sm font-bold text-[#24304A]">{p.name}</h4>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
