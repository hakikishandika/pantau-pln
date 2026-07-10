"use client";

import type { VerificationStatus, VerificationTally } from "@/lib/types/verification";

function formatDisplayDate(date: string | null): string {
  if (!date) {
    return "—";
  }
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return date;
  }
  return parsed.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function VerificationAreaRow({
  namaArea,
  tanggal,
  waktu,
  unitPelaksana,
  tally,
  savedVote,
  isSubmitting,
  onVote,
}: {
  namaArea: string;
  tanggal: string | null;
  waktu: string;
  unitPelaksana: string | null;
  tally: VerificationTally;
  savedVote: VerificationStatus | null;
  isSubmitting: boolean;
  onVote: (status: VerificationStatus) => void;
}) {
  const hasVoted = savedVote !== null;

  return (
    <li className="rounded-xl border border-gray-700 bg-gray-800/60 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-50">{namaArea}</p>
          <p className="mt-1 text-xs text-gray-400">
            {formatDisplayDate(tanggal)} · {waktu}
          </p>
          <p className="mt-1 text-[11px] text-gray-500">
            {unitPelaksana || "Unit pelaksana belum diisi"}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:items-end">
          <div className="inline-flex rounded-xl border border-gray-600 bg-gray-900 p-1">
            <button
              type="button"
              disabled={hasVoted || isSubmitting}
              onClick={() => onVote("padam")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed ${
                savedVote === "padam"
                  ? "bg-red-500/20 text-red-400"
                  : hasVoted
                    ? "text-gray-600"
                    : "text-gray-300 hover:bg-gray-800 hover:text-red-400"
              }`}
            >
              Padam
            </button>
            <button
              type="button"
              disabled={hasVoted || isSubmitting}
              onClick={() => onVote("tidak_padam")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed ${
                savedVote === "tidak_padam"
                  ? "bg-green-500/20 text-green-400"
                  : hasVoted
                    ? "text-gray-600"
                    : "text-gray-300 hover:bg-gray-800 hover:text-green-400"
              }`}
            >
              Tidak padam
            </button>
          </div>

          <p className="text-[11px] text-gray-500">
            {tally.padam} padam · {tally.tidakPadam} tidak padam
          </p>

          {hasVoted && (
            <p className="text-[11px] text-blue-400">
              Pilihanmu: {savedVote === "padam" ? "Padam" : "Tidak padam"}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}
