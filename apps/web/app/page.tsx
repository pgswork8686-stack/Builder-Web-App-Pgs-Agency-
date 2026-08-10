import React from "react";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#070707] text-white p-6 font-sans">
      <main className="flex flex-col items-center max-w-xl p-8 bg-[#0E0E0F] border border-[#151516] rounded-2xl shadow-2xl text-center gap-6">
        <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-[#FFC400] to-[#CFA63E] bg-clip-text text-transparent">
          PGS HUB
        </h1>
        <p className="text-[#FFF8E6] text-opacity-80 text-lg font-medium">
          Hệ thống quản trị vận hành PGS Agency
        </p>

        <div className="w-full h-px bg-[#151516] my-2"></div>

        <div className="flex items-center justify-center gap-2 px-4 py-2 bg-[#151516] rounded-full border border-teal-500/20 text-xs text-teal-400">
          <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></span>
          Foundation đang hoạt động
        </div>
      </main>
    </div>
  );
}
