"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { formatHoursLabel } from "@/lib/duration";
import {
  aggregateLocationsByName,
  filterFlyersByDateRange,
  toMapPoints,
} from "@/lib/public-dashboard";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import type { PublicApprovedFlyer } from "@/lib/types/public-map";

const OutageMap = dynamic(() => import("@/components/outage-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[320px] items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-100 text-sm text-zinc-500">
      Memuat peta...
    </div>
  ),
});

const LONG_OUTAGE_THRESHOLD_HOURS = 6;

export default function PublicDashboardPage() {
  const [flyers, setFlyers] = useState<PublicApprovedFlyer[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
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
          .order("tanggal_pemadaman", { ascending: false, nullsFirst: false })
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
    () => filterFlyersByDateRange(flyers, dateFrom, dateTo),
    [flyers, dateFrom, dateTo],
  );

  const aggregatedLocations = useMemo(
    () => aggregateLocationsByName(filteredFlyers),
    [filteredFlyers],
  );

  const mapPoints = useMemo(
    () => toMapPoints(aggregatedLocations),
    [aggregatedLocations],
  );

  const totalAreas = aggregatedLocations.length;
  const totalOutageHours = useMemo(
    () =>
      Math.round(
        aggregatedLocations.reduce((sum, location) => sum + location.total_jam, 0) *
          100,
      ) / 100,
    [aggregatedLocations],
  );

  const longOutageAreas = useMemo(
    () =>
      aggregatedLocations.filter(
        (location) => location.total_jam > LONG_OUTAGE_THRESHOLD_HOURS,
      ),
    [aggregatedLocations],
  );

  const hasApprovedFlyers = flyers.length > 0;
  const hasMapData = aggregatedLocations.length > 0;

  if (!isLoading && !errorMessage && !hasApprovedFlyers) {
    return (
      <main className="flex flex-1 flex-col bg-zinc-50">
        <DashboardHeader />
        <div className="mx-auto flex w-full max-w-6xl flex-1 items-center justify-center px-4 py-16 sm:px-6">
          <p className="text-center text-sm text-zinc-500 sm:text-base">
            Belum ada data pemadaman yang terverifikasi
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col bg-zinc-50">
      <DashboardHeader />

      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6">
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-sm font-semibold text-zinc-900">
            Filter rentang tanggal
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Kosongkan untuk menampilkan semua data terverifikasi
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="date-from"
                className="block text-xs font-medium text-zinc-700"
              >
                Dari tanggal
              </label>
              <input
                id="date-from"
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
                className="mt-1.5 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none ring-blue-500 focus:border-blue-500 focus:ring-2"
              />
            </div>
            <div>
              <label
                htmlFor="date-to"
                className="block text-xs font-medium text-zinc-700"
              >
                Sampai tanggal
              </label>
              <input
                id="date-to"
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
                className="mt-1.5 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none ring-blue-500 focus:border-blue-500 focus:ring-2"
              />
            </div>
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

        <section className="grid grid-cols-2 gap-3 sm:gap-4">
          <StatCard
            label="Jumlah Area Terdampak"
            value={isLoading ? "..." : String(totalAreas)}
          />
          <StatCard
            label="Total Jam Mati Lampu"
            value={
              isLoading ? "..." : formatHoursLabel(totalOutageHours)
            }
          />
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-3 text-xs text-zinc-600">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-full bg-green-600" />
                Nominatim
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-full bg-yellow-500" />
                Estimasi AI
              </span>
            </div>
            <div className="h-[360px] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm sm:h-[420px] lg:h-[500px]">
              {isLoading ? (
                <div className="flex h-full items-center justify-center text-sm text-zinc-500">
                  Memuat data peta...
                </div>
              ) : !hasMapData ? (
                <div className="flex h-full items-center justify-center px-6 text-center text-sm text-zinc-500">
                  Tidak ada lokasi dengan koordinat pada filter ini
                </div>
              ) : (
                <OutageMap points={mapPoints} />
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-200 px-4 py-3 sm:px-5">
              <h2 className="text-base font-semibold text-zinc-900">
                Area Terdampak
              </h2>
              <p className="mt-1 text-xs text-zinc-500">
                Diurutkan dari total jam terbesar
              </p>
            </div>
            <div className="max-h-[500px] overflow-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="sticky top-0 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-4 py-3 font-medium sm:px-5">Nama</th>
                    <th className="px-4 py-3 font-medium sm:px-5">
                      Jumlah Sesi Pemadaman
                    </th>
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
                  ) : aggregatedLocations.length === 0 ? (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-4 py-6 text-center text-zinc-500 sm:px-5"
                      >
                        Tidak ada area pada filter ini
                      </td>
                    </tr>
                  ) : (
                    aggregatedLocations.map((location) => (
                      <tr key={location.nama} className="hover:bg-zinc-50">
                        <td className="px-4 py-3 font-medium text-zinc-900 sm:px-5">
                          {location.nama}
                        </td>
                        <td className="px-4 py-3 text-zinc-700 sm:px-5">
                          {location.jumlah_sesi}
                        </td>
                        <td className="px-4 py-3 text-zinc-700 sm:px-5">
                          {formatHoursLabel(location.total_jam)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-base font-semibold text-zinc-900">
            Area yang Terdampak Mati Lampu Lebih dari 6 Jam
          </h2>
          {isLoading ? (
            <p className="mt-4 text-sm text-zinc-500">Memuat data...</p>
          ) : longOutageAreas.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500">
              Belum ada area dengan total pemadaman lebih dari 6 jam
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Nama</th>
                    <th className="px-3 py-2 font-medium">
                      Jumlah Sesi Pemadaman
                    </th>
                    <th className="px-3 py-2 font-medium">Total Jam</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {longOutageAreas.map((location) => (
                    <tr key={location.nama}>
                      <td className="px-3 py-2 font-medium text-zinc-900">
                        {location.nama}
                      </td>
                      <td className="px-3 py-2 text-zinc-700">
                        {location.jumlah_sesi}
                      </td>
                      <td className="px-3 py-2 text-zinc-700">
                        {formatHoursLabel(location.total_jam)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function DashboardHeader() {
  return (
    <header className="border-b border-zinc-200 bg-white px-4 py-6 sm:px-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 sm:text-3xl">
            Pantau Pemadaman PLN Banjarbaru
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-600 sm:text-base">
            Peta jadwal pemadaman listrik PLN ULP Banjarbaru, dilaporkan oleh
            warga
          </p>
        </div>
        <Link
          href="/submit"
          className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
        >
          Laporkan Flyer Baru
        </Link>
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
      <p className="mt-2 text-2xl font-bold text-zinc-900 sm:text-3xl">
        {value}
      </p>
    </div>
  );
}
