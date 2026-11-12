import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen grid place-items-center bg-[#F8F9FC] px-4">
      <div className="w-full max-w-md rounded-xl border border-[#E7E9F0] bg-white p-8 text-center">
        <p className="font-mono text-sm font-bold text-[#5B3FD6]">404</p>
        <h1 className="mt-2 text-2xl font-bold text-[#202333]">Không tìm thấy trang</h1>
        <p className="mt-2 text-sm text-[#475569]">
          Đường dẫn này không tồn tại hoặc bạn không có quyền xem. Hãy quay về trang chủ để tiếp tục làm việc.
        </p>
        <Link
          href="/app"
          className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-[#7257F5] px-6 text-sm font-bold text-white hover:bg-[#6044E8]"
        >
          Về trang chủ
        </Link>
      </div>
    </main>
  );
}
