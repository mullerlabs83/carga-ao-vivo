"use client";

import { useEffect, useRef, useState } from "react";
import { ref, get, set, push } from "firebase/database";
import { db } from "../../services/firebase";

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
  const [codigoRastreamento, setCodigoRastreamento] = useState("");
  const [rastreamento, setRastreamento] = useState(null);
  const [statusGps, setStatusGps] = useState("");
  const [enviandoGps, setEnviandoGps] = useState(false);
  const [rastreamentoAutomatico, setRastreamentoAutomatico] = useState(false);

  const [distanciaDestinoAtual, setDistanciaDestinoAtual] = useState(null);
  const [distanciaOrigemAtual, setDistanciaOrigemAtual] = useState(null);

  const [ultimaLatitude, setUltimaLatitude] = useState(null);
  const [ultimaLongitude, setUltimaLongitude] = useState(null);
  const [ultimaPrecisao, setUltimaPrecisao] = useState(null);
  const [ultimaVelocidade, setUltimaVelocidade] = useState(null);

  const watchIdRef = useRef(null);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, []);

  async function buscarRastreamento() {
    if (!codigoRastreamento.trim()) {
      alert("Digite o código do rastreamento.");
      return;
    }

    const codigo = codigoRastreamento.trim();
    const snapshot = await get(ref(db, `cargas/${codigo}`));

    if (!snapshot.exists()) {
      alert("Rastreamento não encontrado.");
      setRastreamento(null);
      return;
    }

    const dados = snapshot.val();

    setRastreamento({
      codigo,
      ...dados?.dados,
      origemCoordenadas: dados?.origemCoordenadas || null,
      destinoCoordenadas: dados?.destinoCoordenadas || null,
      geofence: dados?.geofence || null,
      entrega: dados?.entrega || null,
      localizacao: dados?.localizacao || null,
    });
  }

  function destinoLiberado() {
    return (
      rastreamento?.gpsValidado === true ||
      rastreamento?.rastreamentoIniciado === true ||
      rastreamento?.status === "Rastreamento iniciado" ||
      rastreamento?.status === "Em rota" ||
      rastreamento?.status === "Chegou ao destino" ||
      rastreamento?.entrega
    );
  }

  function pararWatchGps() {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }

  async function verificarSaidaOrigem(latitude, longitude, atualizadoEm) {
    const codigo = codigoRastreamento.trim();
    if (!codigo) return;

    const cargaSnapshot = await get(ref(db, `cargas/${codigo}`));
    if (!cargaSnapshot.exists()) return;

    const carga = cargaSnapshot.val();

    if (!carga?.origemCoordenadas) return;
    if (carga?.entrega) return;

    const distanciaOrigem = calcularDistanciaGps(
      latitude,
      longitude,
      carga.origemCoordenadas.latitude,
      carga.origemCoordenadas.longitude
    );

    setDistanciaOrigemAtual(distanciaOrigem);

    const distanciaKm = distanciaOrigem / 1000;
    const linkJaLiberado = carga?.dados?.linkClienteLiberado;

    if (distanciaKm >= 2 && !linkJaLiberado) {
      await set(ref(db, `cargas/${codigo}/dados/linkClienteLiberado`), true);
      await set(
        ref(db, `cargas/${codigo}/dados/linkClienteLiberadoEm`),
        atualizadoEm
      );
      await set(
        ref(db, `cargas/${codigo}/dados/distanciaOrigemKmQuandoLiberou`),
        Number(distanciaKm.toFixed(2))
      );
      await set(ref(db, `cargas/${codigo}/dados/status`), "Em rota");

      setStatusGps(
        `🚚 Carga em rota. Link do cliente liberado após ${distanciaKm.toFixed(
          2
        )} km da origem.`
      );
    }
  }

  async function verificarGeofenceDestino(latitude, longitude, atualizadoEm) {
    const codigo = codigoRastreamento.trim();
    if (!codigo) return;

    const cargaSnapshot = await get(ref(db, `cargas/${codigo}`));
    if (!cargaSnapshot.exists()) return;

    const carga = cargaSnapshot.val();

    if (!carga?.destinoCoordenadas || !carga?.geofence?.ativa) return;
    if (carga?.entrega) return;

    const distanciaDestino = calcularDistanciaGps(
      latitude,
      longitude,
      carga.destinoCoordenadas.latitude,
      carga.destinoCoordenadas.longitude
    );

    setDistanciaDestinoAtual(distanciaDestino);

    const raioEntradaMetros = carga.geofence.raioMetros || 1000;
    const raioSaidaMetros =
      carga.geofence.raioSaidaMetros || raioEntradaMetros + 500;

    const dentroGeofence = distanciaDestino <= raioEntradaMetros;
    const saiuDaGeofence = distanciaDestino >= raioSaidaMetros;

    if (dentroGeofence && !carga.geofence.entrouNoDestino) {
      await set(ref(db, `cargas/${codigo}/geofence`), {
        ...carga.geofence,
        entrouNoDestino: true,
        saiuDoDestino: false,
        entregaAutomatica: false,
        horarioEntradaDestino: atualizadoEm,
        distanciaEntradaMetros: Math.round(distanciaDestino),
      });

      await set(ref(db, `cargas/${codigo}/dados/status`), "Chegou ao destino");

      setStatusGps(
        `📍 Chegada detectada no destino. Distância: ${Math.round(
          distanciaDestino
        )} m`
      );

      buscarRastreamento();
      return;
    }

    if (
      saiuDaGeofence &&
      carga.geofence.entrouNoDestino &&
      !carga.geofence.saiuDoDestino &&
      !carga.geofence.entregaAutomatica
    ) {
      await set(ref(db, `cargas/${codigo}/geofence`), {
        ...carga.geofence,
        saiuDoDestino: true,
        entregaAutomatica: true,
        horarioSaidaDestino: atualizadoEm,
        distanciaSaidaMetros: Math.round(distanciaDestino),
      });

      await set(ref(db, `cargas/${codigo}/entrega`), {
        recebedor: "Entrega finalizada automaticamente por geofence",
        entregueEm: atualizadoEm,
        entregueEmMs: Date.now(),
        tipo: "automatica_geofence",
      });

      await set(
        ref(db, `cargas/${codigo}/dados/status`),
        "Entregue automaticamente"
      );

      pararWatchGps();
      setRastreamentoAutomatico(false);
      setStatusGps("✅ Entrega finalizada automaticamente por geofence.");
      buscarRastreamento();
    }
  }

  async function salvarLocalizacao(posicao, statusNovo = "Rastreamento iniciado") {
    const codigo = codigoRastreamento.trim();
    if (!codigo) return;

    const latitude = posicao.coords.latitude;
    const longitude = posicao.coords.longitude;
    const precisao = posicao.coords.accuracy || null;
    const velocidade = posicao.coords.speed || null;
    const atualizadoEm = new Date().toLocaleString("pt-BR");
    const timestamp = Date.now();

    setUltimaLatitude(latitude);
    setUltimaLongitude(longitude);
    setUltimaPrecisao(precisao);
    setUltimaVelocidade(velocidade);

    if (precisao && precisao > 200) {
      pararWatchGps();
      setRastreamentoAutomatico(false);
      setEnviandoGps(false);

      setStatusGps(
        `⚠️ GPS com baixa precisão (${Math.round(
          precisao
        )} m). Vá para área aberta e tente novamente.`
      );

      return;
    }

    setRastreamentoAutomatico(true);
    setEnviandoGps(false);

    await set(ref(db, `cargas/${codigo}/localizacao`), {
      latitude,
      longitude,
      precisao,
      velocidade,
      atualizadoEm,
      timestamp,
    });

    await push(ref(db, `cargas/${codigo}/trajeto`), {
      latitude,
      longitude,
      precisao,
      velocidade,
      atualizadoEm,
      timestamp,
    });

    const cargaSnapshot = await get(ref(db, `cargas/${codigo}`));
    const cargaAtual = cargaSnapshot.exists() ? cargaSnapshot.val() : null;

    if (!cargaAtual || cargaAtual?.entrega) {
      buscarRastreamento();
      return;
    }

    if (!cargaAtual?.dados?.rastreamentoIniciado) {
      await set(ref(db, `cargas/${codigo}/dados/rastreamentoIniciado`), true);
      await set(ref(db, `cargas/${codigo}/dados/gpsValidado`), true);
      await set(
        ref(db, `cargas/${codigo}/dados/rastreamentoIniciadoEm`),
        atualizadoEm
      );
      await set(ref(db, `cargas/${codigo}/dados/status`), statusNovo);
    }

    await verificarSaidaOrigem(latitude, longitude, atualizadoEm);
    await verificarGeofenceDestino(latitude, longitude, atualizadoEm);

    setStatusGps(`📡 GPS ativo. Última posição enviada: ${atualizadoEm}`);
    buscarRastreamento();
  }

  function testarGpsEAtualizar(statusNovo = "Rastreamento iniciado") {
    const codigo = codigoRastreamento.trim();

    if (!codigo) {
      alert("Digite o código do rastreamento.");
      return;
    }

    if (!navigator.geolocation) {
      setStatusGps("GPS não disponível neste navegador.");
      return;
    }

    setEnviandoGps(true);
    setStatusGps("Solicitando GPS...");

    navigator.geolocation.getCurrentPosition(
      async (posicao) => {
        await salvarLocalizacao(posicao, statusNovo);
      },
      (erro) => {
        setStatusGps(`GPS obrigatório. Erro: ${erro.message}`);
        setEnviandoGps(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 30000,
        maximumAge: 0,
      }
    );
  }

  async function iniciarRastreamentoAutomatico() {
    const codigo = codigoRastreamento.trim();

    if (!codigo) {
      alert("Digite o código do rastreamento.");
      return;
    }

    if (!rastreamento) {
      alert("Busque o rastreamento antes de iniciar.");
      return;
    }

    if (rastreamento.entrega) {
      alert("Esta entrega já foi finalizada.");
      return;
    }

    if (!navigator.geolocation) {
      setStatusGps("GPS não disponível neste navegador.");
      return;
    }

    pararWatchGps();

    setEnviandoGps(true);
    setStatusGps("Validando GPS obrigatório...");

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (posicao) => {
        await salvarLocalizacao(posicao, "Rastreamento iniciado");
      },
      (erro) => {
        setStatusGps(`GPS obrigatório. Erro: ${erro.message}`);
        setEnviandoGps(false);
        setRastreamentoAutomatico(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 30000,
        maximumAge: 0,
      }
    );
  }

  async function finalizarEntrega() {
    const codigo = codigoRastreamento.trim();

    if (!codigo) {
      alert("Digite o código do rastreamento.");
      return;
    }

    const confirmar = window.confirm("Confirmar finalização manual da entrega?");
    if (!confirmar) return;

    const entregueEm = new Date().toLocaleString("pt-BR");

    await set(ref(db, `cargas/${codigo}/entrega`), {
      recebedor: "Entrega finalizada pelo motorista",
      entregueEm,
      entregueEmMs: Date.now(),
      tipo: "manual_motorista",
    });

    await set(ref(db, `cargas/${codigo}/dados/status`), "Entregue");

    pararWatchGps();
    setRastreamentoAutomatico(false);

    alert("Entrega finalizada.");
    buscarRastreamento();
  }

  const podeVerDestino = destinoLiberado();

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Área do Motorista</h1>

        <p className="text-slate-300 mb-8">
          Digite o código da carga, ative o GPS obrigatório e acompanhe sua
          rota até a entrega.
        </p>

        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-8">
          <h2 className="text-xl font-semibold mb-4">Buscar carga</h2>

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
              Buscar carga
            </button>
          </div>
        </section>

        {rastreamento && (
          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h2 className="text-xl font-semibold mb-4">Dados da carga</h2>

            <div className="grid gap-2 bg-slate-800 rounded-xl p-4">
              <p>
                <strong>Carga / Pedido:</strong>{" "}
                {rastreamento.numeroCarga || codigoRastreamento || "-"}
              </p>

              <p>
                <strong>Cliente:</strong> {rastreamento.cliente || "-"}
              </p>

              <p>
                <strong>Motorista:</strong> {rastreamento.motorista || "-"}
              </p>

              <p>
                <strong>Placa:</strong> {rastreamento.placa || "-"}
              </p>

              <p>
                <strong>Produto:</strong> {rastreamento.produto || "-"}
              </p>

              <p>
                <strong>Origem:</strong> {rastreamento.origem || "-"}
              </p>

              <p>
                <strong>Destino:</strong>{" "}
                {podeVerDestino ? (
                  rastreamento.destino || "-"
                ) : (
                  <span className="text-yellow-300">
                    🔒 Protegido — ative o GPS para liberar
                  </span>
                )}
              </p>

              <p>
                <strong>Status:</strong> {rastreamento.status || "-"}
              </p>
            </div>

            {!podeVerDestino && !rastreamento.entrega && (
              <div className="mt-4 bg-yellow-950 border border-yellow-700 rounded-xl p-4">
                <p className="font-semibold text-yellow-300">
                  GPS obrigatório
                </p>
                <p className="text-sm text-yellow-100 mt-1">
                  Para acessar o endereço completo do destino, ative o
                  rastreamento GPS. O destino só será liberado se o GPS tiver
                  boa precisão.
                </p>
              </div>
            )}

            {rastreamento.entrega && (
              <div className="mt-4 bg-green-900 border border-green-700 rounded-xl p-4">
                <p className="font-semibold">Entrega concluída ✅</p>
                <p className="text-sm mt-1">{rastreamento.entrega.recebedor}</p>
                <p className="text-sm">{rastreamento.entrega.entregueEm}</p>
              </div>
            )}

            <div className="grid gap-3 mt-5">
              {!rastreamentoAutomatico && !rastreamento.entrega && (
                <button
                  onClick={iniciarRastreamentoAutomatico}
                  disabled={enviandoGps}
                  className="bg-green-600 hover:bg-green-700 rounded-xl p-4 font-semibold disabled:bg-slate-700"
                >
                  {enviandoGps
                    ? "Validando GPS..."
                    : "Ativar GPS e iniciar rastreamento"}
                </button>
              )}

              {rastreamentoAutomatico && !rastreamento.entrega && (
                <div className="bg-green-900 border border-green-700 rounded-xl p-4">
                  <p className="font-semibold text-green-300">
                    Rastreamento GPS ativo
                  </p>
                  <p className="text-sm text-green-100 mt-1">
                    O rastreamento permanecerá ativo até a entrega ser
                    concluída. Não feche esta tela durante o trajeto.
                  </p>
                </div>
              )}

              <button
                onClick={() => testarGpsEAtualizar("Rastreamento iniciado")}
                disabled={enviandoGps || !!rastreamento.entrega}
                className="bg-blue-600 hover:bg-blue-700 rounded-xl p-4 font-semibold disabled:bg-slate-700"
              >
                Atualizar GPS agora
              </button>

              <button
                onClick={finalizarEntrega}
                disabled={!!rastreamento.entrega}
                className="bg-red-600 hover:bg-red-700 rounded-xl p-4 font-semibold disabled:bg-slate-700"
              >
                Finalizar entrega
              </button>
            </div>

            {statusGps && (
              <p className="text-sm text-slate-300 mt-4">{statusGps}</p>
            )}

            {distanciaOrigemAtual !== null && (
              <p className="text-sm text-blue-300 mt-2">
                Distância da origem:{" "}
                {distanciaOrigemAtual < 1000
                  ? `${Math.round(distanciaOrigemAtual)} m`
                  : `${(distanciaOrigemAtual / 1000).toFixed(2)} km`}
              </p>
            )}

            {distanciaDestinoAtual !== null && (
              <p className="text-sm text-yellow-300 mt-2">
                Distância até destino:{" "}
                {distanciaDestinoAtual < 1000
                  ? `${Math.round(distanciaDestinoAtual)} m`
                  : `${(distanciaDestinoAtual / 1000).toFixed(2)} km`}
              </p>
            )}

            {rastreamento.linkClienteLiberado && (
              <div className="mt-4 bg-blue-950 border border-blue-700 rounded-xl p-4">
                <p className="font-semibold text-blue-300">
                  Link do cliente liberado
                </p>
                <p className="text-sm break-all mt-1">
                  /acompanhar/{codigoRastreamento.trim()}
                </p>
              </div>
            )}

            {ultimaLatitude !== null && ultimaLongitude !== null && (
              <div className="text-xs text-slate-400 mt-4 bg-slate-950 rounded-xl p-3">
                <p>
                  Última latitude:{" "}
                  <span className="text-slate-200">
                    {ultimaLatitude.toFixed(6)}
                  </span>
                </p>

                <p>
                  Última longitude:{" "}
                  <span className="text-slate-200">
                    {ultimaLongitude.toFixed(6)}
                  </span>
                </p>

                {ultimaPrecisao !== null && (
                  <p>
                    Precisão do GPS:{" "}
                    <span className="text-slate-200">
                      {Math.round(ultimaPrecisao)} m
                    </span>
                  </p>
                )}

                {ultimaVelocidade !== null && (
                  <p>
                    Velocidade aproximada:{" "}
                    <span className="text-slate-200">
                      {(ultimaVelocidade * 3.6).toFixed(1)} km/h
                    </span>
                  </p>
                )}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}