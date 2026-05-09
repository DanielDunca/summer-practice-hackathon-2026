"use client";

import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { useEffect, useRef } from "react";
import L from "leaflet";

const markerIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface Props {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
}

function ClickHandler({ onChange }: { onChange: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(event) {
      onChange(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

function FlyTo({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    map.flyTo([lat, lng], map.getZoom(), { duration: 0.8 });
  }, [lat, lng, map]);
  return null;
}

export default function MapPicker({ lat, lng, onChange }: Props) {
  const center: [number, number] = lat !== null && lng !== null
    ? [lat, lng]
    : [46.7712, 23.6236];

  return (
    <div className="h-52 overflow-hidden rounded-xl border border-zinc-200">
      <MapContainer center={center} zoom={13} scrollWheelZoom={false} className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickHandler onChange={onChange} />
        {lat !== null && lng !== null && (
          <>
            <Marker position={[lat, lng]} icon={markerIcon} />
            <FlyTo lat={lat} lng={lng} />
          </>
        )}
      </MapContainer>
    </div>
  );
}
