"use client";

import { useEffect } from "react";
import { asset } from "@/lib/base";

export default function GameRedirect() {
  const to = asset("/?go=merge");
  useEffect(() => {
    window.location.replace(to);
  }, [to]);
  return (
    <main className="grid min-h-dvh place-items-center p-6 text-center">
      <a href={to} className="font-bold underline">정원 합치기 열기</a>
    </main>
  );
}
