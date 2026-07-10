"use client";

import { MapPinned } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import type { RegeocodeSummary } from "@/lib/types/geocode";

type StreamEvent =
  | { type: "progress"; current: number; total: number; nama: string }
  | { type: "complete"; summary: RegeocodeSummary }
  | { type: "error"; message: string };

export default function AdminRegeocodePage() {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, nama: "" });
  const [summary, setSummary] = useState<RegeocodeSummary | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleRegeocodeAll() {
    const confirmed = window.confirm(
      "Yakin ingin regeocode ulang SEMUA lokasi? Cache lama akan dihapus dan proses bisa memakan waktu sangat lama.",
    );

    if (!confirmed) {
      return;
    }

    setIsRunning(true);
    setSummary(null);
    setErrorMessage(null);
    setProgress({ current: 0, total: 0, nama: "" });

    try {
      const response = await fetch("/api/regeocode-all", { method: "POST" });

      if (!response.ok || !response.body) {
        throw new Error("Gagal memulai proses regeocode.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) {
            continue;
          }

          const event = JSON.parse(line) as StreamEvent;

          if (event.type === "progress") {
            setProgress({
              current: event.current,
              total: event.total,
              nama: event.nama,
            });
          } else if (event.type === "complete") {
            setSummary(event.summary);
          } else if (event.type === "error") {
            throw new Error(event.message);
          }
        }
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Regeocode gagal. Silakan coba lagi.";
      setErrorMessage(message);
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col bg-gray-950">
      <header className="border-b border-gray-800 bg-gray-900 px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/admin"
            className="text-sm font-medium text-blue-500 hover:text-blue-400"
          >
            ← Kembali ke dashboard
          </Link>
          <div className="mt-1 flex items-center gap-2">
            <MapPinned className="h-5 w-5 text-blue-500" aria-hidden="true" />
            <h1 className="text-lg font-bold text-gray-50 sm:text-xl">
              Regeocode Semua Lokasi
            </h1>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6 sm:px-6">
        <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
          <p className="text-sm text-amber-300">
            Proses ini akan menghapus cache lama dan mencari ulang koordinat
            SEMUA lokasi di database, bisa memakan waktu lama.
          </p>
        </section>

        {errorMessage && (
          <div
            className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400"
            role="alert"
          >
            {errorMessage}
          </div>
        )}

        <button
          type="button"
          onClick={() => void handleRegeocodeAll()}
          disabled={isRunning}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-800"
        >
          {isRunning ? (
            <>
              <span
                className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
                aria-hidden="true"
              />
              Memproses regeocode...
            </>
          ) : (
            "Regeocode Ulang Semua Lokasi"
          )}
        </button>

        {isRunning && (
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4">
            <p className="text-sm font-medium text-gray-50">
              {progress.total > 0
                ? `Memproses ${progress.current} dari ${progress.total} lokasi`
                : "Menyiapkan data..."}
            </p>
            {progress.nama && (
              <p className="mt-1 truncate text-xs text-gray-500">
                Saat ini: {progress.nama}
              </p>
            )}
          </div>
        )}

        {summary && (
          <section className="rounded-2xl border border-green-500/30 bg-green-500/10 p-5">
            <h2 className="text-base font-semibold text-green-400">
              Ringkasan Regeocode
            </h2>
            <ul className="mt-3 space-y-1 text-sm text-green-300/90">
              <li>Berhasil: {summary.berhasil}</li>
              <li>Gagal: {summary.gagal}</li>
              <li>Nominatim Banjarbaru: {summary.nominatim_banjarbaru}</li>
              <li>Nominatim Kalsel: {summary.nominatim_kalsel}</li>
              <li>Estimasi Claude: {summary.claude_estimate}</li>
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
