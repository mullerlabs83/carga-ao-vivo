"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ref, onValue } from "firebase/database";
import dynamic from "next/dynamic";
import { db } from "../../../services/firebase";

const MapaCarga = dynamic(() => import("../../components/MapaCarga"), {
  ssr: false,
  loading: () => <p>Carregando mapa...</p>,
});

export default function AcompanharCarga() {
  const params = useParams();
  const codigo = params?.codigo;

  const [localizacao, setLocalizacao] = useState(null);
  const [trajeto, setTrajeto] = useState([]);
  const [entrega, setEntrega] = useState(null);
  const [dadosCarga, setDadosCarga] = useState(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!codigo) return;

    const dadosRef = ref(db, `cargas/${codigo}/dados`);
    const localizacaoRef = ref(db, `cargas/${codigo}/localizacao`);
    const trajetoRef = ref(db, `cargas/${codigo}/trajeto`);
    const entregaRef = ref(db, `cargas/${codigo}/entrega`);

    const stop1 = onValue(dadosRef, (snapshot) => {
      setDadosCarga(snapshot.exists() ? snapshot.val() : null);
      setCarregando(false);
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
    : dadosCarga?.status || "Aguardando rastreamento";

  const etapas = [
    { nome: "Carga cadastrada", ativa: !!dadosCarga },
    {
      nome: "Aguardando coleta",
      ativa:
        !!dadosCarga &&
        [
          "Disponível",
          "Aceita",
          "Aguardando coleta",
          "Em rota",
          "Chegou ao destino",
          "Entregue",
        ].includes(statusAtual),
    },
    {
      nome: "Em rota",
      ativa:
        statusAtual === "Em rota" ||
        statusAtual === "Chegou ao destino" ||
        statusAtual === "Entregue",
    },
    {
      nome: "Entregue",
      ativa: statusAtual === "Entregue",
    },
  ];

  return (
    <main className="min-h-screen bg-slate-950 text-white p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <p className="text-blue-400 font-semibold mb-2">Carga Ao Vivo</p>

        <h1 className="text-3xl md:text-4xl font-bold mb-6">
          Acompanhamento da Carga
        </h1>

        {carregando ? (
          <div className="bg-slate-900 rounded-2xl p-6">
            <p>Carregando dados da carga...</p>
          </div>
        ) : !dadosCarga ? (
          <div className="bg-red-900 rounded-2xl p-6">
            <h2 className="text-2xl font-bold mb-2">Carga não encontrada</h2>
            <p>Confira se o link ou código está correto.</p>
            <p className="text-sm mt-3 break-all">Código: {codigo}</p>
          </div>
        ) : (
          <>
            <div className="bg-slate-900 rounded-2xl p-4 mb-6">
              <p>
                <strong>Código:</strong> {codigo}
              </p>

              <p>
                <strong>Carga / Pedido:</strong>{" "}
                {dadosCarga.numeroCarga || dadosCarga.produto || "-"}
              </p>

              <p>
                <strong>Transportadora responsável:</strong>{" "}
                {dadosCarga.transportadoraResponsavel ||
                  dadosCarga.cliente ||
                  "-"}
              </p>

              <p>
                <strong>Origem:</strong> {dadosCarga.origem || "-"}
              </p>

              <p>
                <strong>Destino:</strong> {dadosCarga.destino || "-"}
              </p>

              <p>
                <strong>Placa:</strong> {dadosCarga.placa || "-"}
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
                  <strong>Recebido por:</strong> {entrega.recebedor || "-"}
                </p>

                <p>
                  <strong>Horário:</strong> {entrega.entregueEm || "-"}
                </p>
              </div>
            ) : !localizacao ? (
              <div className="bg-slate-900 rounded-2xl p-6">
                <p>Aguardando início do rastreamento...</p>
              </div>
            ) : (
              <div className="bg-slate-900 rounded-2xl p-4">
                <p className="mb-4">
                  Última atualização: {localizacao.atualizadoEm || "-"}
                </p>

                <MapaCarga
                  latitude={localizacao.latitude}
                  longitude={localizacao.longitude}
                  trajeto={trajeto}
                />
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}