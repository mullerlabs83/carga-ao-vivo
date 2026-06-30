"use client";

import { useEffect, useRef, useState } from "react";
import { ref, get, set, push } from "firebase/database";
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

export default function MotoristaPage() {
  const [nome, setNome] = useState("");
  const [localAtual, setLocalAtual] = useState("");
  const [cargas, setCargas] = useState([]);

  const [codigoRastreamento, setCodigoRastreamento] = useState("");
  const [rastreamento, setRastreamento] = useState(null);
  const [statusGps, setStatusGps] = useState("");
  const [enviandoGps, setEnviandoGps] = useState(false);
  const [rastreamentoAutomatico, setRastreamentoAutomatico] = useState(false);

  const intervaloRef = useRef(null);

  useEffect(() => {
    carregarCargas();

    return () => {
      if (intervaloRef.current) {
        clearInterval(intervaloRef.current);
      }
    };
  }, []);

  function carregarCargas() {
    const salvas = JSON.parse(localStorage.getItem("cargasAoVivo") || "[]");
    setCargas(salvas);
  }

  async function buscarRastreamento() {
    if (!codigoRastreamento) {
      alert("Digite o código do rastreamento.");
      return;
    }

    const snapshot = await get(ref(db, `cargas/${codigoRastreamento}/dados`));

    if (!snapshot.exists()) {
      alert("Rastreamento não encontrado.");
      setRastreamento(null);
      return;
    }

    setRastreamento(snapshot.val());
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

        await set(ref(db, `cargas/${codigoRastreamento}/localizacao`), {
          latitude,
          longitude,
          atualizadoEm,
        });

        await push(ref(db, `cargas/${codigoRastreamento}/trajeto`), {
          latitude,
          longitude,
          atualizadoEm,
        });

        await set(
          ref(db, `cargas/${codigoRastreamento}/dados/status`),
          statusNovo
        );

        setStatusGps(`Localização enviada: ${atualizadoEm}`);
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
    }, 120000);

    setRastreamentoAutomatico(true);
    setStatusGps("Rastreamento automático iniciado. Atualiza a cada 2 minutos.");
  }

  function pararRastreamentoAutomatico() {
    if (intervaloRef.current) {
      clearInterval(intervaloRef.current);
      intervaloRef.current = null;
    }

    setRastreamentoAutomatico(false);
    setStatusGps("Rastreamento automático pausado.");
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
    });

    await set(ref(db, `cargas/${codigoRastreamento}/dados/status`), "Entregue");

    alert("Entrega finalizada.");
    buscarRastreamento();
  }

  function aceitarCarga(carga) {
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

    const novasCargas = cargas.map((item) => {
      if (item.id === carga.id) {
        return {
          ...item,
          status: "Aceita",
          motoristaAceito: {
            nome,
            localAtual,
            distancia,
            aceitoEm: new Date().toLocaleString("pt-BR"),
          },
        };
      }

      return item;
    });

    localStorage.setItem("cargasAoVivo", JSON.stringify(novasCargas));
    setCargas(novasCargas);

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
                  {rastreamento.numeroCarga || "-"}
                </p>

                <p>
                  <strong>Transportadora responsável:</strong>{" "}
                  {rastreamento.transportadoraResponsavel || "-"}
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

                <div className="grid gap-3 mt-4">
                  {!rastreamentoAutomatico ? (
  <button
    onClick={iniciarRastreamentoAutomatico}
    disabled={enviandoGps}
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
      A localização continuará sendo enviada automaticamente até a entrega ser finalizada.
    </p>
  </div>
)}

                  <button
                    onClick={() => enviarLocalizacao("Em rota")}
                    disabled={enviandoGps}
                    className="bg-blue-600 hover:bg-blue-700 rounded-xl p-4 font-semibold disabled:bg-slate-700"
                  >
                    Atualizar localização agora
                  </button>

                  <button
                    onClick={finalizarEntrega}
                    className="bg-red-600 hover:bg-red-700 rounded-xl p-4 font-semibold"
                  >
                    Finalizar entrega
                  </button>
                </div>

                {statusGps && (
                  <p className="text-sm text-slate-300 mt-3">{statusGps}</p>
                )}
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

            <button
              onClick={carregarCargas}
              className="bg-blue-600 hover:bg-blue-700 rounded-xl p-4 font-semibold"
            >
              Atualizar cargas
            </button>
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
                    {carga.raioMaximo >= 9999
                      ? "Sem limite"
                      : `${carga.raioMaximo} km`}
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
                      {carga.status}
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