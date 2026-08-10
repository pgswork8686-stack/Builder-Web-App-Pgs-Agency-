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
    <div className="min-h-screen flex flex-col md:flex-row bg-[#070707] text-[#FFF8E6]">
      {/* Video Hero Left Panel (~52%) */}
      <AuthHero />

      {/* Form Right Panel (~48%) */}
      <div className="w-full md:w-[48%] min-h-screen flex items-center justify-center p-6 lg:p-12 bg-[#070707]">
        <div className="w-full max-w-md space-y-8">
          <div>
            <Link
              href="/auth/login"
              className="inline-flex items-center gap-2 text-xs text-[#606060] hover:text-[#FFC400] mb-6 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Quay lại đăng nhập</span>
            </Link>

            <h2 className="text-3xl font-extrabold text-white tracking-tight">
              Quên mật khẩu?
            </h2>
            <p className="mt-2 text-sm text-[#606060]">
              Nhập email doanh nghiệp của bạn để nhận liên kết khôi phục mật
              khẩu.
            </p>
          </div>

          {/* Messages */}
          {errorMsg && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-red-950/50 border border-red-500/30 text-red-300 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-950/50 border border-emerald-500/30 text-emerald-300 text-sm">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleReset} className="space-y-6">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#606060] mb-2">
                Email doanh nghiệp
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#606060]" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@pgsagency.com"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#0E0E0F] border border-[#151516] focus:border-[#FFC400] text-white text-sm placeholder-[#606060] outline-none transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-[#FFC400] to-[#CFA63E] hover:brightness-110 text-black font-bold text-sm transition-all duration-200 shadow-[0_0_20px_rgba(255,196,0,0.2)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <span>Đang xử lý...</span>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>Gửi yêu cầu khôi phục</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
