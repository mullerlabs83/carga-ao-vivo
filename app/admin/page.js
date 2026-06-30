"use client";

import { useEffect, useState } from "react";
import { ref, onValue, remove } from "firebase/database";
import dynamic from "next/dynamic";
import { db } from "../../services/firebase";

const MapaCarga = dynamic(() => import("../components/MapaCarga"), {
  ssr: false,
  loading: () => <p>Carregando mapa...</p>,
});

export default function Admin() {
  const [listaCargas, setListaCargas] = useState([]);
  const [cargaSelecionada, setCargaSelecionada] = useState("");
  const [localizacao, setLocalizacao] = useState(null);
  const [trajeto, setTrajeto] = useState([]);
  const [entrega, setEntrega] = useState(null);
  const [geofence, setGeofence] = useState(null);

  const agora = Date.now();

  const cargaAtual = listaCargas.find(
    (carga) => carga.codigo === cargaSelecionada
  );

  let distanciaDestino = null;

  if (
    localizacao &&
    cargaAtual?.destinoCoordenadas &&
    localizacao.latitude &&
    localizacao.longitude
  ) {
    distanciaDestino = calcularDistanciaKm(
      localizacao.latitude,
      localizacao.longitude,
      cargaAtual.destinoCoordenadas.latitude,
      cargaAtual.destinoCoordenadas.longitude
    );
  }

  const cargasAtivas = listaCargas.filter((carga) => !carga.entrega);
  const historicoEntregas = listaCargas.filter((carga) => carga.entrega);

  const motoristasOnline = cargasAtivas.filter((carga) =>
    motoristaEstaOnline(carga)
  ).length;

  const geofencesAtivas = cargasAtivas.filter(
    (carga) => carga.geofence?.ativa
  ).length;

  const chegaramDestino = cargasAtivas.filter(
    (carga) => carga.geofence?.entrouNoDestino
  ).length;

  function calcularDistanciaKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
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

  function dataEntregaMs(carga) {
    if (carga.entrega?.entregueEmMs) return Number(carga.entrega.entregueEmMs);

    if (carga.entrega?.entregueEm) {
      const convertido = new Date(carga.entrega.entregueEm).getTime();
      return Number.isNaN(convertido) ? 0 : convertido;
    }

    return 0;
  }

  function mesmoDia(dataMs, referenciaMs) {
    const data = new Date(dataMs);
    const referencia = new Date(referenciaMs);

    return (
      data.getDate() === referencia.getDate() &&
      data.getMonth() === referencia.getMonth() &&
      data.getFullYear() === referencia.getFullYear()
    );
  }

  const inicioOntem = new Date();
  inicioOntem.setDate(inicioOntem.getDate() - 1);
  inicioOntem.setHours(0, 0, 0, 0);

  const entregasHoje = historicoEntregas.filter((carga) =>
    mesmoDia(dataEntregaMs(carga), agora)
  );

  const entregasOntem = historicoEntregas.filter((carga) =>
    mesmoDia(dataEntregaMs(carga), inicioOntem.getTime())
  );

  const entregasUltimos7Dias = historicoEntregas.filter((carga) => {
    const dataMs = dataEntregaMs(carga);
    const seteDiasMs = 7 * 24 * 60 * 60 * 1000;

    return (
      dataMs &&
      agora - dataMs <= seteDiasMs &&
      !mesmoDia(dataMs, agora) &&
      !mesmoDia(dataMs, inicioOntem.getTime())
    );
  });

  const entregasMaisAntigas = historicoEntregas.filter((carga) => {
    const dataMs = dataEntregaMs(carga);
    const seteDiasMs = 7 * 24 * 60 * 60 * 1000;

    return !dataMs || agora - dataMs > seteDiasMs;
  });

  useEffect(() => {
    const cargasRef = ref(db, "cargas");

    const pararCargas = onValue(cargasRef, (snapshot) => {
      if (snapshot.exists()) {
        const dados = snapshot.val();

        const lista = Object.entries(dados)
          .map(([codigo, dadosCarga]) => ({
            codigo,
            ...dadosCarga?.dados,
            localizacao: dadosCarga?.localizacao || null,
            trajeto: dadosCarga?.trajeto || null,
            entrega: dadosCarga?.entrega || null,
            geofence: dadosCarga?.geofence || null,
            destinoCoordenadas: dadosCarga?.destinoCoordenadas || null,
          }))
          .filter((carga) => {
            return (
              carga.origem ||
              carga.destino ||
              carga.localColeta ||
              carga.cliente ||
              carga.motorista ||
              carga.produto ||
              carga.entrega
            );
          })
          .sort((a, b) => Number(b.codigo) - Number(a.codigo));

        setListaCargas(lista);

        if (!cargaSelecionada && lista.length > 0) {
          const primeiraAtiva = lista.find((carga) => !carga.entrega);
          setCargaSelecionada(primeiraAtiva?.codigo || lista[0].codigo);
        }
      } else {
        setListaCargas([]);
        setCargaSelecionada("");
      }
    });

    return () => pararCargas();
  }, [cargaSelecionada]);

  useEffect(() => {
    if (!cargaSelecionada) return;

    const localizacaoRef = ref(db, `cargas/${cargaSelecionada}/localizacao`);
    const trajetoRef = ref(db, `cargas/${cargaSelecionada}/trajeto`);
    const entregaRef = ref(db, `cargas/${cargaSelecionada}/entrega`);
    const geofenceRef = ref(db, `cargas/${cargaSelecionada}/geofence`);

    const pararLocalizacao = onValue(localizacaoRef, (snapshot) => {
      setLocalizacao(snapshot.exists() ? snapshot.val() : null);
    });

    const pararTrajeto = onValue(trajetoRef, (snapshot) => {
      setTrajeto(snapshot.exists() ? Object.values(snapshot.val()) : []);
    });

    const pararEntrega = onValue(entregaRef, (snapshot) => {
      setEntrega(snapshot.exists() ? snapshot.val() : null);
    });

    const pararGeofence = onValue(geofenceRef, (snapshot) => {
      setGeofence(snapshot.exists() ? snapshot.val() : null);
    });

    return () => {
      pararLocalizacao();
      pararTrajeto();
      pararEntrega();
      pararGeofence();
    };
  }, [cargaSelecionada]);

  async function limparTestesAntigos() {
    const confirmar = window.confirm(
      "Isso vai apagar cargas vazias/sem dados reais. Deseja continuar?"
    );

    if (!confirmar) return;

    const cargasVazias = listaCargas.filter((carga) => {
      return (
        !carga.origem &&
        !carga.destino &&
        !carga.localColeta &&
        !carga.cliente &&
        !carga.motorista &&
        !carga.produto &&
        !carga.localizacao &&
        !carga.entrega
      );
    });

    for (const carga of cargasVazias) {
      await remove(ref(db, `cargas/${carga.codigo}`));
    }

    alert("Limpeza concluída.");
  }

  function motoristaEstaOnline(carga) {
    const ultimaAtualizacao =
      carga.localizacao?.atualizadoEmMs ||
      carga.localizacao?.timestamp ||
      carga.localizacao?.ultimaAtualizacao;

    if (!ultimaAtualizacao) return false;

    return Date.now() - Number(ultimaAtualizacao) <= 2 * 60 * 1000;
  }

  function CardCarga({ carga, historico = false }) {
    const selecionada = cargaSelecionada === carga.codigo;

    return (
      <button
        onClick={() => setCargaSelecionada(carga.codigo)}
        className={`text-left rounded-2xl p-4 transition ${
          selecionada ? "bg-blue-700" : "bg-slate-800 hover:bg-slate-700"
        }`}
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="font-bold">{carga.codigo}</p>
          <span
            className={`text-xs rounded-full px-3 py-1 ${
              historico ? "bg-green-700" : "bg-orange-600"
            }`}
          >
            {historico ? "Entregue" : "Ativa"}
          </span>
        </div>

        <p>
          <strong>Rota:</strong>{" "}
          {carga.origem || carga.cliente || "-"} →{" "}
          {carga.destino || carga.produto || "-"}
        </p>

        <p>
          <strong>Coleta:</strong> {carga.localColeta || "-"}
        </p>

        <p>
          <strong>Status:</strong> {carga.status || "-"}
        </p>

        {carga.localizacao && !historico && (
          <p className="mt-2 text-sm">
            {motoristaEstaOnline(carga) ? "🟢 GPS online" : "🔴 GPS offline"}
          </p>
        )}

        {carga.geofence?.ativa && !historico && (
          <p className="mt-1 text-sm text-green-300">🟢 Geofence ativa</p>
        )}

        {carga.geofence?.entrouNoDestino && !carga.entrega && (
          <p className="mt-1 text-sm text-yellow-300">
            📍 Chegou ao destino
          </p>
        )}

        {carga.geofence?.entregaAutomatica && (
          <p className="mt-1 text-sm text-green-300">
            ✅ Entrega automática
          </p>
        )}

        {carga.entrega && (
          <div className="mt-3 bg-green-950 rounded-xl p-3 text-sm">
            <p>
              <strong>✅ Recebido por:</strong>{" "}
              {carga.entrega.recebedor || "-"}
            </p>
            <p>
              <strong>Horário:</strong> {carga.entrega.entregueEm || "-"}
            </p>
          </div>
        )}
      </button>
    );
  }

  function SecaoHistorico({ titulo, entregas }) {
    if (entregas.length === 0) return null;

    return (
      <div className="mb-6">
        <h3 className="text-xl font-bold mb-3">
          {titulo} ({entregas.length})
        </h3>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {entregas.map((carga) => (
            <CardCarga key={carga.codigo} carga={carga} historico />
          ))}
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white p-4 md:p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold">
            Painel da Transportadora
          </h1>
          <p className="text-slate-400 mt-1">
            Monitoramento de cargas em tempo real
          </p>
        </div>

        <button
          onClick={limparTestesAntigos}
          className="bg-red-700 hover:bg-red-800 rounded-xl px-4 py-3 font-semibold"
        >
          Limpar testes vazios
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-6 mb-6">
        <div className="bg-slate-900 rounded-2xl p-4">
          <p className="text-slate-400">Total</p>
          <p className="text-3xl font-bold">{listaCargas.length}</p>
        </div>

        <div className="bg-slate-900 rounded-2xl p-4">
          <p className="text-slate-400">Ativas</p>
          <p className="text-3xl font-bold text-orange-400">
            {cargasAtivas.length}
          </p>
        </div>

        <div className="bg-slate-900 rounded-2xl p-4">
          <p className="text-slate-400">Entregues</p>
          <p className="text-3xl font-bold text-green-400">
            {historicoEntregas.length}
          </p>
        </div>

        <div className="bg-slate-900 rounded-2xl p-4">
          <p className="text-slate-400">Online</p>
          <p className="text-3xl font-bold text-blue-400">
            {motoristasOnline}
          </p>
        </div>

        <div className="bg-slate-900 rounded-2xl p-4">
          <p className="text-slate-400">Geofence</p>
          <p className="text-3xl font-bold text-green-400">
            {geofencesAtivas}
          </p>
        </div>

        <div className="bg-slate-900 rounded-2xl p-4">
          <p className="text-slate-400">No destino</p>
          <p className="text-3xl font-bold text-yellow-400">
            {chegaramDestino}
          </p>
        </div>
      </div>

      <section className="mb-6 bg-slate-900 rounded-2xl p-4">
        <h2 className="text-2xl font-bold mb-4">Cargas ativas</h2>

        {cargasAtivas.length === 0 ? (
          <p className="text-slate-400">Nenhuma carga ativa no momento.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {cargasAtivas.map((carga) => (
              <CardCarga key={carga.codigo} carga={carga} />
            ))}
          </div>
        )}
      </section>

      <section className="mb-6 bg-slate-900 rounded-2xl p-4">
        <h2 className="text-2xl font-bold mb-4">Histórico de entregas</h2>

        {historicoEntregas.length === 0 ? (
          <p className="text-slate-400">Nenhuma entrega concluída ainda.</p>
        ) : (
          <>
            <SecaoHistorico titulo="Hoje" entregas={entregasHoje} />
            <SecaoHistorico titulo="Ontem" entregas={entregasOntem} />
            <SecaoHistorico
              titulo="Últimos 7 dias"
              entregas={entregasUltimos7Dias}
            />
            <SecaoHistorico
              titulo="Mais antigas"
              entregas={entregasMaisAntigas}
            />
          </>
        )}
      </section>

      <section className="bg-slate-900 rounded-2xl p-4">
        <h2 className="text-2xl font-bold mb-4">
          Rastreamento da carga: {cargaSelecionada || "nenhuma"}
        </h2>

        {!cargaSelecionada ? (
          <p className="text-slate-400">Selecione uma carga para acompanhar.</p>
        ) : (
          <>
            {entrega && (
              <div className="mb-4 bg-green-900 rounded-2xl p-4">
                <h3 className="text-xl font-bold mb-2">
                  Entrega concluída ✅
                </h3>
                <p>
                  <strong>Recebido por:</strong> {entrega.recebedor || "-"}
                </p>
                <p>
                  <strong>Horário:</strong> {entrega.entregueEm || "-"}
                </p>
              </div>
            )}

            {geofence && (
              <div className="mb-4 bg-slate-800 rounded-xl p-4 grid gap-2 md:grid-cols-2">
                <p>
                  <strong>Geofence:</strong>{" "}
                  {geofence.ativa ? "🟢 Ativa" : "⚪ Inativa"}
                </p>

                <p>
                  <strong>Raio:</strong> {geofence.raioMetros || 500} m
                </p>

                <p>
                  <strong>Chegada:</strong>{" "}
                  {geofence.entrouNoDestino ? "📍 Detectada" : "Aguardando"}
                </p>

                <p>
                  <strong>Automática:</strong>{" "}
                  {geofence.entregaAutomatica ? "✅ Sim" : "Não"}
                </p>

                {geofence.horarioEntradaDestino && (
                  <p>
                    <strong>Entrada:</strong>{" "}
                    {geofence.horarioEntradaDestino}
                  </p>
                )}

                {geofence.horarioSaidaDestino && (
                  <p>
                    <strong>Saída:</strong> {geofence.horarioSaidaDestino}
                  </p>
                )}
              </div>
            )}

            {!localizacao ? (
              <p className="text-slate-400">
                Aguardando rastreamento dessa carga...
              </p>
            ) : (
              <>
                <div className="mb-4 bg-slate-800 rounded-xl p-4 grid gap-2 md:grid-cols-2">
                  <p>
                    <strong>Status:</strong> {localizacao.status || "-"}
                  </p>

                  <p>
                    <strong>Pontos registrados:</strong> {trajeto.length}
                  </p>

                  <p>
                    <strong>Última atualização:</strong>{" "}
                    {localizacao.atualizadoEm || "-"}
                  </p>

                  <p>
                    <strong>GPS:</strong>{" "}
                    {motoristaEstaOnline({ localizacao })
                      ? "🟢 Online"
                      : "🔴 Offline"}
                  </p>

                  {distanciaDestino !== null && (
                    <p>
                      <strong>Distância até destino:</strong>{" "}
                      {distanciaDestino.toFixed(2)} km
                    </p>
                  )}
                </div>

                <MapaCarga
                  latitude={localizacao.latitude}
                  longitude={localizacao.longitude}
                  trajeto={trajeto}
                />
              </>
            )}
          </>
        )}
      </section>
    </main>
  );
}