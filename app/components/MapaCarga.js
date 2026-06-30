"use client";

import "leaflet/dist/leaflet.css";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
} from "react-leaflet";
import { useEffect } from "react";
import L from "leaflet";

const iconeCaminhao = L.divIcon({
  html: "🚚",
  className: "",
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

function CentralizarMapa({ latitude, longitude }) {
  const map = useMap();

  useEffect(() => {
    if (!latitude || !longitude) return;

    map.setView([latitude, longitude], 15);

    setTimeout(() => {
      map.invalidateSize();
    }, 300);
  }, [latitude, longitude, map]);

  return null;
}

export default function MapaCarga({ latitude, longitude, trajeto = [] }) {
  if (!latitude || !longitude) {
    return (
      <div className="bg-slate-800 rounded-2xl p-6 text-center">
        Aguardando localização do motorista...
      </div>
    );
  }

  const pontosDoTrajeto = trajeto
    .filter((ponto) => ponto.latitude && ponto.longitude)
    .map((ponto) => [Number(ponto.latitude), Number(ponto.longitude)]);

  return (
    <div
      style={{
        height: "min(500px, 70vh)",
        width: "100%",
        borderRadius: "16px",
        overflow: "hidden",
      }}
    >
      <MapContainer
        center={[Number(latitude), Number(longitude)]}
        zoom={15}
        scrollWheelZoom={true}
        style={{ height: "100%", width: "100%" }}
      >
        <CentralizarMapa
          latitude={Number(latitude)}
          longitude={Number(longitude)}
        />

        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {pontosDoTrajeto.length > 1 && (
          <Polyline positions={pontosDoTrajeto} />
        )}

        <Marker
          position={[Number(latitude), Number(longitude)]}
          icon={iconeCaminhao}
        >
          <Popup>🚚 Caminhão em rota</Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}