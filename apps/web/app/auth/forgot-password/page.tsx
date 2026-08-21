"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AuthHero } from "../components/AuthHero";
import { createClient } from "@/lib/supabase/client";
import {
  Mail,
  KeyRound,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/auth/update-password`,
      });

      if (error) {
        setErrorMsg(error.message);
        setLoading(false);
        return;
      }

      setSuccessMsg(
        "Yêu cầu khôi phục mật khẩu đã được gửi! Vui lòng kiểm tra hộp thư email của bạn.",
      );
      setLoading(false);
    } catch (err) {
      setErrorMsg("Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#F8FAFC] text-[#0F172A]">
      {/* Video Hero Left Panel (~52%) */}
      <AuthHero />

      {/* Form Right Panel (~48%) */}
      <div className="w-full md:w-[48%] min-h-screen flex items-center justify-center p-6 lg:p-12 bg-white border-l border-[#EDF2F7]">
        <div className="w-full max-w-md space-y-8">
          <div>
            <Link
              href="/auth/login"
              className="inline-flex items-center gap-2 text-xs font-semibold text-[#64748B] hover:text-[#4F75FF] mb-6 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Quay lại đăng nhập</span>
            </Link>

            <h2 className="text-2xl font-extrabold text-[#0F172A] tracking-tight">
              Quên mật khẩu?
            </h2>
            <p className="mt-1 text-xs text-[#64748B]">
              Nhập email doanh nghiệp của bạn để nhận liên kết khôi phục mật
              khẩu.
            </p>
          </div>

          {/* Messages */}
          {errorMsg && (
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleReset} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-1.5">
                Email doanh nghiệp
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@pgsagency.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] focus:bg-white focus:border-[#4F75FF] text-[#0F172A] text-xs outline-none transition-colors"
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={loading}
              isLoading={loading}
              leftIcon={<KeyRound className="w-4 h-4" />}
              className="w-full"
            >
              Gửi yêu cầu khôi phục
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
