"use client";

import { useEffect, useRef, useState } from "react";
import { ref, get, set, push, onValue } from "firebase/database";
import { db } from "../../services/firebase";

const distanciasSimuladas = {
  curitiba: {
    curitiba: 0,
    "são josé dos pinhais": 15,
    pinhais: 12,
    colombo: 18,
    araucária: 28,
    joinville: 130,
    "são paulo": 408,
  },
  "são paulo": {
    "são paulo": 0,
    guarulhos: 20,
    osasco: 22,
    campinas: 95,
    curitiba: 408,
  },
};

function normalizar(texto) {
  return texto
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function calcularDistancia(localColeta, localMotorista) {
  const coleta = normalizar(localColeta);
  const motorista = normalizar(localMotorista);

  const tabela = {};

  Object.keys(distanciasSimuladas).forEach((cidadeOrigem) => {
    const origemNormalizada = normalizar(cidadeOrigem);
    tabela[origemNormalizada] = {};

    Object.keys(distanciasSimuladas[cidadeOrigem]).forEach((cidadeDestino) => {
      tabela[origemNormalizada][normalizar(cidadeDestino)] =
        distanciasSimuladas[cidadeOrigem][cidadeDestino];
    });
  });

  if (tabela[coleta] && tabela[coleta][motorista] !== undefined) {
    return tabela[coleta][motorista];
  }

  if (coleta.includes(motorista) || motorista.includes(coleta)) {
    return 0;
  }

  return 9999;
}

function calcularDistanciaGps(lat1, lon1, lat2, lon2) {
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

export default function MotoristaPage() {
  const [nome, setNome] = useState("");
  const [localAtual, setLocalAtual] = useState("");
  const [cargas, setCargas] = useState([]);

  const [codigoRastreamento, setCodigoRastreamento] = useState("");
  const [rastreamento, setRastreamento] = useState(null);
  const [statusGps, setStatusGps] = useState("");
  const [enviandoGps, setEnviandoGps] = useState(false);
  const [rastreamentoAutomatico, setRastreamentoAutomatico] = useState(false);
const [distanciaDestinoAtual, setDistanciaDestinoAtual] = useState(null);
  const intervaloRef = useRef(null);

  useEffect(() => {
    const cargasRef = ref(db, "cargas");

    const parar = onValue(cargasRef, (snapshot) => {
      if (!snapshot.exists()) {
        setCargas([]);
        return;
      }

      const dados = snapshot.val();

      const lista = Object.entries(dados)
        .map(([id, carga]) => ({
          id,
          ...carga?.dados,
          geofence: carga?.geofence || null,
          destinoCoordenadas: carga?.destinoCoordenadas || null,
          entrega: carga?.entrega || null,
          localizacao: carga?.localizacao || null,
        }))
        .filter((carga) => carga.origem || carga.destino || carga.localColeta)
        .sort((a, b) => Number(b.id) - Number(a.id));

      setCargas(lista);
    });

    return () => {
      parar();

      if (intervaloRef.current) {
        clearInterval(intervaloRef.current);
      }
    };
  }, []);

  async function buscarRastreamento() {
    if (!codigoRastreamento) {
      alert("Digite o código do rastreamento.");
      return;
    }

    const snapshot = await get(ref(db, `cargas/${codigoRastreamento}`));

    if (!snapshot.exists()) {
      alert("Rastreamento não encontrado.");
      setRastreamento(null);
      return;
    }

    const dados = snapshot.val();

    setRastreamento({
      ...dados?.dados,
      geofence: dados?.geofence || null,
      destinoCoordenadas: dados?.destinoCoordenadas || null,
      entrega: dados?.entrega || null,
    });
  }

  async function verificarGeofence(latitude, longitude, atualizadoEm) {
    const cargaSnapshot = await get(ref(db, `cargas/${codigoRastreamento}`));

    if (!cargaSnapshot.exists()) return;

    const carga = cargaSnapshot.val();

    if (!carga?.destinoCoordenadas || !carga?.geofence?.ativa) {
      return;
    }

    if (carga?.entrega) {
      return;
    }

    const distanciaDestino = calcularDistanciaGps(
      latitude,
      longitude,
      carga.destinoCoordenadas.latitude,
      carga.destinoCoordenadas.longitude
    );
setDistanciaDestinoAtual(distanciaDestino);
    const raioMetros = carga.geofence.raioMetros || 500;
    const dentroGeofence = distanciaDestino <= raioMetros;

    if (dentroGeofence && !carga.geofence.entrouNoDestino) {
      await set(ref(db, `cargas/${codigoRastreamento}/geofence`), {
        ...carga.geofence,
        entrouNoDestino: true,
        saiuDoDestino: false,
        entregaAutomatica: false,
        horarioEntradaDestino: atualizadoEm,
      });

      await set(
        ref(db, `cargas/${codigoRastreamento}/dados/status`),
        "Chegou ao destino"
      );

      setStatusGps(
        `📍 Chegou ao destino. Distância aproximada: ${Math.round(
          distanciaDestino
        )} m`
      );

      return;
    }

    if (
      !dentroGeofence &&
      carga.geofence.entrouNoDestino &&
      !carga.geofence.saiuDoDestino &&
      !carga.geofence.entregaAutomatica
    ) {
      await set(ref(db, `cargas/${codigoRastreamento}/geofence`), {
        ...carga.geofence,
        saiuDoDestino: true,
        entregaAutomatica: true,
        horarioSaidaDestino: atualizadoEm,
      });

      await set(ref(db, `cargas/${codigoRastreamento}/entrega`), {
        recebedor: "Entrega finalizada automaticamente por geofence",
        entregueEm: atualizadoEm,
        entregueEmMs: Date.now(),
        tipo: "automatica_geofence",
      });

      await set(
        ref(db, `cargas/${codigoRastreamento}/dados/status`),
        "Entregue automaticamente"
      );

      pararRastreamentoAutomatico();

      setStatusGps("✅ Entrega finalizada automaticamente por geofence.");
    }
  }

  function enviarLocalizacao(statusNovo = "Em rota") {
    if (!codigoRastreamento) {
      alert("Digite o código do rastreamento.");
      return;
    }

    if (!navigator.geolocation) {
      setStatusGps("GPS não disponível neste navegador.");
      return;
    }

    setEnviandoGps(true);
    setStatusGps("Solicitando localização...");

    navigator.geolocation.getCurrentPosition(
      async (posicao) => {
        const latitude = posicao.coords.latitude;
        const longitude = posicao.coords.longitude;
        const atualizadoEm = new Date().toLocaleString("pt-BR");
        const timestamp = Date.now();

        await set(ref(db, `cargas/${codigoRastreamento}/localizacao`), {
          latitude,
          longitude,
          atualizadoEm,
          timestamp,
        });

        await push(ref(db, `cargas/${codigoRastreamento}/trajeto`), {
          latitude,
          longitude,
          atualizadoEm,
          timestamp,
        });

        await verificarGeofence(latitude, longitude, atualizadoEm);

        const cargaSnapshot = await get(ref(db, `cargas/${codigoRastreamento}`));
        const cargaAtual = cargaSnapshot.exists() ? cargaSnapshot.val() : null;

        if (!cargaAtual?.entrega && cargaAtual?.dados?.status !== "Chegou ao destino") {
          await set(
            ref(db, `cargas/${codigoRastreamento}/dados/status`),
            statusNovo
          );

          setStatusGps(`Localização enviada: ${atualizadoEm}`);
        }

        setEnviandoGps(false);
        buscarRastreamento();
      },
      () => {
        setStatusGps(
          "GPS indisponível nesta tentativa. Tentando novamente automaticamente..."
        );
        setEnviandoGps(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 30000,
        maximumAge: 0,
      }
    );
  }

  function iniciarRastreamentoAutomatico() {
    if (!codigoRastreamento) {
      alert("Digite o código do rastreamento.");
      return;
    }

    if (intervaloRef.current) {
      clearInterval(intervaloRef.current);
    }

    enviarLocalizacao("Em rota");

    intervaloRef.current = setInterval(() => {
      enviarLocalizacao("Em rota");
    }, 30000);

    setRastreamentoAutomatico(true);
    setStatusGps("Rastreamento automático iniciado. Atualiza a cada 30 segundos.");
  }

  function pararRastreamentoAutomatico() {
    if (intervaloRef.current) {
      clearInterval(intervaloRef.current);
      intervaloRef.current = null;
    }

    setRastreamentoAutomatico(false);
  }

  async function finalizarEntrega() {
    if (!codigoRastreamento) {
      alert("Digite o código do rastreamento.");
      return;
    }

    pararRastreamentoAutomatico();

    const entregueEm = new Date().toLocaleString("pt-BR");

    await set(ref(db, `cargas/${codigoRastreamento}/entrega`), {
      recebedor: "Entrega finalizada pelo motorista",
      entregueEm,
      entregueEmMs: Date.now(),
      tipo: "manual_motorista",
    });

    await set(ref(db, `cargas/${codigoRastreamento}/dados/status`), "Entregue");

    alert("Entrega finalizada.");
    buscarRastreamento();
  }

  async function aceitarCarga(carga) {
    if (!nome || !localAtual) {
      alert("Informe seu nome e local atual antes de aceitar uma carga.");
      return;
    }

    const distancia = calcularDistancia(carga.localColeta, localAtual);

    if (distancia > carga.raioMaximo) {
      alert(
        `Você está fora do raio permitido. Distância estimada: ${
          distancia >= 9999 ? "desconhecida" : `${distancia} km`
        }.`
      );
      return;
    }

    await set(ref(db, `cargas/${carga.id}/dados/motoristaAceito`), {
      nome,
      localAtual,
      distancia,
      aceitoEm: new Date().toLocaleString("pt-BR"),
    });

    await set(ref(db, `cargas/${carga.id}/dados/status`), "Aceita");

    alert("Carga aceita com sucesso.");
  }

  const cargasComDistancia = cargas.map((carga) => {
    const distancia =
      localAtual.trim() !== ""
        ? calcularDistancia(carga.localColeta, localAtual)
        : null;

    const dentroDoRaio =
      distancia !== null ? distancia <= carga.raioMaximo : false;

    return {
      ...carga,
      distancia,
      dentroDoRaio,
    };
  });

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Área do Motorista</h1>

        <p className="text-slate-300 mb-8">
          Aceite cargas disponíveis ou inicie um rastreamento direto pelo código.
        </p>

        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-8">
          <h2 className="text-xl font-semibold mb-4">Rastreamento direto</h2>

          <div className="grid gap-4">
            <input
              className="p-3 rounded-xl bg-slate-800 border border-slate-700 outline-none"
              placeholder="Digite o código do rastreamento"
              value={codigoRastreamento}
              onChange={(e) => setCodigoRastreamento(e.target.value)}
            />

            <button
              onClick={buscarRastreamento}
              className="bg-blue-600 hover:bg-blue-700 rounded-xl p-4 font-semibold"
            >
              Buscar rastreamento
            </button>

            {rastreamento && (
              <div className="bg-slate-800 rounded-xl p-4">
                <p>
                  <strong>Carga / Pedido:</strong>{" "}
                  {rastreamento.numeroCarga || codigoRastreamento || "-"}
                </p>

                <p>
                  <strong>Origem:</strong> {rastreamento.origem || "-"}
                </p>

                <p>
                  <strong>Destino:</strong> {rastreamento.destino || "-"}
                </p>

                <p>
                  <strong>Status:</strong> {rastreamento.status || "-"}
                </p>

                {rastreamento.geofence?.entrouNoDestino && (
                  <p className="text-green-300 mt-2">
                    📍 Chegada ao destino detectada
                  </p>
                )}

                {rastreamento.entrega && (
                  <div className="mt-3 bg-green-900 border border-green-700 rounded-xl p-3">
                    <p className="font-semibold">Entrega concluída ✅</p>
                    <p className="text-sm mt-1">
                      {rastreamento.entrega.recebedor}
                    </p>
                    <p className="text-sm">{rastreamento.entrega.entregueEm}</p>
                  </div>
                )}

                <div className="grid gap-3 mt-4">
                  {!rastreamentoAutomatico ? (
                    <button
                      onClick={iniciarRastreamentoAutomatico}
                      disabled={enviandoGps || !!rastreamento.entrega}
                      className="bg-green-600 hover:bg-green-700 rounded-xl p-4 font-semibold disabled:bg-slate-700"
                    >
                      Iniciar rastreamento automático
                    </button>
                  ) : (
                    <div className="bg-green-900 border border-green-700 rounded-xl p-4">
                      <p className="font-semibold text-green-300">
                        Rastreamento automático ativo
                      </p>
                      <p className="text-sm text-green-100 mt-1">
                        A localização continuará sendo enviada automaticamente até
                        a entrega ser finalizada.
                      </p>
                    </div>
                  )}

                  <button
                    onClick={() => enviarLocalizacao("Em rota")}
                    disabled={enviandoGps || !!rastreamento.entrega}
                    className="bg-blue-600 hover:bg-blue-700 rounded-xl p-4 font-semibold disabled:bg-slate-700"
                  >
                    Atualizar localização agora
                  </button>

                  <button
                    onClick={finalizarEntrega}
                    disabled={!!rastreamento.entrega}
                    className="bg-red-600 hover:bg-red-700 rounded-xl p-4 font-semibold disabled:bg-slate-700"
                  >
                    Finalizar entrega
                  </button>
                </div>

                <>
  {statusGps && (
    <p className="text-sm text-slate-300 mt-3">{statusGps}</p>
  )}

  {distanciaDestinoAtual !== null && (
    <p className="text-sm text-yellow-300 mt-2">
      Distância até destino:{" "}
      {distanciaDestinoAtual < 1000
        ? `${Math.round(distanciaDestinoAtual)} m`
        : `${(distanciaDestinoAtual / 1000).toFixed(2)} km`}
    </p>
  )}
</>
              </div>
            )}
          </div>
        </section>

        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-8">
          <h2 className="text-xl font-semibold mb-4">Meus dados</h2>

          <div className="grid gap-4">
            <input
              className="p-3 rounded-xl bg-slate-800 border border-slate-700 outline-none"
              placeholder="Seu nome. Ex: João"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />

            <input
              className="p-3 rounded-xl bg-slate-800 border border-slate-700 outline-none"
              placeholder="Seu local atual. Ex: São José dos Pinhais"
              value={localAtual}
              onChange={(e) => setLocalAtual(e.target.value)}
            />
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">Cargas disponíveis</h2>

          {cargasComDistancia.length === 0 ? (
            <p className="text-slate-400">Nenhuma carga disponível.</p>
          ) : (
            <div className="grid gap-4">
              {cargasComDistancia.map((carga) => (
                <div
                  key={carga.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-5"
                >
                  <p className="text-lg font-bold">
                    {carga.origem} → {carga.destino}
                  </p>

                  <p className="text-slate-300 mt-2">
                    Local de coleta: {carga.localColeta}
                  </p>

                  <p className="text-slate-300">
                    Raio aceito pela empresa:{" "}
                    {Number(carga.raioMaximo) >= 9999
                      ? "Sem limite"
                      : `${carga.raioMaximo || 30} km`}
                  </p>

                  {localAtual && (
                    <p className="mt-3">
                      Sua distância estimada:{" "}
                      <span
                        className={
                          carga.dentroDoRaio ? "text-green-400" : "text-red-400"
                        }
                      >
                        {carga.distancia >= 9999
                          ? "não encontrada"
                          : `${carga.distancia} km`}
                      </span>
                    </p>
                  )}

                  <p className="mt-2">
                    Status:{" "}
                    <span
                      className={
                        carga.status === "Disponível"
                          ? "text-green-400"
                          : "text-yellow-400"
                      }
                    >
                      {carga.status || "Disponível"}
                    </span>
                  </p>

                  {carga.motoristaAceito && (
                    <p className="text-blue-300 mt-2">
                      Aceita por: {carga.motoristaAceito.nome}
                    </p>
                  )}

                  <button
                    onClick={() => aceitarCarga(carga)}
                    disabled={carga.status !== "Disponível"}
                    className={`mt-4 rounded-xl px-4 py-3 font-semibold ${
                      carga.status === "Disponível"
                        ? "bg-green-600 hover:bg-green-700"
                        : "bg-slate-700 cursor-not-allowed"
                    }`}
                  >
                    {carga.status === "Disponível"
                      ? "Aceitar carga"
                      : "Carga indisponível"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}