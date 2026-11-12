"use client";

import Link from "next/link";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
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
            onClick={reset}
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
