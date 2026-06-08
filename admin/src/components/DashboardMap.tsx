"use client";

import { GoogleMap, useJsApiLoader } from "@react-google-maps/api";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AdvancedMarker from "./AdvancedMarker";
import { fetcher } from "@/lib/api";
import { Car, MapPin, Loader2, RefreshCw } from "lucide-react";

const LIBRARIES: ("marker")[] = ["marker"];
const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

/** Accra — default when no live positions yet */
const DEFAULT_CENTER = { lat: 5.6037, lng: -0.187 };

interface Driver {
  id: string;
  name: string;
  location: { lat: number; lng: number };
  vehicle: string;
}

interface ActiveTrip {
  _id: string;
  status: string;
  pickup?: { latitude?: number; longitude?: number; address?: string };
  drop?: { latitude?: number; longitude?: number; address?: string };
  rider?: { name?: string };
  riderLocation?: { lat: number; lng: number } | null;
}

function isValidCoord(lat?: number, lng?: number): boolean {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    !(lat === 0 && lng === 0)
  );
}

export default function DashboardMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [activeTrips, setActiveTrips] = useState<ActiveTrip[]>([]);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const { isLoaded, loadError } = useJsApiLoader({
    id: "qarego-admin-maps",
    googleMapsApiKey: MAPS_KEY,
    libraries: LIBRARIES,
  });

  const fetchData = useCallback(async () => {
    try {
      setFetchError(null);
      const [driversData, tripsData] = await Promise.all([
        fetcher("/admin/drivers/active"),
        fetcher("/admin/trips/active").catch(() => ({ trips: [] })),
      ]);
      const online = (driversData.drivers || []).filter((d: Driver) =>
        isValidCoord(d.location?.lat, d.location?.lng)
      );
      setDrivers(online);
      setActiveTrips(tripsData.trips || []);
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Failed to fetch map data", error);
      setFetchError("Could not load live map data");
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const tripMarkers = useMemo(() => {
    const markers: { key: string; position: google.maps.LatLngLiteral; title: string }[] = [];
    activeTrips.forEach((trip) => {
      if (isValidCoord(trip.pickup?.latitude, trip.pickup?.longitude)) {
        markers.push({
          key: `trip-pickup-${trip._id}`,
          position: { lat: trip.pickup!.latitude!, lng: trip.pickup!.longitude! },
          title: `Pickup · ${trip.status}`,
        });
      }
      if (isValidCoord(trip.drop?.latitude, trip.drop?.longitude)) {
        markers.push({
          key: `trip-drop-${trip._id}`,
          position: { lat: trip.drop!.latitude!, lng: trip.drop!.longitude! },
          title: `Drop · ${trip.status}`,
        });
      }
      if (isValidCoord(trip.riderLocation?.lat, trip.riderLocation?.lng)) {
        markers.push({
          key: `trip-rider-${trip._id}`,
          position: { lat: trip.riderLocation!.lat, lng: trip.riderLocation!.lng },
          title: `Driver: ${trip.rider?.name || "En route"} · ${trip.status}`,
        });
      }
    });
    return markers;
  }, [activeTrips]);

  const fitMapToData = useCallback(() => {
    if (!map) return;
    const bounds = new google.maps.LatLngBounds();
    drivers.forEach((d) => bounds.extend(d.location));
    tripMarkers.forEach((m) => bounds.extend(m.position));
    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { top: 48, right: 48, bottom: 48, left: 48 });
      const count = drivers.length + tripMarkers.length;
      if (count === 1) map.setZoom(14);
    } else {
      map.setCenter(DEFAULT_CENTER);
      map.setZoom(12);
    }
  }, [map, drivers, tripMarkers]);

  useEffect(() => {
    fitMapToData();
  }, [fitMapToData]);

  useEffect(() => {
    if (!map || !containerRef.current) return;
    const ro = new ResizeObserver(() => {
      google.maps.event.trigger(map, "resize");
      fitMapToData();
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [map, fitMapToData]);

  if (!MAPS_KEY) {
    return (
      <div className="h-full min-h-[200px] w-full flex items-center justify-center bg-gray-100 rounded-lg">
        <div className="text-center p-4 max-w-sm">
          <MapPin className="h-8 w-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-600 font-medium">Google Maps API key required</p>
          <p className="text-xs text-gray-400 mt-1">
            Add <code className="bg-gray-200 px-1 rounded">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> to{" "}
            <code className="bg-gray-200 px-1 rounded">admin/.env.local</code>
          </p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="h-full min-h-[200px] w-full flex items-center justify-center bg-red-50 rounded-lg">
        <p className="text-sm text-red-600 px-4 text-center">Failed to load Google Maps</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative h-full w-full min-h-[200px] rounded-lg overflow-hidden">
      {/* Legend + status — stacks on narrow screens */}
      <div className="absolute top-2 left-2 right-2 z-10 flex flex-wrap items-start gap-2 pointer-events-none">
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-white/95 shadow px-2.5 py-1 text-xs font-medium text-gray-700">
            <Car className="h-3.5 w-3.5 text-blue-600" />
            {drivers.length} online
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md bg-white/95 shadow px-2.5 py-1 text-xs font-medium text-gray-700">
            <MapPin className="h-3.5 w-3.5 text-orange-600" />
            {activeTrips.length} active trip{activeTrips.length === 1 ? "" : "s"}
          </span>
        </div>
        {lastUpdated && (
          <span className="text-[10px] text-gray-500 bg-white/90 rounded px-2 py-0.5 ml-auto sm:ml-0">
            Updated {lastUpdated.toLocaleTimeString()}
          </span>
        )}
      </div>

      {fetchError && (
        <div className="absolute bottom-2 left-2 right-2 z-10 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
          {fetchError}
        </div>
      )}

      {!isLoaded ? (
        <div className="h-full w-full bg-gray-100 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      ) : (
        <GoogleMap
          mapContainerStyle={{ width: "100%", height: "100%" }}
          center={DEFAULT_CENTER}
          zoom={12}
          onLoad={setMap}
          options={{
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: true,
            gestureHandling: "greedy",
            mapId: process.env.NEXT_PUBLIC_GOOGLE_MAP_ID || "DEMO_MAP_ID",
          }}
        >
          {drivers.map((driver) => (
            <AdvancedMarker
              key={`driver-${driver.id}`}
              position={driver.location}
              title={`Driver: ${driver.name}${driver.vehicle ? ` · ${driver.vehicle}` : ""}`}
            />
          ))}
          {tripMarkers.map((m) => (
            <AdvancedMarker key={m.key} position={m.position} title={m.title} />
          ))}
        </GoogleMap>
      )}

      {isLoaded && drivers.length === 0 && activeTrips.length === 0 && !fetchError && (
        <div className="absolute inset-x-0 bottom-12 z-10 flex justify-center pointer-events-none px-4">
          <p className="text-xs text-gray-600 bg-white/95 rounded-lg shadow px-3 py-2 text-center max-w-xs">
            No online drivers or active trips right now. Map refreshes every 10s.
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={fetchData}
        className="absolute bottom-2 right-2 z-10 pointer-events-auto rounded-md bg-white shadow p-2 text-gray-600 hover:bg-gray-50"
        aria-label="Refresh map"
        title="Refresh now"
      >
        <RefreshCw className="h-4 w-4" />
      </button>
    </div>
  );
}
