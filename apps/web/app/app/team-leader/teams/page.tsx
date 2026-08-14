"use client";

import React, { useEffect, useState } from "react";
import { Layers, Users } from "lucide-react";
import { organizationApi } from "@/lib/api/organization";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export default function TeamLeaderTeamsPage() {
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTeams() {
      try {
        const res = await organizationApi.getTeams();
        setTeams((res as any) || []);
      } catch {
        // Safe load
      } finally {
        setLoading(false);
      }
    }
    loadTeams();
  }, []);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Quản lý Đội nhóm (Team Overview)"
        description="Theo dõi thành viên, phân công chuyên môn và vai trò trong nhóm."
        badge={`${teams.length} Team`}
      />

      {teams.length === 0 ? (
        <Card className="p-10 text-center">
          <EmptyState
            icon={<Layers className="w-10 h-10 text-[#7C879D]" />}
            title="Chưa có đội nhóm nào"
            description="Thông tin đội nhóm trực thuộc sẽ hiển thị tại đây."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map((t) => (
            <Card key={t.id} className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-[#5D87FF]">
                  {t.code}
                </span>
                <Badge variant={t.isActive ? "success" : "default"} size="sm">
                  {t.isActive ? "HOẠT ĐỘNG" : "TẠM DỪNG"}
                </Badge>
              </div>
              <h4 className="text-sm font-bold text-[#24304A]">{t.name}</h4>
              <p className="text-xs text-[#7C879D]">{t.description || "—"}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
