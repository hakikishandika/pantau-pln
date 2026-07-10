"use client";

import { useState } from "react";

import type { TodayFlyerReport } from "@/lib/public-dashboard";

function summarizeLocations(locations: TodayFlyerReport["locations"]): string {
  const names = locations.map((entry) => entry.nama);
  if (names.length === 0) {
    return "Lokasi belum tersedia";
  }
  if (names.length <= 3) {
    return names.join(", ");
  }
  return `${names.slice(0, 3).join(", ")} +${names.length - 3} lokasi lain`;
}

export function TodayOutageReportRow({ report }: { report: TodayFlyerReport }) {
  const [expanded, setExpanded] = useState(false);
  const waktu =
    report.locations[0]?.jam || report.waktu_pemadaman?.trim() || "—";

  return (
    <button
      type="button"
      onClick={() => setExpanded((current) => !current)}
      className="w-full rounded-xl border border-gray-700 bg-gray-800/60 px-4 py-3 text-left transition-colors hover:bg-gray-800"
    >
      <p className="text-sm font-medium text-gray-50">
        {expanded
          ? report.locations.map((entry) => entry.nama).join(", ")
          : summarizeLocations(report.locations)}
      </p>
      <p className="mt-1 text-xs text-gray-400">
        {report.unit_pelaksana || "Unit pelaksana belum diisi"} · {waktu}
      </p>
      <p className="mt-1 text-[11px] text-blue-400">
        {expanded ? "Klik untuk ringkas" : "Klik untuk lihat semua lokasi"}
      </p>
    </button>
  );
}
