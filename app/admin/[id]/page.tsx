"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { formatSubmitDate, StatusBadge } from "@/lib/admin-ui";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import type { Flyer } from "@/lib/types/flyer";
import type { OutageSessionWithLocations } from "@/lib/types/location";

type FormState = {
  tanggal_pemadaman: string;
  waktu_pemadaman: string;
  unit_pelaksana: string;
};

type ExtractApiResponse =
  | { status: "success"; data: unknown }
  | { status: "error"; message: string };

type GeocodeApiResponse =
  | {
      berhasil: number;
      gagal: number;
      dari_cache: number;
      dari_nominatim: number;
      dari_estimasi_ai: number;
    }
  | { status: "error"; message: string };

type GeocodeSummary = {
  berhasil: number;
  gagal: number;
  dariCache: number;
  dariNominatim: number;
  dariEstimasiAi: number;
};

type NormalizeApiResponse =
  | { sebelum: number; sesudah: number }
  | { status: "error"; message: string };

export default function AdminFlyerDetailPage() {
  const params = useParams<{ id: string }>();
  const flyerId = params.id;

  const [flyer, setFlyer] = useState<Flyer | null>(null);
  const [sessions, setSessions] = useState<OutageSessionWithLocations[]>([]);
  const [form, setForm] = useState<FormState>({
    tanggal_pemadaman: "",
    waktu_pemadaman: "",
    unit_pelaksana: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isNormalizing, setIsNormalizing] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isAutoProcessing, setIsAutoProcessing] = useState(false);
  const [autoProcessStep, setAutoProcessStep] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [geocodeSummary, setGeocodeSummary] = useState<GeocodeSummary | null>(
    null,
  );
  const [geocodeCompleted, setGeocodeCompleted] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!flyerId) {
      return;
    }

    let cancelled = false;

    async function loadFlyerData() {
      if (reloadKey === 0) {
        setIsLoading(true);
      }
      setErrorMessage(null);

      try {
        const supabase = createSupabaseBrowserClient();

        const { data: flyerData, error: flyerError } = await supabase
          .from("flyers")
          .select("*")
          .eq("id", flyerId)
          .single();

        if (flyerError) {
          throw new Error(flyerError.message);
        }

        const { data: sessionData, error: sessionError } = await supabase
          .from("outage_sessions")
          .select(
            "id, flyer_id, sesi_ke, waktu_spesifik, locations(id, session_id, nama_raw, nama_normalized, lat, lng, geocode_source, geocode_confidence)",
          )
          .eq("flyer_id", flyerId)
          .order("sesi_ke", { ascending: true });

        if (sessionError) {
          throw new Error(sessionError.message);
        }

        if (!cancelled) {
          const typedFlyer = flyerData as Flyer;
          setFlyer(typedFlyer);
          setForm({
            tanggal_pemadaman: typedFlyer.tanggal_pemadaman ?? "",
            waktu_pemadaman: typedFlyer.waktu_pemadaman ?? "",
            unit_pelaksana: typedFlyer.unit_pelaksana ?? "",
          });
          setSessions((sessionData as OutageSessionWithLocations[]) ?? []);
        }
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof Error ? error.message : "Gagal memuat flyer.";
          setErrorMessage(message);
        }
      } finally {
        if (!cancelled && reloadKey === 0) {
          setIsLoading(false);
        }
      }
    }

    void loadFlyerData();

    return () => {
      cancelled = true;
    };
  }, [flyerId, reloadKey]);

  function handleFieldChange(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setSuccessMessage(null);
  }

  async function handleExtractWithAi() {
    if (!flyer) {
      return;
    }

    setIsExtracting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: flyer.image_url,
          flyerId: flyer.id,
        }),
      });

      const result = (await response.json()) as ExtractApiResponse;

      if (!response.ok || result.status === "error") {
        throw new Error(
          result.status === "error"
            ? result.message
            : "Ekstraksi AI gagal. Silakan coba lagi.",
        );
      }

      setReloadKey((current) => current + 1);
      setSuccessMessage("Ekstraksi AI berhasil. Data form telah diperbarui.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Ekstraksi AI gagal. Silakan coba lagi.";
      setErrorMessage(message);
    } finally {
      setIsExtracting(false);
    }
  }

  async function handleNormalizeLocations() {
    if (!flyer) {
      return;
    }

    setIsNormalizing(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setGeocodeSummary(null);
    setGeocodeCompleted(false);

    try {
      const response = await fetch("/api/normalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flyerId: flyer.id }),
      });

      const result = (await response.json()) as NormalizeApiResponse;

      if (!response.ok || "status" in result) {
        throw new Error(
          "status" in result
            ? result.message
            : "Normalisasi lokasi gagal. Silakan coba lagi.",
        );
      }

      setReloadKey((current) => current + 1);
      setSuccessMessage(
        `Normalisasi selesai: ${result.sebelum} lokasi menjadi ${result.sesudah} lokasi.`,
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Normalisasi lokasi gagal. Silakan coba lagi.";
      setErrorMessage(message);
    } finally {
      setIsNormalizing(false);
    }
  }

  async function handleGeocodeAll() {
    if (!flyer) {
      return;
    }

    setIsGeocoding(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setGeocodeSummary(null);
    setGeocodeCompleted(false);

    try {
      const response = await fetch("/api/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flyerId: flyer.id }),
      });

      const result = (await response.json()) as GeocodeApiResponse;

      if (!response.ok || "status" in result) {
        throw new Error(
          "status" in result
            ? result.message
            : "Geocoding gagal. Silakan coba lagi.",
        );
      }

      setGeocodeSummary({
        berhasil: result.berhasil,
        gagal: result.gagal,
        dariCache: result.dari_cache,
        dariNominatim: result.dari_nominatim,
        dariEstimasiAi: result.dari_estimasi_ai,
      });
      setGeocodeCompleted(true);
      setReloadKey((current) => current + 1);
      setSuccessMessage(
        `Geocoding selesai: ${result.berhasil} berhasil (${result.dari_cache} cache, ${result.dari_nominatim} Nominatim, ${result.dari_estimasi_ai} estimasi AI), ${result.gagal} gagal.`,
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Geocoding gagal. Silakan coba lagi.";
      setErrorMessage(message);
    } finally {
      setIsGeocoding(false);
    }
  }

  async function handleAutoProcess() {
    if (!flyer) {
      return;
    }

    setIsAutoProcessing(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setGeocodeSummary(null);
    setGeocodeCompleted(false);

    try {
      setAutoProcessStep("Langkah 1/3: Mengekstrak data...");
      const extractResponse = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: flyer.image_url,
          flyerId: flyer.id,
        }),
      });
      const extractResult = (await extractResponse.json()) as ExtractApiResponse;
      if (!extractResponse.ok || extractResult.status === "error") {
        throw new Error(
          `Langkah 1 (Ekstraksi) gagal: ${
            extractResult.status === "error"
              ? extractResult.message
              : "Silakan coba lagi."
          }`,
        );
      }

      setAutoProcessStep("Langkah 2/3: Normalisasi lokasi...");
      const normalizeResponse = await fetch("/api/normalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flyerId: flyer.id }),
      });
      const normalizeResult =
        (await normalizeResponse.json()) as NormalizeApiResponse;
      if (!normalizeResponse.ok || "status" in normalizeResult) {
        throw new Error(
          `Langkah 2 (Normalisasi) gagal: ${
            "status" in normalizeResult
              ? normalizeResult.message
              : "Silakan coba lagi."
          }`,
        );
      }

      setAutoProcessStep("Langkah 3/3: Geocoding lokasi...");
      const geocodeResponse = await fetch("/api/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flyerId: flyer.id }),
      });
      const geocodeResult = (await geocodeResponse.json()) as GeocodeApiResponse;
      if (!geocodeResponse.ok || "status" in geocodeResult) {
        throw new Error(
          `Langkah 3 (Geocoding) gagal: ${
            "status" in geocodeResult
              ? geocodeResult.message
              : "Silakan coba lagi."
          }`,
        );
      }

      setGeocodeSummary({
        berhasil: geocodeResult.berhasil,
        gagal: geocodeResult.gagal,
        dariCache: geocodeResult.dari_cache,
        dariNominatim: geocodeResult.dari_nominatim,
        dariEstimasiAi: geocodeResult.dari_estimasi_ai,
      });
      setGeocodeCompleted(true);
      setReloadKey((current) => current + 1);
      setSuccessMessage(
        `Proses otomatis selesai. Geocoding: ${geocodeResult.berhasil} berhasil, ${geocodeResult.gagal} gagal.`,
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Proses otomatis gagal. Silakan coba lagi.";
      setErrorMessage(message);
    } finally {
      setIsAutoProcessing(false);
      setAutoProcessStep(null);
    }
  }

  async function handleSaveChanges() {
    if (!flyer) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("flyers")
        .update({
          tanggal_pemadaman: form.tanggal_pemadaman || null,
          waktu_pemadaman: form.waktu_pemadaman || null,
          unit_pelaksana: form.unit_pelaksana || null,
        })
        .eq("id", flyer.id)
        .select("*")
        .single();

      if (error) {
        throw new Error(error.message);
      }

      const updatedFlyer = data as Flyer;
      setFlyer(updatedFlyer);
      setSuccessMessage("Perubahan berhasil disimpan.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Gagal menyimpan perubahan.";
      setErrorMessage(message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleStatusUpdate(status: "approved" | "rejected") {
    if (!flyer) {
      return;
    }

    setIsUpdatingStatus(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from("flyers")
        .update({
          status,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id ?? null,
        })
        .eq("id", flyer.id)
        .select("*")
        .single();

      if (error) {
        throw new Error(error.message);
      }

      const updatedFlyer = data as Flyer;
      setFlyer(updatedFlyer);
      setSuccessMessage(
        status === "approved"
          ? "Flyer berhasil disetujui."
          : "Flyer berhasil ditolak.",
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Gagal memperbarui status flyer.";
      setErrorMessage(message);
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  const isBusy =
    isSaving ||
    isUpdatingStatus ||
    isExtracting ||
    isNormalizing ||
    isGeocoding ||
    isAutoProcessing;
  const totalLocations = sessions.reduce(
    (count, session) => count + (session.locations?.length ?? 0),
    0,
  );
  const pendingGeocodeCount = sessions.reduce(
    (count, session) =>
      count +
      (session.locations?.filter(
        (location) => location.lat === null && location.lng === null,
      ).length ?? 0),
    0,
  );

  function GeocodeSourceBadge({
    source,
  }: {
    source: string | null;
  }) {
    if (
      source === "nominatim" ||
      source === "nominatim_banjarbaru" ||
      source === "nominatim_kalsel"
    ) {
      return (
        <span className="inline-flex w-fit rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
          Nominatim
        </span>
      );
    }

    if (source === "claude_estimate") {
      return (
        <span
          title="Perkiraan AI, mungkin kurang akurat"
          className="inline-flex w-fit cursor-help rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800"
        >
          Estimasi AI
        </span>
      );
    }

    return null;
  }

  if (isLoading) {
    return (
      <main className="flex flex-1 items-center justify-center bg-zinc-50 py-16 text-sm text-zinc-500">
        <span
          className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600"
          aria-hidden="true"
        />
        Memuat detail flyer...
      </main>
    );
  }

  if (!flyer) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-4 py-16">
        <p className="text-sm text-zinc-600">Flyer tidak ditemukan.</p>
        <Link
          href="/admin"
          className="mt-4 text-sm font-medium text-blue-600 hover:underline"
        >
          Kembali ke dashboard
        </Link>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <div>
            <Link
              href="/admin"
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              ← Kembali
            </Link>
            <h1 className="mt-1 text-lg font-bold text-zinc-900 sm:text-xl">
              Detail Flyer
            </h1>
          </div>
          <StatusBadge status={flyer.status} />
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-6 sm:px-6">
        {errorMessage && (
          <div
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            role="alert"
          >
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div
            className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700"
            role="status"
          >
            {successMessage}
          </div>
        )}

        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm sm:p-6">
          <h2 className="text-base font-semibold text-blue-900">
            Proses Otomatis
          </h2>
          <p className="mt-1 text-sm text-blue-800">
            Jalankan ekstraksi AI, normalisasi, dan geocoding dalam satu klik.
          </p>
          <button
            type="button"
            onClick={() => void handleAutoProcess()}
            disabled={isBusy}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300 sm:w-auto"
          >
            {isAutoProcessing ? (
              <>
                <span
                  className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
                  aria-hidden="true"
                />
                {autoProcessStep ?? "Memproses..."}
              </>
            ) : (
              "Proses Otomatis (Ekstrak + Normalisasi + Geocode)"
            )}
          </button>
        </section>

        <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={flyer.image_url}
            alt="Flyer pemadaman"
            className="max-h-[70vh] w-full bg-zinc-100 object-contain"
          />
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-base font-semibold text-zinc-900">
            Proses Manual
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Jalankan satu langkah saja jika perlu mengulang bagian tertentu.
          </p>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={() => void handleExtractWithAi()}
              disabled={isBusy}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-semibold text-violet-800 transition-colors hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isExtracting ? (
                <>
                  <span
                    className="h-4 w-4 animate-spin rounded-full border-2 border-violet-600 border-t-transparent"
                    aria-hidden="true"
                  />
                  Mengekstrak dengan AI...
                </>
              ) : (
                "Ekstrak dengan AI"
              )}
            </button>

            <button
              type="button"
              onClick={() => void handleNormalizeLocations()}
              disabled={isBusy}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-800 transition-colors hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isNormalizing ? "Menormalisasi lokasi..." : "Normalisasi Lokasi"}
            </button>

            <button
              type="button"
              onClick={() => void handleGeocodeAll()}
              disabled={isBusy || pendingGeocodeCount === 0}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-4 py-2.5 text-sm font-semibold text-teal-800 transition-colors hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isGeocoding
                ? "Bisa memakan waktu ~1 detik per lokasi..."
                : "Geocode Semua Lokasi"}
            </button>
          </div>
          {pendingGeocodeCount > 0 && (
            <p className="mt-3 text-xs text-zinc-500">
              {pendingGeocodeCount} lokasi belum punya koordinat (~1 detik/lokasi
              untuk Nominatim).
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-base font-semibold text-zinc-900">Data Flyer</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Submit: {formatSubmitDate(flyer.created_at)}
            {flyer.reviewed_at
              ? ` · Direview: ${formatSubmitDate(flyer.reviewed_at)}`
              : ""}
          </p>

          <div className="mt-5 space-y-4">
            <div>
              <label
                htmlFor="tanggal_pemadaman"
                className="block text-sm font-medium text-zinc-800"
              >
                Tanggal Pemadaman
              </label>
              <input
                id="tanggal_pemadaman"
                type="date"
                value={form.tanggal_pemadaman}
                onChange={(event) =>
                  handleFieldChange("tanggal_pemadaman", event.target.value)
                }
                disabled={isBusy}
                className="mt-1.5 block w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm text-zinc-900 outline-none ring-blue-500 focus:border-blue-500 focus:ring-2 disabled:cursor-not-allowed disabled:bg-zinc-50"
              />
            </div>

            <div>
              <label
                htmlFor="waktu_pemadaman"
                className="block text-sm font-medium text-zinc-800"
              >
                Waktu Pemadaman
              </label>
              <input
                id="waktu_pemadaman"
                type="text"
                value={form.waktu_pemadaman}
                onChange={(event) =>
                  handleFieldChange("waktu_pemadaman", event.target.value)
                }
                disabled={isBusy}
                placeholder="08:00 - 14:00 WITA"
                className="mt-1.5 block w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm text-zinc-900 outline-none ring-blue-500 focus:border-blue-500 focus:ring-2 disabled:cursor-not-allowed disabled:bg-zinc-50"
              />
            </div>

            <div>
              <label
                htmlFor="unit_pelaksana"
                className="block text-sm font-medium text-zinc-800"
              >
                Unit Pelaksana
              </label>
              <input
                id="unit_pelaksana"
                type="text"
                value={form.unit_pelaksana}
                onChange={(event) =>
                  handleFieldChange("unit_pelaksana", event.target.value)
                }
                disabled={isBusy}
                placeholder="PLN ULP Banjarbaru"
                className="mt-1.5 block w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm text-zinc-900 outline-none ring-blue-500 focus:border-blue-500 focus:ring-2 disabled:cursor-not-allowed disabled:bg-zinc-50"
              />
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={() => void handleSaveChanges()}
              disabled={isBusy}
              className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              {isSaving ? "Menyimpan..." : "Simpan Perubahan"}
            </button>

            <button
              type="button"
              onClick={() => void handleStatusUpdate("approved")}
              disabled={isBusy}
              className="rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-green-300"
            >
              {isUpdatingStatus ? "Memproses..." : "Approve"}
            </button>

            <button
              type="button"
              onClick={() => void handleStatusUpdate("rejected")}
              disabled={isBusy}
              className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
            >
              Reject
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-base font-semibold text-zinc-900">
            Lokasi Terdampak
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            {totalLocations > 0
              ? `${totalLocations} lokasi dari hasil ekstraksi`
              : "Belum ada lokasi. Gunakan tombol Ekstrak dengan AI."}
          </p>

          {sessions.length > 0 && (
            <div className="mt-4 space-y-4">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="rounded-xl border border-zinc-200 bg-zinc-50 p-4"
                >
                  <p className="text-sm font-medium text-zinc-800">
                    Sesi {session.sesi_ke}
                    {session.waktu_spesifik
                      ? ` · ${session.waktu_spesifik}`
                      : ""}
                  </p>
                  {session.locations && session.locations.length > 0 ? (
                    <ul className="mt-2 space-y-2">
                      {session.locations.map((location) => {
                        const hasCoordinates =
                          location.lat !== null && location.lng !== null;
                        const isFailedGeocode =
                          !hasCoordinates && geocodeCompleted;

                        return (
                          <li
                            key={location.id}
                            className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <span>{location.nama_raw}</span>
                            <div className="flex flex-col items-start gap-1 sm:items-end">
                              {hasCoordinates ? (
                                <>
                                  <span className="text-xs text-zinc-500">
                                    {location.lat?.toFixed(5)},{" "}
                                    {location.lng?.toFixed(5)}
                                  </span>
                                  <GeocodeSourceBadge
                                    source={location.geocode_source}
                                  />
                                </>
                              ) : isFailedGeocode ? (
                                <span className="inline-flex w-fit rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                                  Gagal di-geocode
                                </span>
                              ) : (
                                <span className="text-xs text-zinc-400">
                                  Belum di-geocode
                                </span>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-zinc-500">
                      Tidak ada lokasi di sesi ini.
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {totalLocations > 0 && geocodeSummary && (
            <p className="mt-4 border-t border-zinc-200 pt-4 text-sm text-zinc-700">
              Ringkasan geocode: {geocodeSummary.berhasil} berhasil (
              {geocodeSummary.dariCache} cache, {geocodeSummary.dariNominatim}{" "}
              Nominatim, {geocodeSummary.dariEstimasiAi} estimasi AI),{" "}
              {geocodeSummary.gagal} gagal.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
