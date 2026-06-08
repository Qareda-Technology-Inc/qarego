"use client";

import { GoogleMap, useJsApiLoader } from "@react-google-maps/api";
import { useEffect, useState } from "react";
import AdvancedMarker from "./AdvancedMarker";

export interface MapMarker {
  position: google.maps.LatLngLiteral;
  title?: string;
}

interface AdminMapProps {
  markers: MapMarker[];
  height?: number;
  zoom?: number;
  center?: google.maps.LatLngLiteral;
  onPick?: (lat: number, lng: number) => void;
}

const LIBRARIES: ("marker" | "places")[] = ["marker", "places"];
const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

export default function AdminMap({
  markers,
  height = 220,
  zoom = 14,
  center: centerOverride,
  onPick,
}: AdminMapProps) {
  const { isLoaded } = useJsApiLoader({
    id: "qarego-admin-maps",
    googleMapsApiKey: MAPS_KEY,
    libraries: LIBRARIES,
  });

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const center = centerOverride || markers[0]?.position || { lat: 5.6037, lng: -0.187 };

  useEffect(() => {
    if (!map) return;
    if (centerOverride && onPick) {
      map.panTo(centerOverride);
      map.setZoom(zoom);
      return;
    }
    if (markers.length === 0) return;
    if (onPick && !centerOverride) return;
    if (markers.length === 1) {
      map.setCenter(markers[0].position);
      map.setZoom(zoom);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    markers.forEach((m) => bounds.extend(m.position));
    map.fitBounds(bounds, 48);
  }, [map, markers, zoom, onPick, centerOverride]);

  if (!MAPS_KEY) {
    return (
      <div
        className="w-full flex items-center justify-center bg-gray-100 rounded-lg text-xs text-gray-400"
        style={{ height }}
      >
        Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to show the map
      </div>
    );
  }

  if (!isLoaded) {
    return <div className="w-full bg-gray-100 rounded-lg animate-pulse" style={{ height }} />;
  }

  return (
    <div className="w-full rounded-lg overflow-hidden" style={{ height }}>
      <GoogleMap
        mapContainerStyle={{ width: "100%", height: "100%" }}
        center={center}
        zoom={zoom}
        onLoad={setMap}
        onClick={(e) => {
          if (onPick && e.latLng) onPick(e.latLng.lat(), e.latLng.lng());
        }}
        options={{
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: true,
          mapId: "DEMO_MAP_ID",
        }}
      >
        {markers.map((m, i) => (
          <AdvancedMarker key={`${m.title}-${i}`} position={m.position} title={m.title} />
        ))}
      </GoogleMap>
    </div>
  );
}
