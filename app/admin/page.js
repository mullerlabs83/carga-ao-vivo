"use client";

import { useEffect, useState } from "react";
import { ref, onValue } from "firebase/database";
import dynamic from "next/dynamic";
import { db } from "../../services/firebase";

const MapaCarga = dynamic(() => import("../components/MapaCarga"), {
  ssr: false,
  loading: () => <p>Carregando mapa...</p>,
});

export default function Admin() {
  const [localizacao, setLocalizacao] = useState(null);
  const [trajeto, setTrajeto] = useState([]);

  useEffect(() => {
    const localizacaoRef = ref(db, "cargas/carga1/localizacao");
    const trajetoRef = ref(db, "cargas/carga1/trajeto");

    const pararLocalizacao = onValue(localizacaoRef, (snapshot) => {
      if (snapshot.exists()) {
        setLocalizacao(snapshot.val());
      }
    });

    const pararTrajeto = onValue(trajetoRef, (snapshot) => {
      if (snapshot.exists()) {
        const dados = snapshot.val();
        const lista = Object.values(dados);
        setTrajeto(lista);
      }
    });

    return () => {
      pararLocalizacao();
      pararTrajeto();
    };
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6">
      <h1 className="text-4xl font-bold mb-4">Painel da Transportadora</h1>

      {!localizacao ? (
        <p>Aguardando localização do motorista...</p>
      ) : (
        <>
          <div className="mb-4">
            <p>Status: {localizacao.status}</p>
            <p>Motorista: {localizacao.motorista}</p>
            <p>Veículo: {localizacao.veiculo}</p>
            <p>Carga: {localizacao.carga}</p>
            <p>Latitude: {localizacao.latitude}</p>
            <p>Longitude: {localizacao.longitude}</p>
            <p>Atualizado: {localizacao.atualizadoEm}</p>
            <p>Pontos registrados: {trajeto.length}</p>
          </div>

          <MapaCarga
            latitude={localizacao.latitude}
            longitude={localizacao.longitude}
            trajeto={trajeto}
          />
        </>
      )}
    </main>
  );
}