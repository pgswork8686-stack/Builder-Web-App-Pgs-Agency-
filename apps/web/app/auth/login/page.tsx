"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthHero } from "../components/AuthHero";
import { createClient } from "@/lib/supabase/client";
import { Mail, Lock, AlertCircle, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          setErrorMsg("Email hoặc mật khẩu không chính xác.");
        } else {
          setErrorMsg(error.message);
        }
        setLoading(false);
        return;
      }

      router.push("/auth/resolve");
    } catch (err: unknown) {
      setErrorMsg("Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.");
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMsg(null);
    setOauthLoading(true);

    try {
      const supabase = createClient();
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${origin}/auth/callback`,
        },
      });

      if (error) {
        setErrorMsg(error.message);
        setOauthLoading(false);
      }
    } catch (err: unknown) {
      setErrorMsg("Không thể kết nối với dịch vụ Google OAuth.");
      setOauthLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#F8FAFC] text-[#0F172A] font-sans">
      {/* Left Blue Hero Panel */}
      <AuthHero />

      {/* Right Form Panel */}
      <div className="w-full md:w-[50%] min-h-screen flex items-center justify-center p-6 lg:p-12 bg-[#F8FAFC]">
        <div className="w-full max-w-md bg-white border border-[#E2E8F0] p-8 sm:p-10 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] space-y-6">
          {/* Header */}
          <div>
            <div className="md:hidden flex items-center gap-2 mb-6">
              <div className="w-8 h-8 rounded-xl bg-[#FFB800] text-black font-black flex items-center justify-center">
                P
              </div>
              <span className="font-bold text-lg text-[#0F172A]">PGS Hub</span>
            </div>

            <h2 className="text-2xl font-black text-[#0F172A] tracking-tight">
              Đăng nhập PGS Hub
            </h2>
            <p className="mt-1.5 text-xs text-[#64748B]">
              Sử dụng tài khoản đã được Admin kích hoạt.
            </p>
          </div>

          {/* Error Message Alert */}
          {errorMsg && (
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Email / Password Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#475569]">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@pgsagency.vn"
                className="w-full px-4 py-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] focus:bg-white focus:border-[#4F75FF] focus:ring-2 focus:ring-[#4F75FF]/20 text-[#0F172A] text-sm placeholder-[#94A3B8] outline-none transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[#475569]">
                  Mật khẩu
                </label>
                <Link
                  href="/auth/forgot-password"
                  className="text-xs text-[#4F75FF] hover:underline font-medium"
                >
                  Quên mật khẩu?
                </Link>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-4 py-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] focus:bg-white focus:border-[#4F75FF] focus:ring-2 focus:ring-[#4F75FF]/20 text-[#0F172A] text-sm placeholder-[#94A3B8] outline-none transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading || oauthLoading}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#4F75FF] hover:bg-[#3D62EE] text-white font-bold text-sm transition-all duration-150 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? <span>Đang xử lý...</span> : <span>Đăng nhập</span>}
            </button>
          </form>

          {/* Divider */}
          <div className="relative flex items-center justify-center my-4">
            <div className="w-full border-t border-[#E2E8F0]" />
            <span className="absolute px-3 bg-white text-[11px] text-[#94A3B8]">
              Hoặc
            </span>
          </div>

          {/* Google OAuth Button */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={oauthLoading || loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] text-[#1E293B] font-semibold text-xs transition-all shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>
              {oauthLoading ? "Đang kết nối..." : "Tiếp tục với Google"}
            </span>
          </button>

          {/* Footer Register Prompt */}
          <div className="pt-2 text-center text-xs text-[#64748B]">
            Chưa có tài khoản?{" "}
            <Link
              href="/auth/sign-up"
              className="text-[#4F75FF] font-bold hover:underline"
            >
              Đăng ký và chờ Admin duyệt
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
