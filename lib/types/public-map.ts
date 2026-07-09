export interface MapLocationPoint {
  id: string;
  lat: number;
  lng: number;
  nama: string;
  jumlah_sesi: number;
  total_jam: number;
  geocode_source: string | null;
}

export interface AggregatedLocation {
  nama: string;
  jumlah_sesi: number;
  total_jam: number;
  lat: number;
  lng: number;
  geocode_source: string | null;
}

export interface PublicFlyerLocation {
  id: string;
  nama_raw: string;
  nama_normalized: string | null;
  lat: number | null;
  lng: number | null;
  geocode_source: string | null;
}

export interface PublicOutageSession {
  id: string;
  sesi_ke: number;
  waktu_spesifik: string | null;
  locations: PublicFlyerLocation[];
}

export interface PublicApprovedFlyer {
  id: string;
  tanggal_pemadaman: string | null;
  waktu_pemadaman: string | null;
  unit_pelaksana: string | null;
  created_at: string;
  outage_sessions: PublicOutageSession[];
}
