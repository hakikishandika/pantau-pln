"use client";

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
    <main className="flex flex-1 flex-col bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/admin"
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            ← Kembali ke dashboard
          </Link>
          <h1 className="mt-1 text-lg font-bold text-zinc-900 sm:text-xl">
            Regeocode Semua Lokasi
          </h1>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6 sm:px-6">
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <p className="text-sm text-amber-900">
            Proses ini akan menghapus cache lama dan mencari ulang koordinat
            SEMUA lokasi di database, bisa memakan waktu lama.
          </p>
        </section>

        {errorMessage && (
          <div
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            role="alert"
          >
            {errorMessage}
          </div>
        )}

        <button
          type="button"
          onClick={() => void handleRegeocodeAll()}
          disabled={isRunning}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
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
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-medium text-zinc-900">
              {progress.total > 0
                ? `Memproses ${progress.current} dari ${progress.total} lokasi`
                : "Menyiapkan data..."}
            </p>
            {progress.nama && (
              <p className="mt-1 truncate text-xs text-zinc-500">
                Saat ini: {progress.nama}
              </p>
            )}
          </div>
        )}

        {summary && (
          <section className="rounded-2xl border border-green-200 bg-green-50 p-5 shadow-sm">
            <h2 className="text-base font-semibold text-green-900">
              Ringkasan Regeocode
            </h2>
            <ul className="mt-3 space-y-1 text-sm text-green-800">
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
