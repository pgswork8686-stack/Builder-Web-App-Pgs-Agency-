import { supabase } from '../lib/supabase';

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 text-white font-sans">
      <main className="flex flex-col items-center max-w-xl p-8 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-xl text-center gap-6">
        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent">
          PGS Hub
        </h1>
        <p className="text-zinc-400 text-sm">
          Next.js App Router + Tailwind CSS v4 + Supabase
        </p>

        <div className="w-full h-px bg-zinc-800 my-2"></div>

        <div className="flex flex-col gap-4 text-left w-full">
          <h2 className="text-lg font-semibold text-zinc-200">Trạng thái kết nối:</h2>
          <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-lg font-mono text-xs text-zinc-300">
            <p><strong>Supabase URL:</strong> {process.env.NEXT_PUBLIC_SUPABASE_URL}</p>
            <p className="mt-1"><strong>Supabase Anon Key:</strong> {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Đã tải' : '❌ Chưa có'}</p>
          </div>
        </div>

        <a
          href="https://github.com/pgswork8686-stack/Builder-Web-App-Pgs-Agency-"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 px-6 py-2 rounded-full bg-zinc-800 hover:bg-zinc-700 transition-colors border border-zinc-700 text-sm font-medium"
        >
          Xem mã nguồn trên GitHub
        </a>
      </main>
    </div>
  );
}
