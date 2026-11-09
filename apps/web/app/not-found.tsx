import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen grid place-items-center bg-[#FFFBF0] px-4">
      <div className="w-full max-w-md rounded-2xl border border-[#F2EAD3] bg-white p-8 text-center">
        <p className="font-mono text-sm font-bold text-[#8A6400]">404</p>
        <h1 className="mt-2 text-2xl font-bold text-[#161827]">Không tìm thấy trang</h1>
        <p className="mt-2 text-sm text-[#475569]">
          Đường dẫn này không tồn tại hoặc bạn không có quyền xem. Hãy quay về trang chủ để tiếp tục làm việc.
        </p>
        <Link
          href="/app"
          className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-[#E7AE18] px-6 text-sm font-bold text-[#161827] hover:bg-[#CC9410]"
        >
          Về trang chủ
        </Link>
      </div>
    </main>
  );
}
