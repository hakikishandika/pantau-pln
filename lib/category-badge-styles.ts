import type { ImpactCategory } from "@/lib/impact-comments";

const CATEGORY_STYLES: Record<ImpactCategory, string> = {
  "Usaha berhenti": "bg-orange-500/20 text-orange-400",
  "Makanan/kulkas rusak": "bg-red-500/20 text-red-400",
  "WFH terganggu": "bg-blue-500/20 text-blue-400",
  "Anak sekolah online": "bg-purple-500/20 text-purple-400",
  "Alat medis/kesehatan": "bg-pink-500/20 text-pink-400",
  Lainnya: "bg-gray-500/20 text-gray-400",
};

export function getCategoryBadgeClass(category: string): string {
  return (
    CATEGORY_STYLES[category as ImpactCategory] ??
    "bg-gray-500/20 text-gray-400"
  );
}
