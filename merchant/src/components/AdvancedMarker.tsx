
import { useEffect, useRef } from 'react';
import { useGoogleMap } from '@react-google-maps/api';

interface AdvancedMarkerProps {
  position: google.maps.LatLngLiteral;
  title?: string;
}

export default function AdvancedMarker({ position, title }: AdvancedMarkerProps) {
  const map = useGoogleMap();
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);

  useEffect(() => {
    if (map && !markerRef.current) {
      // Create marker
      markerRef.current = new google.maps.marker.AdvancedMarkerElement({
        map,
        position,
        title,
      });
    }

    // Cleanup
    return () => {
      if (markerRef.current) {
        markerRef.current.map = null;
        markerRef.current = null;
      }
    };
  }, [map]);

  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.position = position;
      markerRef.current.title = title || '';
    }
  }, [position, title]);

  return null;
}
