"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthHero } from "../components/AuthHero";
import { createClient } from "@/lib/supabase/client";
import {
  Lock,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
} from "lucide-react";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (password !== confirmPassword) {
      setErrorMsg("Mật khẩu xác nhận không khớp.");
      return;
    }

    if (password.length < 6) {
      setErrorMsg("Mật khẩu phải chứa ít nhất 6 ký tự.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        setErrorMsg(error.message);
        setLoading(false);
        return;
      }

      setSuccessMsg(
        "Mật khẩu đã được cập nhật thành công! Đang chuyển đến trang đăng nhập...",
      );
      setTimeout(() => {
        router.push("/auth/login");
      }, 2000);
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
              Cập nhật mật khẩu
            </h2>
            <p className="mt-2 text-sm text-[#606060]">
              Nhập mật khẩu mới cho tài khoản của bạn.
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
          <form onSubmit={handleUpdatePassword} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#606060] mb-2">
                Mật khẩu mới
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#606060]" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Tối thiểu 6 ký tự"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#0E0E0F] border border-[#151516] focus:border-[#FFC400] text-white text-sm placeholder-[#606060] outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#606060] mb-2">
                Xác nhận mật khẩu mới
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#606060]" />
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới"
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
                <span>Đang lưu...</span>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Đổi mật khẩu</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
