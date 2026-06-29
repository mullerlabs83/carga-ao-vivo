"use client";

import { useRef, useState } from "react";
import { ref, set, push, remove } from "firebase/database";
import { db } from "../../services/firebase";

export default function Motorista() {
  const [status, setStatus] = useState("Aguardando rastreamento");
  const ultimaPosicaoRef = useRef(null);

  function calcularDistanciaMetros(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  async function iniciarRastreamento() {
    if (!navigator.geolocation) {
      setStatus("GPS não suportado");
      return;
    }

    ultimaPosicaoRef.current = null;
    await remove(ref(db, "cargas/carga1/trajeto"));

    setStatus("Iniciando GPS...");

    navigator.geolocation.watchPosition(
      async (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        const atualizadoEm = new Date().toLocaleString();

        await set(ref(db, "cargas/carga1/localizacao"), {
          latitude,
          longitude,
          atualizadoEm,
          motorista: "Motorista 1",
          veiculo: "ABC-1234",
          carga: "Carga 1",
          status: "Em rota",
        });

        let deveSalvarPonto = false;

        if (!ultimaPosicaoRef.current) {
          deveSalvarPonto = true;
        } else {
          const distancia = calcularDistanciaMetros(
            ultimaPosicaoRef.current.latitude,
            ultimaPosicaoRef.current.longitude,
            latitude,
            longitude
          );

          if (distancia >= 30) {
            deveSalvarPonto = true;
          }
        }

        if (deveSalvarPonto) {
          await push(ref(db, "cargas/carga1/trajeto"), {
            latitude,
            longitude,
            atualizadoEm,
          });

          ultimaPosicaoRef.current = { latitude, longitude };
          setStatus("Localização enviada ✅ ponto salvo");
        } else {
          setStatus("Localização enviada ✅ aguardando movimento");
        }
      },
      (error) => {
        setStatus("Erro GPS: " + error.message);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000,
      }
    );
  }

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6">
      <h1 className="text-4xl font-bold mb-6">Área do Motorista</h1>

      <button
        onClick={iniciarRastreamento}
        className="bg-green-600 px-6 py-4 rounded-xl"
      >
        Iniciar Rastreamento
      </button>

      <p className="mt-6 text-center">{status}</p>
    </main>
  );
}