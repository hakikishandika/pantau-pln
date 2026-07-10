export const VERIFICATION_STATUSES = ["padam", "tidak_padam"] as const;

export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export interface Verification {
  id: string;
  flyer_id: string;
  nama_area: string;
  status: VerificationStatus;
  created_at: string;
}

export interface VerificationTally {
  padam: number;
  tidakPadam: number;
}

export interface VerificationAreaRow {
  key: string;
  flyerId: string;
  namaArea: string;
  tanggal: string | null;
  waktu: string;
  unitPelaksana: string | null;
}
