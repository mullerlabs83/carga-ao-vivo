"use client";

import { useEffect, useState, use } from "react";
import { ref, onValue } from "firebase/database";
import dynamic from "next/dynamic";
import { db } from "../../../services/firebase";

const MapaCarga = dynamic(() => import("../../components/MapaCarga"), {
  ssr: false,
  loading: () => <p>Carregando mapa...</p>,
});

export default function AcompanharCarga({ params }) {
  const { codigo } = use(params);

  const [localizacao, setLocalizacao] = useState(null);
  const [trajeto, setTrajeto] = useState([]);
  const [entrega, setEntrega] = useState(null);
  const [dadosCarga, setDadosCarga] = useState(null);

  useEffect(() => {
    const dadosRef = ref(db, `cargas/${codigo}/dados`);
    const localizacaoRef = ref(db, `cargas/${codigo}/localizacao`);
    const trajetoRef = ref(db, `cargas/${codigo}/trajeto`);
    const entregaRef = ref(db, `cargas/${codigo}/entrega`);

    const stop1 = onValue(dadosRef, (snapshot) => {
      setDadosCarga(snapshot.exists() ? snapshot.val() : null);
    });

    const stop2 = onValue(localizacaoRef, (snapshot) => {
      setLocalizacao(snapshot.exists() ? snapshot.val() : null);
    });

    const stop3 = onValue(trajetoRef, (snapshot) => {
      setTrajeto(snapshot.exists() ? Object.values(snapshot.val()) : []);
    });

    const stop4 = onValue(entregaRef, (snapshot) => {
      setEntrega(snapshot.exists() ? snapshot.val() : null);
    });

    return () => {
      stop1();
      stop2();
      stop3();
      stop4();
    };
  }, [codigo]);

  const statusAtual = entrega
    ? "Entregue"
    : dadosCarga?.status || "Aguardando coleta";

  const etapas = [
    { nome: "Carga cadastrada", ativa: true },
    {
      nome: "Aguardando coleta",
      ativa:
        statusAtual === "Aguardando coleta" ||
        statusAtual === "Em rota" ||
        statusAtual === "Entregue",
    },
    {
      nome: "Em rota",
      ativa: statusAtual === "Em rota" || statusAtual === "Entregue",
    },
    {
      nome: "Entregue",
      ativa: statusAtual === "Entregue",
    },
  ];

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <p className="text-blue-400 font-semibold mb-2">Carga Ao Vivo</p>

        <h1 className="text-4xl font-bold mb-6">
          Acompanhamento da Carga
        </h1>

        <div className="bg-slate-900 rounded-2xl p-4 mb-6">
          <p>
            <strong>Código:</strong> {codigo}
          </p>

          <p>
            <strong>Carga / Pedido:</strong>{" "}
            {dadosCarga?.numeroCarga || dadosCarga?.produto || "-"}
          </p>

          <p>
            <strong>Transportadora responsável:</strong>{" "}
            {dadosCarga?.transportadoraResponsavel ||
              dadosCarga?.cliente ||
              "-"}
          </p>

          <p>
            <strong>Origem:</strong> {dadosCarga?.origem || "-"}
          </p>

          <p>
            <strong>Destino:</strong> {dadosCarga?.destino || "-"}
          </p>

          <p>
            <strong>Placa:</strong> {dadosCarga?.placa || "-"}
          </p>

          <p>
            <strong>Status:</strong> {statusAtual}
          </p>
        </div>

        <div className="bg-slate-900 rounded-2xl p-4 mb-6">
          <h2 className="text-2xl font-bold mb-4">Linha do tempo</h2>

          <div className="grid gap-3 md:grid-cols-4">
            {etapas.map((etapa) => (
              <div
                key={etapa.nome}
                className={`rounded-xl p-4 ${
                  etapa.ativa ? "bg-green-700" : "bg-slate-800"
                }`}
              >
                <p className="font-bold">
                  {etapa.ativa ? "✅" : "⏳"} {etapa.nome}
                </p>
              </div>
            ))}
          </div>
        </div>

        {entrega ? (
          <div className="bg-green-900 rounded-2xl p-6">
            <h2 className="text-3xl font-bold mb-4">
              Entrega concluída ✅
            </h2>

            <p>
              <strong>Recebido por:</strong> {entrega.recebedor}
            </p>

            <p>
              <strong>Horário:</strong> {entrega.entregueEm}
            </p>
          </div>
        ) : !localizacao ? (
          <div className="bg-slate-900 rounded-2xl p-6">
            <p>Aguardando início do rastreamento...</p>
          </div>
        ) : (
          <div className="bg-slate-900 rounded-2xl p-4">
            <p className="mb-4">
              Última atualização: {localizacao.atualizadoEm}
            </p>

            <MapaCarga
              latitude={localizacao.latitude}
              longitude={localizacao.longitude}
              trajeto={trajeto}
            />
          </div>
        )}
      </div>
    </main>
  );
}