"use client";

import Link from "next/link";
import { useEffect } from "react";

// Sau mỗi lần deploy, tab mở từ trước còn trỏ tới file JS cũ đã bị thay → tự tải lại một lần.
const STALE = /ChunkLoadError|Loading chunk|dynamically imported module|Failed to load chunk/i;

export default function GlobalError({ error }: { error: Error; reset: () => void }) {
  useEffect(() => {
    if (!STALE.test(`${error?.name} ${error?.message}`)) return;
    try {
      const last = Number(sessionStorage.getItem("pgs_stale_reload") || 0);
      if (Date.now() - last < 30_000) return; // tránh vòng lặp tải lại
      sessionStorage.setItem("pgs_stale_reload", String(Date.now()));
    } catch {
      // không có sessionStorage: vẫn tải lại một lần
    }
    window.location.reload();
  }, [error]);

  return (
    <main className="min-h-screen grid place-items-center bg-[#F8F9FC] px-4">
      <div role="alert" className="w-full max-w-md rounded-xl border border-[#E7E9F0] bg-white p-8 text-center">
        <h1 className="text-2xl font-bold text-[#202333]">Đã xảy ra sự cố</h1>
        <p className="mt-2 text-sm text-[#475569]">
          Hệ thống gặp lỗi khi tải trang này. Bạn thử tải lại, hoặc quay về trang chủ.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-[#7257F5] px-6 text-sm font-bold text-white hover:bg-[#6044E8]"
          >
            Thử lại
          </button>
          <Link
            href="/app"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-[#DDDFEA] bg-white px-6 text-sm font-bold text-[#202333] hover:bg-[#F2EEFF]"
          >
            Về trang chủ
          </Link>
        </div>
      </div>
    </main>
  );
}
