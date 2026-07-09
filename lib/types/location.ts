export interface Location {
  id: string;
  session_id: string;
  nama_raw: string;
  nama_normalized: string | null;
  lat: number | null;
  lng: number | null;
  geocode_source: string | null;
  geocode_confidence: string | null;
}

export interface OutageSessionWithLocations {
  id: string;
  flyer_id: string;
  sesi_ke: number;
  waktu_spesifik: string | null;
  locations: Location[];
}
