"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Autocomplete, Circle, GoogleMap, useJsApiLoader } from "@react-google-maps/api";
import { MapPin, Search } from "lucide-react";
import AdvancedMarker from "./AdvancedMarker";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
const LOADER_ID = "qarego-admin-maps";
const LIBRARIES: ("marker" | "places")[] = ["marker", "places"];
const DEFAULT_CENTER = { lat: 5.6037, lng: -0.187 };

export type ZoneCenter = {
  lat: number;
  lng: number;
  address?: string;
};

interface ServiceZoneMapPickerProps {
  value: ZoneCenter | null;
  address: string;
  radiusKm: number;
  onLocationChange: (loc: ZoneCenter | null) => void;
  onAddressChange: (address: string) => void;
  mapHeight?: number;
}

export default function ServiceZoneMapPicker({
  value,
  address,
  radiusKm,
  onLocationChange,
  onAddressChange,
  mapHeight = 280,
}: ServiceZoneMapPickerProps) {
  const { isLoaded } = useJsApiLoader({
    id: LOADER_ID,
    googleMapsApiKey: MAPS_KEY,
    libraries: LIBRARIES,
  });

  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [searchText, setSearchText] = useState(address);

  useEffect(() => {
    setSearchText(address);
  }, [address]);

  useEffect(() => {
    if (isLoaded && !geocoderRef.current) {
      geocoderRef.current = new google.maps.Geocoder();
    }
  }, [isLoaded]);

  useEffect(() => {
    if (!map || !value) return;
    map.panTo({ lat: value.lat, lng: value.lng });
    const zoom = radiusKm <= 3 ? 13 : radiusKm <= 10 ? 12 : radiusKm <= 25 ? 11 : 10;
    map.setZoom(zoom);
  }, [map, value?.lat, value?.lng, radiusKm]);

  const reverseGeocode = useCallback(
    (lat: number, lng: number) => {
      const geocoder = geocoderRef.current;
      if (!geocoder) {
        onLocationChange({ lat, lng, address });
        return;
      }
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === "OK" && results?.[0]?.formatted_address) {
          const formatted = results[0].formatted_address;
          onAddressChange(formatted);
          setSearchText(formatted);
          onLocationChange({ lat, lng, address: formatted });
        } else {
          onLocationChange({ lat, lng, address });
        }
      });
    },
    [onAddressChange, onLocationChange, address]
  );

  const onPlaceChanged = () => {
    const ac = autocompleteRef.current;
    if (!ac) return;
    const place = ac.getPlace();
    const loc = place.geometry?.location;
    if (!loc) return;
    const lat = loc.lat();
    const lng = loc.lng();
    const formatted = place.formatted_address || searchText;
    onAddressChange(formatted);
    setSearchText(formatted);
    onLocationChange({ lat, lng, address: formatted });
  };

  const onMapPick = (lat: number, lng: number) => {
    onLocationChange({ lat, lng, address });
    reverseGeocode(lat, lng);
  };

  if (!MAPS_KEY) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to pick zone centers on the map.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>Search address</Label>
        {isLoaded ? (
          <Autocomplete
            onLoad={(ac) => {
              autocompleteRef.current = ac;
            }}
            onPlaceChanged={onPlaceChanged}
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                className="pl-9"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search town, depot, or landmark…"
              />
            </div>
          </Autocomplete>
        ) : (
          <Input disabled placeholder="Loading maps…" />
        )}
      </div>

      {isLoaded ? (
        <div className="w-full rounded-lg overflow-hidden border border-gray-200" style={{ height: mapHeight }}>
          <GoogleMap
            mapContainerStyle={{ width: "100%", height: "100%" }}
            center={value ? { lat: value.lat, lng: value.lng } : DEFAULT_CENTER}
            zoom={12}
            onLoad={setMap}
            onClick={(e) => {
              if (e.latLng) onMapPick(e.latLng.lat(), e.latLng.lng());
            }}
            options={{
              streetViewControl: false,
              mapTypeControl: false,
              fullscreenControl: true,
              mapId: "DEMO_MAP_ID",
            }}
          >
            {value ? (
              <>
                <AdvancedMarker
                  position={{ lat: value.lat, lng: value.lng }}
                  title="Zone center"
                />
                <Circle
                  center={{ lat: value.lat, lng: value.lng }}
                  radius={Math.max(100, radiusKm * 1000)}
                  options={{
                    fillColor: "#2563eb",
                    fillOpacity: 0.15,
                    strokeColor: "#2563eb",
                    strokeOpacity: 0.7,
                    strokeWeight: 2,
                    clickable: false,
                  }}
                />
              </>
            ) : null}
          </GoogleMap>
        </div>
      ) : (
        <div className="w-full bg-gray-100 rounded-lg animate-pulse" style={{ height: mapHeight }} />
      )}

      <p className="text-xs text-gray-500 flex items-start gap-1.5">
        <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        {value
          ? value.address || `Pinned at ${value.lat.toFixed(5)}, ${value.lng.toFixed(5)} · ${radiusKm} km radius`
          : "Tap the map or search to set the zone center."}
      </p>
    </div>
  );
}
