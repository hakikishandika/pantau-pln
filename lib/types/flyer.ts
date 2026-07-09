export type FlyerStatus = "pending" | "approved" | "rejected";

export interface Flyer {
  id: string;
  image_url: string;
  submitted_by_ip: string | null;
  status: FlyerStatus;
  tanggal_pemadaman: string | null;
  waktu_pemadaman: string | null;
  unit_pelaksana: string | null;
  raw_ai_response: unknown | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

export type FlyerFilter = "all" | FlyerStatus;
