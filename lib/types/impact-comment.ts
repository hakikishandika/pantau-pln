export interface ImpactComment {
  id: string;
  flyer_id: string;
  nama_area: string;
  kategori: string[];
  komentar: string;
  nomor_komentar: number;
  created_at: string;
}

export interface ImpactCommentWithFlyer extends ImpactComment {
  flyers: {
    tanggal_pemadaman: string | null;
    unit_pelaksana: string | null;
  } | null;
}
