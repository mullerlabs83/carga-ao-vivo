"use client";

import { useEffect, useState } from "react";

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

  useEffect(() => {
    carregarCargas();
  }, []);

  function carregarCargas() {
    const salvas = JSON.parse(localStorage.getItem("cargasAoVivo") || "[]");
    setCargas(salvas);
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
          Veja cargas disponíveis próximas ao seu local atual.
        </p>

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