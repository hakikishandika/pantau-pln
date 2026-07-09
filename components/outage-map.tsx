"use client";

import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";

import { formatHoursLabel } from "@/lib/duration";
import type { MapLocationPoint } from "@/lib/types/public-map";

import "leaflet/dist/leaflet.css";

const BANJARBARU_CENTER: [number, number] = [-3.4409, 114.8375];
const DEFAULT_ZOOM = 12;

function createMarkerIcon(color: string) {
  return L.divIcon({
    className: "",
    html: `<div style="background:${color};width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.35);"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -8],
  });
}

const nominatimIcon = createMarkerIcon("#16a34a");
const estimateIcon = createMarkerIcon("#eab308");

function getMarkerIcon(geocodeSource: string | null) {
  if (geocodeSource === "claude_estimate") {
    return estimateIcon;
  }
  return nominatimIcon;
}

interface OutageMapProps {
  points: MapLocationPoint[];
}

export default function OutageMap({ points }: OutageMapProps) {
  return (
    <MapContainer
      center={BANJARBARU_CENTER}
      zoom={DEFAULT_ZOOM}
      scrollWheelZoom
      className="h-full w-full rounded-2xl"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {points.map((point) => (
        <Marker
          key={point.id}
          position={[point.lat, point.lng]}
          icon={getMarkerIcon(point.geocode_source)}
        >
          <Popup>
            <div className="space-y-1 text-sm">
              <p className="font-semibold text-zinc-900">{point.nama}</p>
              <p>
                <span className="font-medium">Jumlah sesi:</span>{" "}
                {point.jumlah_sesi}
              </p>
              <p>
                <span className="font-medium">Total jam:</span>{" "}
                {formatHoursLabel(point.total_jam)}
              </p>
              {point.geocode_source === "claude_estimate" && (
                <p className="text-xs text-amber-700">
                  Lokasi perkiraan, mungkin kurang presisi
                </p>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
