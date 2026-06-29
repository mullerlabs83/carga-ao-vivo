"use client";

import { useState } from "react";
import { ref, set, push } from "firebase/database";
import { db } from "../../services/firebase";

export default function Motorista() {
  const [status, setStatus] = useState("Aguardando rastreamento");

  function iniciarRastreamento() {
    if (!navigator.geolocation) {
      setStatus("GPS não suportado");
      return;
    }

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

        await push(ref(db, "cargas/carga1/trajeto"), {
          latitude,
          longitude,
          atualizadoEm,
        });

        setStatus("Localização enviada ✅");
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

      <p className="mt-6">{status}</p>
    </main>
  );
}