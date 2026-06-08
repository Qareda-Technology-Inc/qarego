
import { useEffect, useRef } from "react";
import { useGoogleMap } from "@react-google-maps/api";

interface AdvancedMarkerProps {
  position: google.maps.LatLngLiteral;
  title?: string;
}

function validPosition(p: google.maps.LatLngLiteral) {
  return (
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lng) &&
    !(p.lat === 0 && p.lng === 0)
  );
}

export default function AdvancedMarker({ position, title }: AdvancedMarkerProps) {
  const map = useGoogleMap();
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const ok = validPosition(position);

  useEffect(() => {
    if (!map || !ok) return;

    if (!markerRef.current) {
      markerRef.current = new google.maps.marker.AdvancedMarkerElement({
        map,
        position,
        title,
      });
    } else {
      markerRef.current.map = map;
      markerRef.current.position = position;
      markerRef.current.title = title || "";
    }

    return () => {
      if (markerRef.current) {
        markerRef.current.map = null;
        markerRef.current = null;
      }
    };
  }, [map, ok, position.lat, position.lng, title, position]);

  if (!ok) return null;
  return null;
}
