"use client";

import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";

import { isNominatimSource } from "@/lib/geocode-cache";
import { formatHoursLabel } from "@/lib/duration";
import type { MapLocationPoint } from "@/lib/types/public-map";

import "leaflet/dist/leaflet.css";

const BANJARBARU_CENTER: [number, number] = [-3.4409, 114.8375];
const DEFAULT_ZOOM = 12;

const NOMINATIM_COLOR = "#22c55e";
const ESTIMATE_COLOR = "#eab308";

function getCircleRadius(totalJam: number): number {
  return Math.min(6 + Math.sqrt(Math.max(totalJam, 0)) * 5, 36);
}

function getCircleStyle(geocodeSource: string | null) {
  const isEstimate = geocodeSource === "claude_estimate";
  const color = isEstimate ? ESTIMATE_COLOR : NOMINATIM_COLOR;

  return {
    radius: 0,
    fillColor: color,
    color: "#ffffff",
    weight: 2,
    fillOpacity: 0.75,
  };
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
      {points.map((point) => {
        const style = getCircleStyle(point.geocode_source);
        const radius = getCircleRadius(point.total_jam);

        return (
          <CircleMarker
            key={point.id}
            center={[point.lat, point.lng]}
            radius={radius}
            pathOptions={{
              fillColor: style.fillColor,
              color: style.color,
              weight: style.weight,
              fillOpacity: style.fillOpacity,
            }}
          >
            <Popup>
              <div className="space-y-1 text-sm">
                <p className="font-semibold text-gray-900">{point.nama}</p>
                <p>
                  <span className="font-medium">Jumlah kejadian:</span>{" "}
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
                {isNominatimSource(point.geocode_source) &&
                  point.geocode_source !== "nominatim" && (
                    <p className="text-xs text-green-700">
                      Sumber: {point.geocode_source}
                    </p>
                  )}
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
