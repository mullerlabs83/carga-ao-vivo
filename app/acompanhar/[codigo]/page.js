"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ref, onValue } from "firebase/database";
import dynamic from "next/dynamic";
import { db } from "../../../services/firebase";

const MapaCarga = dynamic(() => import("../../components/MapaCarga"), {
  ssr: false,
  loading: () => (
    <div className="bg-slate-800 rounded-2xl p-6 text-center">
      Carregando mapa...
    </div>
  ),
});

export default function AcompanharCarga() {
  const params = useParams();
  const codigo = params?.codigo;

  const [localizacao, setLocalizacao] = useState(null);
  const [trajeto, setTrajeto] = useState([]);
  const [entrega, setEntrega] = useState(null);
  const [dadosCarga, setDadosCarga] = useState(null);
  const [geofence, setGeofence] = useState(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!codigo) {
      setCarregando(false);
      return;
    }

    const dadosRef = ref(db, `cargas/${codigo}/dados`);
    const localizacaoRef = ref(db, `cargas/${codigo}/localizacao`);
    const trajetoRef = ref(db, `cargas/${codigo}/trajeto`);
    const entregaRef = ref(db, `cargas/${codigo}/entrega`);
    const geofenceRef = ref(db, `cargas/${codigo}/geofence`);

    const stopDados = onValue(
      dadosRef,
      (snapshot) => {
        setDadosCarga(snapshot.exists() ? snapshot.val() : null);
        setCarregando(false);
      },
      (error) => {
        console.error(error);
        setDadosCarga(null);
        setCarregando(false);
      }
    );

    const stopLocalizacao = onValue(localizacaoRef, (snapshot) => {
      setLocalizacao(snapshot.exists() ? snapshot.val() : null);
    });

    const stopTrajeto = onValue(trajetoRef, (snapshot) => {
      setTrajeto(snapshot.exists() ? Object.values(snapshot.val()) : []);
    });

    const stopEntrega = onValue(entregaRef, (snapshot) => {
      setEntrega(snapshot.exists() ? snapshot.val() : null);
    });

    const stopGeofence = onValue(geofenceRef, (snapshot) => {
      setGeofence(snapshot.exists() ? snapshot.val() : null);
    });

    return () => {
      stopDados();
      stopLocalizacao();
      stopTrajeto();
      stopEntrega();
      stopGeofence();
    };
  }, [codigo]);

  const clientePodeAcompanhar =
    dadosCarga?.linkClienteLiberado || !!entrega;

  const statusAtual = entrega
    ? "Entregue"
    : geofence?.entrouNoDestino
    ? "Chegou ao destino"
    : dadosCarga?.status || "Aguardando";

  const etapas = [
    {
      nome: "Carga cadastrada",
      ativa: !!dadosCarga,
    },
    {
      nome: "Motorista designado",
      ativa:
        dadosCarga?.status !== "Cadastrada" ||
        !!dadosCarga?.motorista,
    },
    {
      nome: "Em rota",
      ativa:
        statusAtual === "Em rota" ||
        statusAtual === "Chegou ao destino" ||
        statusAtual === "Entregue",
    },
    {
      nome: "Chegou ao destino",
      ativa:
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
            <h2 className="text-2xl font-bold mb-2">
              Carga não encontrada
            </h2>
            <p>Confira se o link está correto.</p>
          </div>
        ) : (
          <>
            <section className="bg-slate-900 rounded-2xl p-4 mb-6">
              <p>
                <strong>Código:</strong> {codigo}
              </p>

              <p>
                <strong>Carga / Pedido:</strong>{" "}
                {dadosCarga.numeroCarga || dadosCarga.produto || "-"}
              </p>

              <p>
                <strong>Transportadora:</strong>{" "}
                {dadosCarga.transportadoraResponsavel ||
                  dadosCarga.cliente ||
                  "-"}
              </p>

              <p>
                <strong>Status:</strong> {statusAtual}
              </p>
            </section>

            <section className="bg-slate-900 rounded-2xl p-4 mb-6">
              <h2 className="text-2xl font-bold mb-4">Linha do tempo</h2>

              <div className="grid gap-3 md:grid-cols-5">
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
            </section>

            {entrega ? (
              <section className="bg-green-900 rounded-2xl p-6">
                <h2 className="text-3xl font-bold mb-4">
                  Entrega concluída ✅
                </h2>

                <p>
                  <strong>Recebido por:</strong> {entrega.recebedor || "-"}
                </p>

                <p>
                  <strong>Horário:</strong> {entrega.entregueEm || "-"}
                </p>
              </section>
            ) : !clientePodeAcompanhar ? (
              <section className="bg-blue-950 rounded-2xl p-6">
                <h2 className="text-2xl font-bold mb-3">
                  Sua carga está em preparação
                </h2>

                <p className="text-blue-100">
                  O rastreamento será liberado automaticamente assim que o
                  veículo iniciar a rota de entrega.
                </p>
              </section>
            ) : !localizacao ? (
              <section className="bg-slate-900 rounded-2xl p-6">
                <p>Aguardando atualização de localização...</p>
              </section>
            ) : (
              <section className="bg-slate-900 rounded-2xl p-4">
                <div className="mb-4 bg-slate-800 rounded-xl p-4">
                  <p>
                    <strong>Última atualização:</strong>{" "}
                    {localizacao.atualizadoEm || "-"}
                  </p>

                  <p>
                    <strong>Pontos registrados:</strong> {trajeto.length}
                  </p>

                  {geofence?.entrouNoDestino && (
                    <p className="text-yellow-300 mt-2">
                      📍 Seu pedido chegou ao destino
                    </p>
                  )}
                </div>

                <div className="w-full overflow-hidden rounded-2xl">
                  <MapaCarga
                    latitude={localizacao.latitude}
                    longitude={localizacao.longitude}
                    trajeto={trajeto}
                  />
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}