"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Briefcase, Search, Plus, Eye } from "lucide-react";
import { clientsApi } from "@/lib/api/clients";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";

export default function AccountantClientsPage() {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadClients() {
      try {
        const res = await clientsApi.getClientCompanies({ page: 1, pageSize: 50 });
        setClients((res as any)?.items || (res as any)?.data || []);
      } catch {
        // Safe load
      } finally {
        setLoading(false);
      }
    }
    loadClients();
  }, []);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Danh sách Khách hàng & Công nợ (Clients Accounting)"
        description="Theo dõi danh bạ doanh nghiệp đối tác, mã số thuế và tình trạng tài chính hợp đồng."
        badge={`${clients.length} Doanh nghiệp`}
      />

      {clients.length === 0 ? (
        <Card className="p-10 text-center">
          <EmptyState
            icon={<Briefcase className="w-10 h-10 text-[#7C879D]" />}
            title="Chưa có khách hàng nào trong hệ thống"
            description="Danh bạ khách hàng doanh nghiệp sẽ hiển thị tại đây khi được thêm mới."
          />
        </Card>
      ) : (
        <TableContainer>
          <Table>
            <thead>
              <TableRow>
                <TableHead>MÃ KH</TableHead>
                <TableHead>TÊN DOANH NGHIỆP</TableHead>
                <TableHead>MÃ SỐ THUẾ</TableHead>
                <TableHead>NGƯỜI LIÊN HỆ</TableHead>
                <TableHead>TRẠNG THÁI</TableHead>
              </TableRow>
            </thead>
            <TableBody>
              {clients.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs font-bold text-[#5D87FF]">
                    {c.code}
                  </TableCell>
                  <TableCell className="font-bold text-xs text-[#24304A]">
                    {c.name}
                  </TableCell>
                  <TableCell className="text-xs text-[#7C879D] font-mono">
                    {c.taxCode || "—"}
                  </TableCell>
                  <TableCell className="text-xs text-[#7C879D]">
                    {c.contactPerson || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={c.isActive || c.status === "active" ? "success" : "default"} size="sm">
                      {c.isActive || c.status === "active" ? "ĐANG HỢP TÁC" : "TẠM DỪNG"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </div>
  );
}
