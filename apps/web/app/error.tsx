"use client";

import Link from "next/link";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="min-h-screen grid place-items-center bg-[#FFFBF0] px-4">
      <div role="alert" className="w-full max-w-md rounded-2xl border border-[#F2EAD3] bg-white p-8 text-center">
        <h1 className="text-2xl font-bold text-[#161827]">Đã xảy ra sự cố</h1>
        <p className="mt-2 text-sm text-[#475569]">
          Hệ thống gặp lỗi khi tải trang này. Bạn thử tải lại, hoặc quay về trang chủ.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-[#E7AE18] px-6 text-sm font-bold text-[#161827] hover:bg-[#CC9410]"
          >
            Thử lại
          </button>
          <Link
            href="/app"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-[#E8DDB8] bg-white px-6 text-sm font-bold text-[#161827] hover:bg-[#FFF8E5]"
          >
            Về trang chủ
          </Link>
        </div>
      </div>
    </main>
  );
}
