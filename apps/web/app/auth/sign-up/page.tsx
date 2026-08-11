"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthHero } from "../components/AuthHero";
import { createClient } from "@/lib/supabase/client";
import {
  Mail,
  Lock,
  User,
  UserPlus,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

export default function SignUpPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (password !== confirmPassword) {
      setErrorMsg("Mật khẩu xác nhận không khớp.");
      return;
    }

    if (password.length < 8) {
      setErrorMsg("Mật khẩu phải có tối thiểu 8 ký tự.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) {
        setErrorMsg(error.message);
        setLoading(false);
        return;
      }

      if (data.session) {
        setSuccessMsg("Đăng ký thành công! Đang chuyển hướng...");
        setTimeout(() => {
          router.push("/auth/resolve");
        }, 1500);
      } else {
        setSuccessMsg(
          "Đăng ký thành công! Vui lòng kiểm tra hộp thư email của bạn để xác nhận tài khoản trước khi đăng nhập."
        );
        setLoading(false);
      }
    } catch (err: unknown) {
      setErrorMsg("Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.");
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
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
    <div className="min-h-screen flex flex-col md:flex-row bg-[#070707] text-[#FFF8E6]">
      {/* Video Hero Left Panel (~52%) */}
      <AuthHero />

      {/* Form Right Panel (~48%) */}
      <div className="w-full md:w-[48%] min-h-screen flex items-center justify-center p-6 lg:p-12 bg-[#070707]">
        <div className="w-full max-w-md space-y-6">
          {/* Header Mobile Logo / Text */}
          <div>
            <div className="md:hidden flex items-center gap-2 mb-6">
              <div className="w-8 h-8 rounded-lg bg-[#FFC400] text-black font-black flex items-center justify-center">
                P
              </div>
              <span className="font-bold text-lg text-white">PGS HUB</span>
            </div>

            <h2 className="text-3xl font-extrabold text-white tracking-tight">
              Tạo tài khoản
            </h2>
            <p className="mt-2 text-sm text-[#606060]">
              Đăng ký tài khoản thành viên hệ thống PGS Hub
            </p>
          </div>

          {/* Error Message Alert */}
          {errorMsg && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-red-950/50 border border-red-500/30 text-red-300 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Success Alert */}
          {successMsg && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-950/50 border border-emerald-500/30 text-emerald-300 text-sm">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Google OAuth Button */}
          <button
            type="button"
            onClick={handleGoogleSignUp}
            disabled={oauthLoading || loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-[#0E0E0F] hover:bg-[#151516] border border-[#151516] hover:border-[#FFC400]/40 text-white font-medium text-sm transition-all duration-200 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
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
              {oauthLoading ? "Đang kết nối Google..." : "Đăng ký với Google"}
            </span>
          </button>

          {/* Divider */}
          <div className="relative flex items-center justify-center my-4">
            <div className="w-full border-t border-[#151516]" />
            <span className="absolute px-3 bg-[#070707] text-xs text-[#606060] uppercase tracking-wider">
              hoặc đăng ký bằng Email
            </span>
          </div>

          {/* Form */}
          <form onSubmit={handleSignUp} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#606060] mb-1.5">
                Họ và tên
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#606060]" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nguyễn Văn A"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0E0E0F] border border-[#151516] focus:border-[#FFC400] text-white text-sm placeholder-[#606060] outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#606060] mb-1.5">
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
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0E0E0F] border border-[#151516] focus:border-[#FFC400] text-white text-sm placeholder-[#606060] outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#606060] mb-1.5">
                Mật khẩu
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#606060]" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Tối thiểu 8 ký tự"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0E0E0F] border border-[#151516] focus:border-[#FFC400] text-white text-sm placeholder-[#606060] outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#606060] mb-1.5">
                Xác nhận mật khẩu
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#606060]" />
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0E0E0F] border border-[#151516] focus:border-[#FFC400] text-white text-sm placeholder-[#606060] outline-none transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || oauthLoading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-[#FFC400] to-[#CFA63E] hover:brightness-110 text-black font-bold text-sm transition-all duration-200 shadow-[0_0_20px_rgba(255,196,0,0.2)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer mt-2"
            >
              {loading ? (
                <span>Đang xử lý...</span>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Đăng ký tài khoản</span>
                </>
              )}
            </button>
          </form>

          {/* Footer Login Prompt */}
          <div className="text-center text-xs text-[#606060]">
            Đã có tài khoản?{" "}
            <Link
              href="/auth/login"
              className="text-[#FFC400] font-semibold hover:underline"
            >
              Đăng nhập ngay
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
