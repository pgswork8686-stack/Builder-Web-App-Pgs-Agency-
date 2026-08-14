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
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

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
          "Đăng ký thành công! Vui lòng kiểm tra hộp thư email của bạn để xác nhận tài khoản trước khi đăng nhập.",
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
    <div className="min-h-screen flex flex-col md:flex-row bg-[#F8FAFC] text-[#0F172A]">
      {/* Video Hero Left Panel (~52%) */}
      <AuthHero />

      {/* Form Right Panel (~48%) */}
      <div className="w-full md:w-[48%] min-h-screen flex items-center justify-center p-6 lg:p-12 bg-white border-l border-[#EDF2F7]">
        <div className="w-full max-w-md space-y-6">
          {/* Header Mobile Logo / Text */}
          <div>
            <div className="md:hidden flex items-center gap-2 mb-6">
              <div className="w-8 h-8 rounded-lg bg-[#4F75FF] text-white font-black flex items-center justify-center">
                P
              </div>
              <span className="font-bold text-lg text-[#0F172A]">PGS HUB</span>
            </div>

            <h2 className="text-2xl font-extrabold text-[#0F172A] tracking-tight">
              Tạo tài khoản
            </h2>
            <p className="mt-1 text-xs text-[#64748B]">
              Đăng ký tài khoản thành viên hệ thống PGS Hub
            </p>
          </div>

          {/* Error Message Alert */}
          {errorMsg && (
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Success Alert */}
          {successMsg && (
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Google OAuth Button */}
          <button
            type="button"
            onClick={handleGoogleSignUp}
            disabled={oauthLoading || loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl bg-[#F8FAFC] hover:bg-[#EEF2FF] border border-[#EDF2F7] hover:border-[#4F75FF]/40 text-[#0F172A] font-semibold text-xs transition-all shadow-xs disabled:opacity-50 cursor-pointer"
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
              {oauthLoading ? "Đang kết nối Google..." : "Đăng ký với Google"}
            </span>
          </button>

          {/* Divider */}
          <div className="relative flex items-center justify-center my-3">
            <div className="w-full border-t border-[#EDF2F7]" />
            <span className="absolute px-3 bg-white text-[11px] text-[#94A3B8] uppercase tracking-wider">
              hoặc đăng ký bằng Email
            </span>
          </div>

          {/* Form */}
          <form onSubmit={handleSignUp} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-1">
                Họ và tên
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nguyễn Văn A"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] focus:bg-white focus:border-[#4F75FF] text-[#0F172A] text-xs outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-1">
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

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-1">
                Mật khẩu
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Tối thiểu 8 ký tự"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] focus:bg-white focus:border-[#4F75FF] text-[#0F172A] text-xs outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-1">
                Xác nhận mật khẩu
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] focus:bg-white focus:border-[#4F75FF] text-[#0F172A] text-xs outline-none transition-colors"
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={loading || oauthLoading}
              isLoading={loading}
              leftIcon={<UserPlus className="w-4 h-4" />}
              className="w-full mt-2"
            >
              Đăng ký tài khoản
            </Button>
          </form>

          {/* Footer Login Prompt */}
          <div className="text-center text-xs text-[#64748B]">
            Đã có tài khoản?{" "}
            <Link
              href="/auth/login"
              className="text-[#4F75FF] font-bold hover:underline"
            >
              Đăng nhập ngay
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
