export interface ReportSummary {
  id: string;
  summary_text: string;
  category_breakdown: Record<string, number>;
  estimated_total_loss_idr: number;
  period_start: string;
  period_end: string;
  total_komentar: number;
  generated_at: string;
}
