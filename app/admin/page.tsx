"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { formatSubmitDate, StatusBadge } from "@/lib/admin-ui";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import type { Flyer, FlyerFilter } from "@/lib/types/flyer";

const FILTERS: { value: FlyerFilter; label: string }[] = [
  { value: "all", label: "Semua" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

export default function AdminDashboardPage() {
  const router = useRouter();
  const [flyers, setFlyers] = useState<Flyer[]>([]);
  const [filter, setFilter] = useState<FlyerFilter>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadFlyers() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase
          .from("flyers")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) {
          throw new Error(error.message);
        }

        if (!cancelled) {
          setFlyers((data as Flyer[]) ?? []);
        }
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof Error
              ? error.message
              : "Gagal memuat data flyer.";
          setErrorMessage(message);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadFlyers();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredFlyers =
    filter === "all"
      ? flyers
      : flyers.filter((flyer) => flyer.status === filter);

  async function handleLogout() {
    setIsLoggingOut(true);
    setErrorMessage(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signOut();

      if (error) {
        throw new Error(error.message);
      }

      router.push("/admin/login");
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Gagal logout.";
      setErrorMessage(message);
      setIsLoggingOut(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-zinc-900 sm:text-xl">
              Dashboard Admin
            </h1>
            <p className="text-sm text-zinc-600">
              Kelola submission flyer pemadaman
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/regeocode"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
            >
              Regeocode Data
            </Link>
            <button
              type="button"
              onClick={() => void handleLogout()}
              disabled={isLoggingOut}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoggingOut ? "Keluar..." : "Logout"}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">
        {errorMessage && (
          <div
            className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            role="alert"
          >
            {errorMessage}
          </div>
        )}

        <div className="mb-4 flex flex-wrap gap-2">
          {FILTERS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setFilter(item.value)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                filter === item.value
                  ? "bg-blue-600 text-white"
                  : "bg-white text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-sm text-zinc-500">
            <span
              className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600"
              aria-hidden="true"
            />
            Memuat flyer...
          </div>
        ) : filteredFlyers.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500">
            Tidak ada flyer untuk filter ini.
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {filteredFlyers.map((flyer) => (
              <li key={flyer.id}>
                <Link
                  href={`/admin/${flyer.id}`}
                  className="flex gap-3 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md sm:p-4"
                >
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 sm:h-24 sm:w-24">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={flyer.image_url}
                      alt="Thumbnail flyer"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-sm font-medium text-zinc-900">
                        {flyer.unit_pelaksana || "Belum ada unit"}
                      </p>
                      <StatusBadge status={flyer.status} />
                    </div>
                    <p className="mt-1 text-xs text-zinc-500">
                      {flyer.tanggal_pemadaman
                        ? `Tanggal: ${flyer.tanggal_pemadaman}`
                        : "Tanggal belum diisi"}
                    </p>
                    <p className="mt-2 text-xs text-zinc-400">
                      Submit: {formatSubmitDate(flyer.created_at)}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
