import { getAutoApprove } from "@/lib/app-settings";
import { extractFlyer, FlyerExtractError } from "@/lib/flyer-extract";
import { geocodeFlyer, FlyerGeocodeError } from "@/lib/flyer-geocode";
import { FlyerNormalizeError, normalizeFlyer } from "@/lib/flyer-normalize";
import { createSupabaseAdminClient } from "@/lib/supabase";

export type ProcessFlyerStep = "extract" | "normalize" | "geocode";

export interface ProcessFlyerResult {
  success: boolean;
  autoApproved: boolean;
  status: "approved" | "pending";
  failedStep?: ProcessFlyerStep;
  error?: string;
  geocode?: {
    berhasil: number;
    gagal: number;
    dari_cache: number;
    dari_nominatim: number;
    dari_estimasi_ai: number;
  };
}

async function setProcessingError(
  flyerId: string,
  message: string,
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  await supabase
    .from("flyers")
    .update({
      processing_error: message,
      status: "pending",
    })
    .eq("id", flyerId);
}

async function finalizeFlyer(
  flyerId: string,
  autoApproved: boolean,
): Promise<"approved" | "pending"> {
  const supabase = createSupabaseAdminClient();

  if (autoApproved) {
    await supabase
      .from("flyers")
      .update({
        status: "approved",
        reviewed_at: new Date().toISOString(),
        processing_error: null,
      })
      .eq("id", flyerId);
    return "approved";
  }

  await supabase
    .from("flyers")
    .update({
      status: "pending",
      processing_error: null,
    })
    .eq("id", flyerId);
  return "pending";
}

export async function processFlyer(flyerId: string): Promise<ProcessFlyerResult> {
  const supabase = createSupabaseAdminClient();

  const { data: flyer, error: flyerError } = await supabase
    .from("flyers")
    .select("id, image_url")
    .eq("id", flyerId)
    .single();

  if (flyerError || !flyer) {
    return {
      success: false,
      autoApproved: false,
      status: "pending",
      error: "Flyer tidak ditemukan.",
    };
  }

  const imageUrl = flyer.image_url?.trim();
  if (!imageUrl) {
    const message = "Flyer tidak memiliki URL gambar.";
    await setProcessingError(flyerId, message);
    return {
      success: false,
      autoApproved: false,
      status: "pending",
      failedStep: "extract",
      error: message,
    };
  }

  try {
    await extractFlyer(flyerId, imageUrl);
  } catch (error) {
    const message =
      error instanceof FlyerExtractError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Gagal mengekstrak data flyer.";
    await setProcessingError(flyerId, `Ekstraksi: ${message}`);
    return {
      success: false,
      autoApproved: false,
      status: "pending",
      failedStep: "extract",
      error: message,
    };
  }

  try {
    await normalizeFlyer(flyerId);
  } catch (error) {
    const message =
      error instanceof FlyerNormalizeError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Gagal menormalisasi lokasi.";
    await setProcessingError(flyerId, `Normalisasi: ${message}`);
    return {
      success: false,
      autoApproved: false,
      status: "pending",
      failedStep: "normalize",
      error: message,
    };
  }

  let geocodeResult;
  try {
    geocodeResult = await geocodeFlyer(flyerId);
  } catch (error) {
    const message =
      error instanceof FlyerGeocodeError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Gagal melakukan geocoding.";
    await setProcessingError(flyerId, `Geocoding: ${message}`);
    return {
      success: false,
      autoApproved: false,
      status: "pending",
      failedStep: "geocode",
      error: message,
    };
  }

  const autoApproved = await getAutoApprove();
  const status = await finalizeFlyer(flyerId, autoApproved);

  return {
    success: true,
    autoApproved,
    status,
    geocode: geocodeResult,
  };
}
