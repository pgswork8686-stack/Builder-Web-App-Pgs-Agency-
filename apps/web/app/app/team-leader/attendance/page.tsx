"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function TeamLeaderAttendanceRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/app/attendance");
  }, [router]);
  return null;
}
