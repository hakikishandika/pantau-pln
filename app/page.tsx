"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { CitizenReportSummarySection } from "@/components/citizen-report-summary";
import { TodayOutageReportRow } from "@/components/today-outage-report-row";
import { formatHoursLabel } from "@/lib/duration";
import {
  aggregateAreaRanking,
  averageHoursPerIncident,
  buildTodayFlyerReports,
  countLocationsInFlyer,
  countUniqueAreas,
  exportRankingCsv,
  filterFlyersByPeriod,
  sumTotalHours,
  type PeriodFilter,
} from "@/lib/public-dashboard";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import type { PublicApprovedFlyer } from "@/lib/types/public-map";

const PERIOD_OPTIONS: { value: PeriodFilter; label: string }[] = [
  { value: "7d", label: "7 hari terakhir" },
  { value: "30d", label: "30 hari terakhir" },
  { value: "all", label: "Semua waktu" },
];

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

export default function PublicDashboardPage() {
  const [flyers, setFlyers] = useState<PublicApprovedFlyer[]>([]);
  const [period, setPeriod] = useState<PeriodFilter>("7d");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadApprovedFlyers() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase
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
                nama_normalized,
                lat,
                lng,
                geocode_source
              )
            )
          `,
          )
          .eq("status", "approved")
          .order("created_at", { ascending: false });

        if (error) {
          throw new Error(error.message);
        }

        if (!cancelled) {
          setFlyers((data as PublicApprovedFlyer[]) ?? []);
        }
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof Error
              ? error.message
              : "Gagal memuat data pemadaman.";
          setErrorMessage(message);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadApprovedFlyers();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredFlyers = useMemo(
    () => filterFlyersByPeriod(flyers, period),
    [flyers, period],
  );

  const ranking = useMemo(
    () => aggregateAreaRanking(filteredFlyers),
    [filteredFlyers],
  );

  const todayReports = useMemo(
    () => buildTodayFlyerReports(flyers),
    [flyers],
  );

  const latestReports = useMemo(() => flyers.slice(0, 8), [flyers]);

  const uniqueAreas = countUniqueAreas(ranking);
  const totalHours = sumTotalHours(ranking);
  const avgPerIncident = averageHoursPerIncident(ranking);
  const todayReportCount = todayReports.length;

  const hasApprovedFlyers = flyers.length > 0;

  function handleDownloadCsv() {
    const csv = exportRankingCsv(ranking);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pemadaman-banjarbaru-${period}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (!isLoading && !errorMessage && !hasApprovedFlyers) {
    return (
      <main className="flex flex-1 flex-col bg-zinc-50">
        <DashboardHeader onDownloadCsv={handleDownloadCsv} showDownload={false} />
        <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6">
          <CitizenReportSummarySection />
          <div className="flex flex-1 items-center justify-center py-10">
            <p className="text-center text-sm text-zinc-500 sm:text-base">
              Belum ada data pemadaman yang terverifikasi
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col bg-zinc-50">
      <DashboardHeader onDownloadCsv={handleDownloadCsv} showDownload />

      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6">
        <section className="rounded-2xl border-2 border-amber-300 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-zinc-900">
              Padam Listrik Hari Ini
            </h2>
            <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
              {isLoading ? "..." : `${todayReportCount} laporan`}
            </span>
          </div>

          {isLoading ? (
            <p className="mt-4 text-sm text-zinc-500">Memuat data hari ini...</p>
          ) : todayReports.length === 0 ? (
            <p className="mt-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800">
              Belum ada laporan pemadaman hari ini
            </p>
          ) : (
            <div className="mt-4 space-y-2">
              {todayReports.map((report) => (
                <TodayOutageReportRow key={report.id} report={report} />
              ))}
            </div>
          )}
        </section>

        <CitizenReportSummarySection />

        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">
                Filter periode statistik
              </h2>
              <p className="mt-1 text-xs text-zinc-500">
                Berdasarkan tanggal pemadaman pada flyer
              </p>
            </div>
            <select
              value={period}
              onChange={(event) =>
                setPeriod(event.target.value as PeriodFilter)
              }
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-blue-500 focus:border-blue-500 focus:ring-2"
            >
              {PERIOD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </section>

        {errorMessage && (
          <div
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            role="alert"
          >
            {errorMessage}
          </div>
        )}

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 sm:gap-4">
          <StatCard
            label="Area Terdampak"
            value={isLoading ? "..." : String(uniqueAreas)}
          />
          <StatCard
            label="Total Jam Padam"
            value={isLoading ? "..." : formatHoursLabel(totalHours)}
          />
          <StatCard
            label="Rata-rata per Kejadian"
            value={
              isLoading ? "..." : `${avgPerIncident.toFixed(1)} jam`
            }
          />
          <StatCard
            label="Laporan Hari Ini"
            value={isLoading ? "..." : String(todayReportCount)}
          />
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-200 px-4 py-3 sm:px-5">
            <h2 className="text-base font-semibold text-zinc-900">
              Area Paling Sering Padam
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              Diurutkan berdasarkan total jam terbesar
            </p>
          </div>
          <div className="max-h-[480px] overflow-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="sticky top-0 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-medium sm:px-5">Nama</th>
                  <th className="px-4 py-3 font-medium sm:px-5">Kejadian</th>
                  <th className="px-4 py-3 font-medium sm:px-5">Total Jam</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {isLoading ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-4 py-6 text-center text-zinc-500 sm:px-5"
                    >
                      Memuat data...
                    </td>
                  </tr>
                ) : ranking.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-4 py-6 text-center text-zinc-500 sm:px-5"
                    >
                      Tidak ada data pada periode ini
                    </td>
                  </tr>
                ) : (
                  ranking.map((row) => (
                    <tr key={row.nama} className="hover:bg-zinc-50">
                      <td className="px-4 py-3 font-medium text-zinc-900 sm:px-5">
                        {row.nama}
                      </td>
                      <td className="px-4 py-3 text-zinc-700 sm:px-5">
                        {row.jumlah_kejadian}
                      </td>
                      <td className="px-4 py-3 text-zinc-700 sm:px-5">
                        {formatHoursLabel(row.total_jam)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-200 px-4 py-3 sm:px-5">
            <h2 className="text-base font-semibold text-zinc-900">
              Laporan Terbaru
            </h2>
          </div>
          <ul className="divide-y divide-zinc-100">
            {isLoading ? (
              <li className="px-4 py-6 text-center text-sm text-zinc-500 sm:px-5">
                Memuat laporan...
              </li>
            ) : latestReports.length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-zinc-500 sm:px-5">
                Belum ada laporan
              </li>
            ) : (
              latestReports.map((flyer) => (
                <li
                  key={flyer.id}
                  className="flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"
                >
                  <div>
                    <p className="text-sm font-medium text-zinc-900">
                      {formatDisplayDate(flyer.tanggal_pemadaman)}
                    </p>
                    <p className="mt-1 text-xs text-zinc-600">
                      {flyer.waktu_pemadaman || "Waktu belum diisi"} ·{" "}
                      {countLocationsInFlyer(flyer)} lokasi
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {flyer.unit_pelaksana || "Unit pelaksana belum diisi"}
                    </p>
                  </div>
                  <span className="inline-flex w-fit rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                    {flyer.status ?? "approved"}
                  </span>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>

      {/*
        --- LEGACY MAP DASHBOARD (disembunyikan, dipertahankan untuk referensi) ---
        import dynamic from "next/dynamic";
        import { aggregateLocationsByName, filterFlyersByDateRange, toMapPoints } from "@/lib/public-dashboard";
        const OutageMap = dynamic(() => import("@/components/outage-map"), { ssr: false });
        // Filter rentang tanggal manual + peta Leaflet + tabel Area Terdampak + section >6 jam
      */}
    </main>
  );
}

function DashboardHeader({
  onDownloadCsv,
  showDownload,
}: {
  onDownloadCsv: () => void;
  showDownload: boolean;
}) {
  return (
    <header className="border-b border-zinc-200 bg-white px-4 py-6 sm:px-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 sm:text-3xl">
            Pantau Pemadaman PLN Banjarbaru
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-600 sm:text-base">
            Pantau jadwal pemadaman listrik PLN ULP Banjarbaru berdasarkan flyer
            yang dilaporkan warga
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {showDownload && (
            <button
              type="button"
              onClick={onDownloadCsv}
              className="inline-flex items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 transition-colors hover:bg-zinc-50"
            >
              Unduh CSV
            </button>
          )}
          <Link
            href="/submit"
            className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
          >
            Laporkan Flyer Baru
          </Link>
        </div>
      </div>
    </header>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 sm:text-sm">
        {label}
      </p>
      <p className="mt-2 text-xl font-bold text-zinc-900 sm:text-2xl">{value}</p>
    </div>
  );
}
