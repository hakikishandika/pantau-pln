"use client";

import { useEffect, useRef, useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const ACCEPT_ATTR = ACCEPTED_TYPES.join(",");
const BUCKET_NAME = "flyer-images";

type FormStatus = "idle" | "loading" | "success" | "error";
type ProgressPhase = "upload" | "process";

interface FilePreview {
  file: File;
  url: string;
}

interface ProcessFlyerResponse {
  status: "success" | "error";
  auto_approved?: boolean;
  message?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function validateFile(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type as (typeof ACCEPTED_TYPES)[number])) {
    return `Format "${file.name}" tidak didukung. Gunakan JPG, PNG, atau WebP.`;
  }
  if (file.size > MAX_FILE_SIZE) {
    return `File "${file.name}" melebihi batas maksimal 10MB.`;
  }
  return null;
}

function getFileExtension(file: File): string {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && ["jpg", "jpeg", "png", "webp"].includes(fromName)) {
    return fromName === "jpeg" ? "jpg" : fromName;
  }

  const mimeMap: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  return mimeMap[file.type] ?? "jpg";
}

export default function SubmitPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewsRef = useRef<FilePreview[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<FilePreview[]>([]);
  const [status, setStatus] = useState<FormStatus>("idle");
  const [progressPhase, setProgressPhase] = useState<ProgressPhase>("upload");
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [successCount, setSuccessCount] = useState(0);
  const [autoApproved, setAutoApproved] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    previewsRef.current = previews;
  }, [previews]);

  useEffect(() => {
    return () => {
      for (const preview of previewsRef.current) {
        URL.revokeObjectURL(preview.url);
      }
    };
  }, []);

  function clearPreviews() {
    for (const preview of previews) {
      URL.revokeObjectURL(preview.url);
    }
    setPreviews([]);
  }

  function resetForm() {
    setSelectedFiles([]);
    clearPreviews();
    setErrorMessage(null);
    setStatus("idle");
    setProgress({ current: 0, total: 0 });
    setProgressPhase("upload");
    setSuccessCount(0);
    setAutoApproved(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    setErrorMessage(null);
    setStatus("idle");
    clearPreviews();

    if (files.length === 0) {
      setSelectedFiles([]);
      return;
    }

    for (const file of files) {
      const validationError = validateFile(file);
      if (validationError) {
        setSelectedFiles([]);
        setErrorMessage(validationError);
        event.target.value = "";
        return;
      }
    }

    const nextPreviews = files.map((file) => ({
      file,
      url: URL.createObjectURL(file),
    }));

    setSelectedFiles(files);
    setPreviews(nextPreviews);
  }

  async function processFlyer(flyerId: string): Promise<ProcessFlyerResponse> {
    const response = await fetch("/api/process-flyer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flyerId }),
    });

    const payload = (await response.json()) as ProcessFlyerResponse;
    return payload;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    if (selectedFiles.length === 0) {
      setErrorMessage("Pilih minimal satu foto flyer.");
      setStatus("error");
      return;
    }

    for (const file of selectedFiles) {
      const validationError = validateFile(file);
      if (validationError) {
        setErrorMessage(validationError);
        setStatus("error");
        return;
      }
    }

    setStatus("loading");
    setProgressPhase("upload");
    setProgress({ current: 0, total: selectedFiles.length });

    const uploadedFlyerIds: string[] = [];
    let lastAutoApproved = false;

    try {
      const supabase = createSupabaseBrowserClient();

      for (let index = 0; index < selectedFiles.length; index += 1) {
        const file = selectedFiles[index];
        setProgress({ current: index + 1, total: selectedFiles.length });

        const extension = getFileExtension(file);
        const filePath = `${crypto.randomUUID()}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(filePath, file, {
            contentType: file.type,
            upsert: false,
          });

        if (uploadError) {
          throw new Error(
            uploadError.message.includes("Payload too large")
              ? `File "${file.name}" melebihi batas maksimal 10MB.`
              : `Gagal mengunggah "${file.name}": ${uploadError.message}`,
          );
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);

        const { data: insertedFlyer, error: insertError } = await supabase
          .from("flyers")
          .insert({
            image_url: publicUrl,
            status: "pending",
          })
          .select("id")
          .single();

        if (insertError || !insertedFlyer) {
          throw new Error(
            `Gagal menyimpan data flyer "${file.name}": ${insertError?.message ?? "unknown error"}`,
          );
        }

        uploadedFlyerIds.push(insertedFlyer.id);
      }

      setProgressPhase("process");
      setProgress({ current: 0, total: uploadedFlyerIds.length });

      for (let index = 0; index < uploadedFlyerIds.length; index += 1) {
        const flyerId = uploadedFlyerIds[index];
        setProgress({ current: index + 1, total: uploadedFlyerIds.length });

        const result = await processFlyer(flyerId);
        if (result.status === "success" && result.auto_approved) {
          lastAutoApproved = true;
        }
      }

      setSuccessCount(uploadedFlyerIds.length);
      setAutoApproved(lastAutoApproved);
      setStatus("success");
      setSelectedFiles([]);
      clearPreviews();
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Koneksi gagal. Periksa internet Anda dan coba lagi.";
      setErrorMessage(message);
      setStatus("error");
    }
  }

  const isLoading = status === "loading";
  const isSuccess = status === "success";

  const successMessage = autoApproved
    ? `${successCount} flyer diproses dan langsung tayang`
    : `${successCount} flyer diproses, menunggu review singkat`;

  return (
    <main className="flex flex-1 flex-col bg-zinc-50 px-4 py-8 sm:px-6">
      <div className="mx-auto w-full max-w-md">
        <header className="mb-6 text-center">
          <h1 className="text-xl font-bold leading-tight text-zinc-900 sm:text-2xl">
            Laporkan Jadwal Pemadaman PLN
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-600 sm:text-base">
            Upload foto flyer/poster jadwal pemadaman dari WhatsApp Channel PLN
            ULP Banjarbaru
          </p>
        </header>

        {isSuccess ? (
          <div
            className="rounded-2xl border border-green-200 bg-green-50 p-6 text-center shadow-sm"
            role="status"
          >
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-6 w-6"
                aria-hidden="true"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <p className="font-medium text-green-800">{successMessage}</p>
            <button
              type="button"
              onClick={resetForm}
              className="mt-4 text-sm font-medium text-green-700 underline underline-offset-2 hover:text-green-900"
            >
              Kirim flyer lain
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6"
          >
            <label
              htmlFor="flyer-image"
              className="block text-sm font-medium text-zinc-800"
            >
              Foto flyer
            </label>
            <p className="mt-1 text-xs text-zinc-500">
              JPG, PNG, atau WebP — maks. 10MB per file. Bisa pilih banyak file.
            </p>

            <div className="mt-4">
              <input
                ref={fileInputRef}
                id="flyer-image"
                name="flyer-image"
                type="file"
                accept={ACCEPT_ATTR}
                multiple
                onChange={handleFileChange}
                disabled={isLoading}
                className="block w-full cursor-pointer text-sm text-zinc-600 file:mr-4 file:cursor-pointer file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            {selectedFiles.length > 0 && (
              <p className="mt-2 text-xs text-zinc-500">
                {selectedFiles.length} file dipilih
              </p>
            )}

            {previews.length > 0 && (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {previews.map((preview) => (
                  <div
                    key={preview.url}
                    className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={preview.url}
                      alt={`Preview ${preview.file.name}`}
                      className="aspect-square w-full object-cover"
                    />
                    <p className="truncate px-2 py-1 text-[10px] text-zinc-500">
                      {preview.file.name} ({formatFileSize(preview.file.size)})
                    </p>
                  </div>
                ))}
              </div>
            )}

            {errorMessage && (
              <div
                className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                role="alert"
              >
                {errorMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || selectedFiles.length === 0}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              {isLoading ? (
                <>
                  <span
                    className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
                    aria-hidden="true"
                  />
                  {progressPhase === "upload"
                    ? `Mengupload ${progress.current}/${progress.total}`
                    : `Memproses ${progress.current}/${progress.total}`}
                </>
              ) : (
                "Kirim Flyer"
              )}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
