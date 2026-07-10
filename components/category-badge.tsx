import { getCategoryBadgeClass } from "@/lib/category-badge-styles";

export function CategoryBadge({ category }: { category: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${getCategoryBadgeClass(category)}`}
    >
      {category}
    </span>
  );
}
