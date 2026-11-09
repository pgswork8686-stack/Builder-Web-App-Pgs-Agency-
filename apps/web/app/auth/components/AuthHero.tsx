"use client";

import React from "react";

/** Nền trang xác thực theo Figma: kem + hai vầng sáng. Cố định, không chiếm chỗ trong bố cục. */
export function AuthHero() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden select-none">
      <div className="absolute -top-40 -left-32 w-[560px] h-[560px] rounded-full bg-[#FFF8E5] blur-3xl opacity-90" />
      <div className="absolute -bottom-32 -right-24 w-[360px] h-[360px] rounded-full bg-[#FEF3C7] blur-3xl opacity-80" />
    </div>
  );
}
