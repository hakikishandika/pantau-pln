"use client";

import { MessageCircle } from "lucide-react";
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

export function TodayOutageReportRow({
  report,
  onCommentClick,
}: {
  report: TodayFlyerReport;
  onCommentClick?: (flyerId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const waktu =
    report.locations[0]?.jam || report.waktu_pemadaman?.trim() || "—";

  return (
    <div className="flex items-start gap-2 rounded-xl border border-gray-700 bg-gray-800/60 px-4 py-3 transition-colors hover:bg-gray-800">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="min-w-0 flex-1 text-left"
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
      <button
        type="button"
        onClick={() => onCommentClick?.(report.id)}
        aria-label="Lihat suara warga untuk laporan ini"
        className="mt-0.5 shrink-0 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-700 hover:text-blue-400"
      >
        <MessageCircle className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
