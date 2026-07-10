export const IMPACT_CATEGORIES = [
  "Usaha berhenti",
  "Makanan/kulkas rusak",
  "WFH terganggu",
  "Anak sekolah online",
  "Alat medis/kesehatan",
  "Lainnya",
] as const;

export type ImpactCategory = (typeof IMPACT_CATEGORIES)[number];

export const MAX_IMPACT_COMMENT_LENGTH = 300;

export function formatImpactCommentBadge(
  namaArea: string,
  nomorKomentar: number,
): string {
  return `[Warga][${namaArea}][#${nomorKomentar}]`;
}
