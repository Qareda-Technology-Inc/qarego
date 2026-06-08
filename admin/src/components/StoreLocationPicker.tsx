"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Autocomplete, useJsApiLoader } from "@react-google-maps/api";
import { MapPin, Search } from "lucide-react";
import AdminMap from "./AdminMap";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
const LOADER_ID = "qarego-admin-maps";
const LIBRARIES: ("marker" | "places")[] = ["marker", "places"];
const DEFAULT_CENTER = { lat: 5.6037, lng: -0.187 };

export type StoreLocation = {
  lat: number;
  lng: number;
  address?: string;
};

interface StoreLocationPickerProps {
  value: StoreLocation | null;
  address: string;
  onLocationChange: (loc: StoreLocation | null) => void;
  onAddressChange: (address: string) => void;
  mapHeight?: number;
}

export default function StoreLocationPicker({
  value,
  address,
  onLocationChange,
  onAddressChange,
  mapHeight = 240,
}: StoreLocationPickerProps) {
  const { isLoaded } = useJsApiLoader({
    id: LOADER_ID,
    googleMapsApiKey: MAPS_KEY,
    libraries: LIBRARIES,
  });

  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const [searchText, setSearchText] = useState(address);

  useEffect(() => {
    setSearchText(address);
  }, [address]);

  useEffect(() => {
    if (isLoaded && !geocoderRef.current) {
      geocoderRef.current = new google.maps.Geocoder();
    }
  }, [isLoaded]);

  const reverseGeocode = useCallback(
    (lat: number, lng: number) => {
      const geocoder = geocoderRef.current;
      if (!geocoder) return;
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
    const formatted = place.formatted_address || place.name || searchText;
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
      <div className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500">
        Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to enable location search and map picking.
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div
        className="w-full bg-gray-100 rounded-lg animate-pulse"
        style={{ height: mapHeight + 56 }}
      />
    );
  }

  const markers = value
    ? [{ position: { lat: value.lat, lng: value.lng }, title: "Store location" }]
    : [];

  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="location-search" className="flex items-center gap-1 mb-1.5">
          <Search className="h-4 w-4 text-indigo-500" />
          Search address
        </Label>
        <Autocomplete
          onLoad={(ac) => {
            autocompleteRef.current = ac;
          }}
          onPlaceChanged={onPlaceChanged}
          options={{
            componentRestrictions: { country: "gh" },
            fields: ["formatted_address", "geometry", "name"],
          }}
        >
          <Input
            id="location-search"
            value={searchText}
            onChange={(e) => {
              setSearchText(e.target.value);
              onAddressChange(e.target.value);
            }}
            placeholder="Search street, area, or landmark…"
            className="w-full"
          />
        </Autocomplete>
        <p className="text-xs text-gray-400 mt-1">
          Pick from search results, or tap the map below to drop a pin.
        </p>
      </div>

      <div>
        <Label className="flex items-center gap-1 mb-1.5">
          <MapPin className="h-4 w-4 text-indigo-500" />
          Map
        </Label>
        <AdminMap
          markers={markers}
          height={mapHeight}
          zoom={value ? 16 : 13}
          center={value ? { lat: value.lat, lng: value.lng } : DEFAULT_CENTER}
          onPick={onMapPick}
        />
        {value ? (
          <p className="text-xs text-gray-500 mt-1 break-all">
            {value.address || `Pinned at ${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}`}
          </p>
        ) : (
          <p className="text-xs text-amber-600 mt-1">Select a location to continue.</p>
        )}
      </div>
    </div>
  );
}
