import Anthropic from "@anthropic-ai/sdk";

import { createSupabaseAdminClient } from "@/lib/supabase";
import type { ImpactComment } from "@/lib/types/impact-comment";
import type { ReportSummary } from "@/lib/types/report-summary";

const CLAUDE_TEXT_MODEL = "claude-sonnet-4-5-20250929";

const SUMMARY_SYSTEM_PROMPT = `Kamu meringkas keluhan warga soal dampak pemadaman listrik. Dari daftar komentar berikut, hasilkan: (1) summary_text: ringkasan naratif 2-4 kalimat tema utama keluhan, (2) category_breakdown: object hitungan tiap kategori dampak, (3) estimated_total_loss_idr: jumlahkan semua angka kerugian rupiah yang disebutkan (format ribu/rb/juta/Rp/angka biasa), abaikan angka bukan soal kerugian uang, 0 jika tidak ada. Kembalikan HANYA JSON: {"summary_text": string, "category_breakdown": object, "estimated_total_loss_idr": number}`;

export class SummaryParseError extends Error {
  constructor(
    message: string,
    public readonly debugRawResponse?: string,
  ) {
    super(message);
    this.name = "SummaryParseError";
  }
}

interface ClaudeSummaryResult {
  summary_text: string;
  category_breakdown: Record<string, number>;
  estimated_total_loss_idr: number;
}

function stripMarkdownJson(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) {
    return fenced[1].trim();
  }
  return trimmed;
}

export function parseSummaryResponse(raw: string): ClaudeSummaryResult {
  const cleaned = stripMarkdownJson(raw);

  let data: unknown;
  try {
    data = JSON.parse(cleaned);
  } catch {
    throw new SummaryParseError(
      "Gagal parse JSON ringkasan dari AI.",
      raw,
    );
  }

  if (!data || typeof data !== "object") {
    throw new SummaryParseError(
      "Gagal parse JSON ringkasan dari AI: format tidak valid.",
      raw,
    );
  }

  const record = data as Record<string, unknown>;
  const summaryText = String(record.summary_text ?? "").trim();
  const categoryBreakdown =
    record.category_breakdown &&
    typeof record.category_breakdown === "object" &&
    !Array.isArray(record.category_breakdown)
      ? Object.fromEntries(
          Object.entries(record.category_breakdown as Record<string, unknown>).map(
            ([key, value]) => [key, Number(value) || 0],
          ),
        )
      : {};
  const estimatedLoss = Number(record.estimated_total_loss_idr) || 0;

  if (!summaryText) {
    throw new SummaryParseError(
      "Gagal parse JSON ringkasan dari AI: summary_text kosong.",
      raw,
    );
  }

  return {
    summary_text: summaryText,
    category_breakdown: categoryBreakdown,
    estimated_total_loss_idr: estimatedLoss,
  };
}

export interface GenerateSummaryResult {
  summary: ReportSummary;
  processedCount: number;
}

export async function generateDailySummary(): Promise<GenerateSummaryResult> {
  const supabase = createSupabaseAdminClient();
  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - 24 * 60 * 60 * 1000);

  const { data: comments, error: commentsError } = await supabase
    .from("impact_comments")
    .select("id, flyer_id, nama_area, kategori, komentar, nomor_komentar, created_at")
    .gte("created_at", periodStart.toISOString())
    .lte("created_at", periodEnd.toISOString())
    .order("created_at", { ascending: true });

  if (commentsError) {
    throw new Error(
      `Gagal mengambil komentar dampak: ${commentsError.message}`,
    );
  }

  const commentRows = (comments ?? []) as ImpactComment[];
  const totalKomentar = commentRows.length;

  let summaryText = "Belum ada keluhan warga dalam 24 jam terakhir";
  let categoryBreakdown: Record<string, number> = {};
  let estimatedTotalLossIdr = 0;

  if (totalKomentar > 0) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY belum dikonfigurasi di server.");
    }

    const anthropic = new Anthropic({ apiKey });
    const payload = commentRows.map((comment) => ({
      nama_area: comment.nama_area,
      kategori: comment.kategori,
      komentar: comment.komentar,
      nomor_komentar: comment.nomor_komentar,
      created_at: comment.created_at,
    }));

    const message = await anthropic.messages.create({
      model: CLAUDE_TEXT_MODEL,
      max_tokens: 2048,
      system: SUMMARY_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: JSON.stringify(payload),
        },
      ],
    });

    const textContent = message.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    if (!textContent) {
      throw new Error("Claude API tidak mengembalikan teks respons.");
    }

    const parsed = parseSummaryResponse(textContent);
    summaryText = parsed.summary_text;
    categoryBreakdown = parsed.category_breakdown;
    estimatedTotalLossIdr = parsed.estimated_total_loss_idr;
  }

  const { data: inserted, error: insertError } = await supabase
    .from("report_summaries")
    .insert({
      summary_text: summaryText,
      category_breakdown: categoryBreakdown,
      estimated_total_loss_idr: estimatedTotalLossIdr,
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
      total_komentar: totalKomentar,
    })
    .select("*")
    .single();

  if (insertError || !inserted) {
    throw new Error(
      `Gagal menyimpan ringkasan: ${insertError?.message ?? "unknown error"}`,
    );
  }

  return {
    summary: inserted as ReportSummary,
    processedCount: totalKomentar,
  };
}
