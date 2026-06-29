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
  const [listaCargas, setListaCargas] = useState([]);
  const [cargaSelecionada, setCargaSelecionada] = useState("carga1");
  const [localizacao, setLocalizacao] = useState(null);
  const [trajeto, setTrajeto] = useState([]);
  const [entrega, setEntrega] = useState(null);

  useEffect(() => {
    const cargasRef = ref(db, "cargas");

    const pararCargas = onValue(cargasRef, (snapshot) => {
      if (snapshot.exists()) {
        const dados = snapshot.val();

        const lista = Object.entries(dados)
          .map(([codigo, dadosCarga]) => ({
            codigo,
            ...dadosCarga?.dados,
            entrega: dadosCarga?.entrega || null,
          }))
          .filter((carga) => carga.cliente || carga.motorista || carga.produto);

        setListaCargas(lista);
      } else {
        setListaCargas([]);
      }
    });

    return () => pararCargas();
  }, []);

  useEffect(() => {
    const localizacaoRef = ref(db, `cargas/${cargaSelecionada}/localizacao`);
    const trajetoRef = ref(db, `cargas/${cargaSelecionada}/trajeto`);
    const entregaRef = ref(db, `cargas/${cargaSelecionada}/entrega`);

    const pararLocalizacao = onValue(localizacaoRef, (snapshot) => {
      setLocalizacao(snapshot.exists() ? snapshot.val() : null);
    });

    const pararTrajeto = onValue(trajetoRef, (snapshot) => {
      setTrajeto(snapshot.exists() ? Object.values(snapshot.val()) : []);
    });

    const pararEntrega = onValue(entregaRef, (snapshot) => {
      setEntrega(snapshot.exists() ? snapshot.val() : null);
    });

    return () => {
      pararLocalizacao();
      pararTrajeto();
      pararEntrega();
    };
  }, [cargaSelecionada]);

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6">
      <h1 className="text-4xl font-bold mb-6">Painel da Transportadora</h1>

      <div className="mb-6 bg-slate-900 rounded-2xl p-4">
        <h2 className="text-2xl font-bold mb-4">Cargas cadastradas</h2>

        {listaCargas.length === 0 ? (
          <p>Nenhuma carga cadastrada</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {listaCargas.map((carga) => (
              <button
                key={carga.codigo}
                onClick={() => setCargaSelecionada(carga.codigo)}
                className={`text-left rounded-xl p-4 ${
                  cargaSelecionada === carga.codigo
                    ? "bg-blue-700"
                    : "bg-slate-800"
                }`}
              >
                <p><strong>Código:</strong> {carga.codigo}</p>
                <p><strong>Cliente:</strong> {carga.cliente || "-"}</p>
                <p><strong>Motorista:</strong> {carga.motorista || "-"}</p>
                <p><strong>Status:</strong> {carga.status || "-"}</p>

                {carga.entrega && (
                  <div className="mt-3 bg-green-900 rounded-xl p-3">
                    <p><strong>✅ Recebido por:</strong> {carga.entrega.recebedor}</p>
                    <p><strong>Horário:</strong> {carga.entrega.entregueEm}</p>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="bg-slate-900 rounded-2xl p-4">
        <h2 className="text-2xl font-bold mb-4">
          Rastreamento da carga: {cargaSelecionada}
        </h2>

        {entrega && (
          <div className="mb-4 bg-green-900 rounded-2xl p-4">
            <h3 className="text-xl font-bold mb-2">Entrega concluída ✅</h3>
            <p><strong>Recebido por:</strong> {entrega.recebedor}</p>
            <p><strong>Horário:</strong> {entrega.entregueEm}</p>
          </div>
        )}

        {!localizacao ? (
          <p>Aguardando rastreamento dessa carga...</p>
        ) : (
          <>
            <div className="mb-4">
              <p>Status: {localizacao.status}</p>
              <p>Motorista: {localizacao.motorista}</p>
              <p>Veículo: {localizacao.veiculo}</p>
              <p>Carga: {localizacao.carga}</p>
              <p>Pontos registrados: {trajeto.length}</p>
            </div>

            <MapaCarga
              latitude={localizacao.latitude}
              longitude={localizacao.longitude}
              trajeto={trajeto}
            />
          </>
        )}
      </div>
    </main>
  );
}