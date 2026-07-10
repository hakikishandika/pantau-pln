"use client";

import {
  AlertTriangle,
  Clock,
  Download,
  FileText,
  MapPin,
  TrendingUp,
  Zap,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState, type ComponentType } from "react";

import { AreaRankingChart } from "@/components/area-ranking-chart";
import { AppLogo } from "@/components/app-logo";
import { GithubIcon } from "@/components/github-icon";
import { DisclaimerModal } from "@/components/disclaimer-modal";
import { SuaraWargaSection } from "@/components/suara-warga-section";
import { TodayOutageReportRow } from "@/components/today-outage-report-row";
import { formatHoursLabel } from "@/lib/duration";
import {
  aggregateAreaRanking,
  aggregateLocationsByName,
  averageHoursPerIncident,
  buildTodayFlyerReports,
  countLocationsInFlyer,
  countUniqueAreas,
  exportRankingCsv,
  filterFlyersByPeriod,
  sumTotalHours,
  toMapPoints,
  type PeriodFilter,
} from "@/lib/public-dashboard";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import type { PublicApprovedFlyer } from "@/lib/types/public-map";

const OutageMap = dynamic(() => import("@/components/outage-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[320px] items-center justify-center rounded-2xl border border-gray-800 bg-gray-800 text-sm text-gray-400">
      Memuat peta...
    </div>
  ),
});

const PERIOD_OPTIONS: { value: PeriodFilter; label: string }[] = [
  { value: "7d", label: "7 hari terakhir" },
  { value: "30d", label: "30 hari terakhir" },
  { value: "all", label: "Semua waktu" },
];

const LONG_OUTAGE_THRESHOLD_HOURS = 6;

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
  const [preselectedSuaraFlyerId, setPreselectedSuaraFlyerId] = useState<
    string | null
  >(null);

  function scrollToSuaraWarga(flyerId: string) {
    setPreselectedSuaraFlyerId(flyerId);
    document
      .getElementById("suara-warga")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  useEffect(() => {
    let cancelled = false;

    async function loadApprovedFlyers() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase
          .from("flyers")
          .select(
            `
            id,
            status,
            image_url,
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
          setIsLoading(false);
        }
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof Error
              ? error.message
              : "Gagal memuat data pemadaman.";
          setErrorMessage(message);
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

  const aggregatedLocations = useMemo(
    () => aggregateLocationsByName(filteredFlyers),
    [filteredFlyers],
  );

  const mapPoints = useMemo(
    () => toMapPoints(aggregatedLocations),
    [aggregatedLocations],
  );

  const todayReports = useMemo(
    () => buildTodayFlyerReports(flyers),
    [flyers],
  );

  const latestReports = useMemo(() => flyers.slice(0, 8), [flyers]);

  const longOutageAreas = useMemo(
    () => ranking.filter((row) => row.total_jam > LONG_OUTAGE_THRESHOLD_HOURS),
    [ranking],
  );

  const uniqueAreas = countUniqueAreas(ranking);
  const totalHours = sumTotalHours(ranking);
  const avgPerIncident = averageHoursPerIncident(ranking);
  const todayReportCount = todayReports.length;
  const hasApprovedFlyers = flyers.length > 0;
  const hasMapData = mapPoints.length > 0;

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

  return (
    <main className="flex flex-1 flex-col bg-gray-950">
      <DisclaimerModal />
      <DashboardHeader
        onDownloadCsv={handleDownloadCsv}
        showDownload={hasApprovedFlyers}
      />

      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6">
        <section className="rounded-2xl border border-gray-800 border-l-4 border-l-blue-600 bg-gray-900 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-blue-500" aria-hidden="true" />
              <h2 className="text-base font-semibold text-gray-50">
                Padam Listrik Hari Ini
              </h2>
            </div>
            <span className="inline-flex rounded-full bg-blue-500/20 px-2.5 py-1 text-xs font-semibold text-blue-400">
              {isLoading ? "..." : `${todayReportCount} laporan`}
            </span>
          </div>

          {isLoading ? (
            <p className="mt-4 text-sm text-gray-400">Memuat data hari ini...</p>
          ) : todayReports.length === 0 ? (
            <p className="mt-4 rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-400">
              Belum ada laporan pemadaman hari ini
            </p>
          ) : (
            <div className="mt-4 space-y-2">
              {todayReports.map((report) => (
                <TodayOutageReportRow
                  key={report.id}
                  report={report}
                  onCommentClick={scrollToSuaraWarga}
                />
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-50">
                Filter periode statistik
              </h2>
              <p className="mt-1 text-xs text-gray-400">
                Berdasarkan tanggal pemadaman pada flyer
              </p>
            </div>
            <select
              value={period}
              onChange={(event) =>
                setPeriod(event.target.value as PeriodFilter)
              }
              className="rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-50 outline-none ring-blue-500 focus:border-blue-500 focus:ring-2"
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
            className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400"
            role="alert"
          >
            {errorMessage}
          </div>
        )}

        {!isLoading && !errorMessage && !hasApprovedFlyers && (
          <p className="rounded-2xl border border-gray-800 bg-gray-900 px-4 py-8 text-center text-sm text-gray-400">
            Belum ada data pemadaman yang terverifikasi
          </p>
        )}

        <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard
            label="Area Terdampak"
            value={isLoading ? "..." : String(uniqueAreas)}
            icon={MapPin}
            accent="border-t-blue-500"
          />
          <StatCard
            label="Total Jam Padam"
            value={isLoading ? "..." : formatHoursLabel(totalHours)}
            icon={Clock}
            accent="border-t-teal-500"
          />
          <StatCard
            label="Rata-rata per Kejadian"
            value={isLoading ? "..." : `${avgPerIncident.toFixed(1)} jam`}
            icon={TrendingUp}
            accent="border-t-amber-500"
          />
          <StatCard
            label="Laporan Hari Ini"
            value={isLoading ? "..." : String(todayReportCount)}
            icon={FileText}
            accent="border-t-purple-500"
          />
        </section>

        <section className="rounded-2xl border border-gray-800 bg-gray-900">
          <div className="border-b border-gray-800 px-4 py-3 sm:px-5">
            <h2 className="text-base font-semibold text-gray-50">
              Area Paling Sering Padam
            </h2>
            <p className="mt-1 text-xs text-gray-400">
              Diurutkan berdasarkan total jam terbesar
            </p>
          </div>
          <AreaRankingChart ranking={ranking} />
          <div className="max-h-[480px] overflow-auto border-t border-gray-800">
            <table className="min-w-full text-left text-sm">
              <thead className="sticky top-0 bg-gray-800 text-xs uppercase tracking-wide text-gray-400">
                <tr>
                  <th className="px-4 py-3 font-medium sm:px-5">Nama</th>
                  <th className="px-4 py-3 font-medium sm:px-5">Kejadian</th>
                  <th className="px-4 py-3 font-medium sm:px-5">Total Jam</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {isLoading ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-4 py-6 text-center text-gray-400 sm:px-5"
                    >
                      Memuat data...
                    </td>
                  </tr>
                ) : ranking.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-4 py-6 text-center text-gray-400 sm:px-5"
                    >
                      Tidak ada data pada periode ini
                    </td>
                  </tr>
                ) : (
                  ranking.map((row) => (
                    <tr key={row.nama} className="hover:bg-gray-800/50">
                      <td className="px-4 py-3 font-medium text-gray-50 sm:px-5">
                        {row.nama}
                      </td>
                      <td className="px-4 py-3 text-gray-400 sm:px-5">
                        {row.jumlah_kejadian}
                      </td>
                      <td className="px-4 py-3 text-gray-400 sm:px-5">
                        {formatHoursLabel(row.total_jam)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-5">
          <h2 className="text-base font-semibold text-gray-50">
            Peta Area Terdampak
          </h2>
          <p className="mt-1 text-xs text-gray-400">
            Ukuran lingkaran proporsional dengan total jam pemadaman
          </p>

          <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-400">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>
              Sebagian titik pada peta ini merupakan estimasi AI dan mungkin tidak
              akurat secara presisi (lihat legenda warna). Gunakan sebagai
              perkiraan area, bukan lokasi pasti.
            </p>
          </div>

          <div className="mt-4 h-[360px] overflow-hidden rounded-2xl border border-gray-800 sm:h-[420px]">
            {isLoading ? (
              <div className="flex h-full items-center justify-center text-sm text-gray-400">
                Memuat data peta...
              </div>
            ) : !hasMapData ? (
              <div className="flex h-full items-center justify-center px-6 text-center text-sm text-gray-400">
                Tidak ada lokasi dengan koordinat pada filter ini
              </div>
            ) : (
              <OutageMap points={mapPoints} />
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-400">
            <span className="inline-flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full bg-green-500" />
              Lokasi presisi (data peta)
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full bg-yellow-500" />
              Estimasi AI (kurang presisi)
            </span>
          </div>
        </section>

        {!isLoading && longOutageAreas.length > 0 && (
          <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle
                className="mt-0.5 h-5 w-5 shrink-0 text-amber-400"
                aria-hidden="true"
              />
              <div>
                <p className="text-sm font-semibold text-amber-300">
                  {longOutageAreas.length} area melebihi 6 jam padam
                </p>
                <p className="mt-2 text-sm text-amber-200/80">
                  {longOutageAreas.map((area) => area.nama).join(", ")}
                </p>
              </div>
            </div>
          </section>
        )}

        <SuaraWargaSection
          todayReports={todayReports}
          selectedFlyerId={preselectedSuaraFlyerId}
          onSelectedFlyerIdChange={setPreselectedSuaraFlyerId}
        />

        <section className="rounded-2xl border border-gray-800 bg-gray-900">
          <div className="border-b border-gray-800 px-4 py-3 sm:px-5">
            <h2 className="text-base font-semibold text-gray-50">
              Laporan Terbaru
            </h2>
          </div>
          <ul className="divide-y divide-gray-800">
            {isLoading ? (
              <li className="px-4 py-6 text-center text-sm text-gray-400 sm:px-5">
                Memuat laporan...
              </li>
            ) : latestReports.length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-gray-400 sm:px-5">
                Belum ada laporan
              </li>
            ) : (
              latestReports.map((flyer) => (
                <li
                  key={flyer.id}
                  className="flex items-center gap-3 px-4 py-4 sm:gap-4 sm:px-5"
                >
                  {flyer.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={flyer.image_url}
                      alt="Thumbnail flyer"
                      className="h-[60px] w-[60px] shrink-0 rounded-lg border border-gray-700 object-cover"
                    />
                  ) : (
                    <div className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-lg border border-gray-700 bg-gray-800 text-[10px] text-gray-500">
                      N/A
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-50">
                      {formatDisplayDate(flyer.tanggal_pemadaman)}
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                      {flyer.waktu_pemadaman || "Waktu belum diisi"} ·{" "}
                      {countLocationsInFlyer(flyer)} lokasi
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {flyer.unit_pelaksana || "Unit pelaksana belum diisi"}
                    </p>
                  </div>
                  <span className="inline-flex w-fit shrink-0 rounded-full border border-green-500/30 bg-green-500/10 px-2.5 py-1 text-xs font-medium text-green-400">
                    {flyer.status ?? "approved"}
                  </span>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>

      <footer className="border-t border-gray-800 px-4 py-8">
        <div className="mx-auto max-w-6xl space-y-4 text-center text-xs text-gray-500">
          <div>
            <p className="font-medium text-gray-400">Kembangin bareng</p>
            <p className="mt-1">
              Proyek open source — kontribusi kode, laporan bug, atau ide fitur
              sangat diterima.
            </p>
            <a
              href="https://github.com/hakikishandika/pantau-pln"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 text-blue-500 hover:text-blue-400"
            >
              <GithubIcon className="h-4 w-4" />
              github.com/hakikishandika/pantau-pln
            </a>
          </div>
          <p>
            Aplikasi ini merupakan inisiatif mandiri oleh{" "}
            <a
              href="https://www.linkedin.com/in/shandikaraja/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:text-blue-400"
            >
              @shandikaraja
            </a>
            , tidak berkaitan dengan institusi tempat penulis bekerja.
          </p>
        </div>
      </footer>
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
    <header className="border-b border-gray-800 bg-gray-900 px-4 py-6 sm:px-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-3">
          <AppLogo />
          <div>
            <h1 className="text-2xl font-bold text-gray-50 sm:text-3xl">
              Pantau Pemadaman PLN Banjarbaru
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-gray-400 sm:text-base">
              Pantau jadwal pemadaman listrik PLN ULP Banjarbaru berdasarkan
              flyer yang dilaporkan warga
            </p>
          </div>
        </div>
        {showDownload && (
          <button
            type="button"
            onClick={onDownloadCsv}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm font-semibold text-gray-50 transition-colors hover:bg-gray-700"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Unduh CSV
          </button>
        )}
      </div>
    </header>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  icon: ComponentType<{ className?: string }>;
  accent: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-gray-800 border-t-2 bg-gray-900 p-4 sm:p-5 ${accent}`}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-gray-400" aria-hidden="true" />
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400 sm:text-sm">
          {label}
        </p>
      </div>
      <p className="mt-2 text-xl font-bold text-gray-50 sm:text-2xl">{value}</p>
    </div>
  );
}
