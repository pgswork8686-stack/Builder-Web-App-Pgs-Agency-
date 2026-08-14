import React from "react";
import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#F8FAFC] text-[#0F172A] p-6 font-sans">
      <Card className="flex flex-col items-center max-w-lg p-10 bg-white border-[#EDF2F7] rounded-3xl shadow-xl text-center space-y-6">
        <div className="w-12 h-12 rounded-2xl bg-[#EEF2FF] border border-[#C7D2FE] flex items-center justify-center text-[#4F75FF] font-black text-xl shadow-xs">
          P
        </div>

        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#0F172A]">
            PGS HUB
          </h1>
          <p className="text-sm text-[#64748B] mt-1 font-medium">
            Hệ thống quản trị vận hành PGS Agency Enterprise
          </p>
        </div>

        <Badge variant="blue" size="md">
          <span className="w-1.5 h-1.5 rounded-full bg-[#4F75FF] animate-pulse mr-1.5" />
          Hệ thống đang hoạt động ổn định
        </Badge>

        <div className="w-full pt-4 border-t border-[#EDF2F7] flex flex-col gap-3">
          <Link href="/auth/login" className="w-full">
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Truy cập Hệ thống
            </Button>
          </Link>
        </div>

        <div className="flex items-center justify-center gap-1.5 text-xs text-[#94A3B8]">
          <ShieldCheck className="w-3.5 h-3.5 text-[#4F75FF]" />
          <span>Bảo mật dữ liệu doanh nghiệp</span>
        </div>
      </Card>
    </div>
  );
}
