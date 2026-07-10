"use client";

import { ArrowLeft, ClipboardCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AppLogo } from "@/components/app-logo";
import { VerificationAreaRow } from "@/components/verification-area-row";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import type { PublicApprovedFlyer } from "@/lib/types/public-map";
import type { VerificationStatus, VerificationTally } from "@/lib/types/verification";
import {
  aggregateVerificationsByArea,
  buildVerificationAreaRows,
  getAreaTallyKey,
  getSavedVerificationVote,
  getVerificationStartDate,
  saveVerificationVote,
} from "@/lib/verifications";

const EMPTY_TALLY: VerificationTally = { padam: 0, tidakPadam: 0 };

export default function VerifikasiPage() {
  const [rows, setRows] = useState<ReturnType<typeof buildVerificationAreaRows>>(
    [],
  );
  const [tallies, setTallies] = useState<Map<string, VerificationTally>>(
    new Map(),
  );
  const [savedVotes, setSavedVotes] = useState<
    Record<string, VerificationStatus>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submittingKey, setSubmittingKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const supabase = createSupabaseBrowserClient();
        const startDate = getVerificationStartDate(3);

        const { data: flyersData, error: flyersError } = await supabase
          .from("flyers")
          .select(
            `
          id,
          status,
          tanggal_pemadaman,
          waktu_pemadaman,
          unit_pelaksana,
          created_at,
          outage_sessions (
            id,
            sesi_ke,
            waktu_spesifik,
            locations (
              id,
              nama_raw,
              nama_normalized
            )
          )
        `,
          )
          .eq("status", "approved")
          .gte("tanggal_pemadaman", startDate)
          .order("tanggal_pemadaman", { ascending: false });

        if (flyersError) {
          throw new Error(flyersError.message);
        }

        const flyers = (flyersData as PublicApprovedFlyer[]) ?? [];
        const areaRows = buildVerificationAreaRows(flyers);
        const flyerIds = Array.from(new Set(areaRows.map((row) => row.flyerId)));

        let tallyMap = new Map<string, VerificationTally>();
        if (flyerIds.length > 0) {
          const { data: verificationsData, error: verificationsError } =
            await supabase
              .from("verifications")
              .select("flyer_id, nama_area, status")
              .in("flyer_id", flyerIds);

          if (verificationsError) {
            throw new Error(verificationsError.message);
          }

          tallyMap = aggregateVerificationsByArea(verificationsData ?? []);
        }

        const votes: Record<string, VerificationStatus> = {};
        for (const row of areaRows) {
          const saved = getSavedVerificationVote(row.flyerId, row.namaArea);
          if (saved) {
            votes[row.key] = saved;
          }
        }

        if (!cancelled) {
          setRows(areaRows);
          setTallies(tallyMap);
          setSavedVotes(votes);
        }
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof Error
              ? error.message
              : "Gagal memuat data verifikasi.";
          setErrorMessage(message);
          setRows([]);
          setTallies(new Map());
          setSavedVotes({});
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      cancelled = true;
    };
  }, []);

  const rowCountLabel = useMemo(() => {
    if (isLoading) {
      return "...";
    }
    return `${rows.length} area`;
  }, [isLoading, rows.length]);

  async function handleVote(
    rowKey: string,
    flyerId: string,
    namaArea: string,
    status: VerificationStatus,
  ) {
    if (savedVotes[rowKey] || submittingKey) {
      return;
    }

    setSubmittingKey(rowKey);
    setErrorMessage(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.from("verifications").insert({
        flyer_id: flyerId,
        nama_area: namaArea,
        status,
      });

      if (error) {
        throw new Error(error.message);
      }

      saveVerificationVote(flyerId, namaArea, status);
      setSavedVotes((current) => ({ ...current, [rowKey]: status }));

      const tallyKey = getAreaTallyKey(flyerId, namaArea);
      setTallies((current) => {
        const next = new Map(current);
        const existing = next.get(tallyKey) ?? { ...EMPTY_TALLY };
        next.set(
          tallyKey,
          status === "padam"
            ? { ...existing, padam: existing.padam + 1 }
            : { ...existing, tidakPadam: existing.tidakPadam + 1 },
        );
        return next;
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Gagal menyimpan verifikasi.";
      setErrorMessage(message);
    } finally {
      setSubmittingKey(null);
    }
  }

  return (
    <main className="flex min-h-screen flex-col bg-gray-950">
      <header className="border-b border-gray-800 bg-gray-900 px-4 py-6 sm:px-6">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          <Link
            href="/"
            className="inline-flex w-fit items-center gap-1.5 text-sm text-gray-400 transition-colors hover:text-gray-200"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Kembali ke dashboard
          </Link>
          <div className="flex items-start gap-3">
            <AppLogo />
            <div>
              <div className="flex items-center gap-2">
                <ClipboardCheck
                  className="h-5 w-5 text-blue-500"
                  aria-hidden="true"
                />
                <h1 className="text-2xl font-bold text-gray-50 sm:text-3xl">
                  Verifikasi Pemadaman
                </h1>
              </div>
              <p className="mt-2 max-w-2xl text-sm text-gray-400 sm:text-base">
                Bantu konfirmasi apakah pemadaman benar-benar terjadi di area
                kamu
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6">
        <div className="mb-4 flex items-center justify-between gap-2">
          <p className="text-xs text-gray-500">
            Menampilkan laporan 3 hari terakhir
          </p>
          <span className="rounded-full bg-blue-500/20 px-2.5 py-1 text-xs font-semibold text-blue-400">
            {rowCountLabel}
          </span>
        </div>

        {errorMessage && (
          <div
            className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400"
            role="alert"
          >
            {errorMessage}
          </div>
        )}

        {isLoading ? (
          <p className="text-sm text-gray-400">Memuat daftar area...</p>
        ) : rows.length === 0 ? (
          <p className="rounded-xl border border-gray-700 bg-gray-900 px-4 py-6 text-center text-sm text-gray-400">
            Belum ada laporan pemadaman dalam 3 hari terakhir
          </p>
        ) : (
          <ul className="space-y-3">
            {rows.map((row) => {
              const tally =
                tallies.get(getAreaTallyKey(row.flyerId, row.namaArea)) ??
                EMPTY_TALLY;

              return (
                <VerificationAreaRow
                  key={row.key}
                  namaArea={row.namaArea}
                  tanggal={row.tanggal}
                  waktu={row.waktu}
                  unitPelaksana={row.unitPelaksana}
                  tally={tally}
                  savedVote={savedVotes[row.key] ?? null}
                  isSubmitting={submittingKey === row.key}
                  onVote={(status) =>
                    void handleVote(row.key, row.flyerId, row.namaArea, status)
                  }
                />
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
