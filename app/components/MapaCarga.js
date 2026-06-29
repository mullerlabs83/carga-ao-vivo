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

function CentralizarMapa({ latitude, longitude }) {
  const map = useMap();

  useEffect(() => {
    map.setView([latitude, longitude], 15);
  }, [latitude, longitude, map]);

  return null;
}

export default function MapaCarga({ latitude, longitude, trajeto = [] }) {
  const pontosDoTrajeto = trajeto
    .filter((ponto) => ponto.latitude && ponto.longitude)
    .map((ponto) => [ponto.latitude, ponto.longitude]);

  return (
    <div style={{ height: "500px", width: "100%", borderRadius: "16px", overflow: "hidden" }}>
      <MapContainer
        center={[latitude, longitude]}
        zoom={15}
        style={{ height: "100%", width: "100%" }}
      >
        <CentralizarMapa latitude={latitude} longitude={longitude} />

        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        {pontosDoTrajeto.length > 1 && (
          <Polyline positions={pontosDoTrajeto} />
        )}

        <Marker position={[latitude, longitude]}>
          <Popup>🚚 Caminhão em rota</Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}