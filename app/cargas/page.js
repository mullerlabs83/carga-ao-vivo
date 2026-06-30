"use client";

import { useEffect, useState } from "react";

export default function CargasPage() {
  const [origem, setOrigem] = useState("");
  const [destino, setDestino] = useState("");
  const [localColeta, setLocalColeta] = useState("");
  const [raioMaximo, setRaioMaximo] = useState("30");
  const [cargas, setCargas] = useState([]);

  useEffect(() => {
    const salvas = JSON.parse(localStorage.getItem("cargasAoVivo") || "[]");
    setCargas(salvas);
  }, []);

  function salvarCargas(novasCargas) {
    localStorage.setItem("cargasAoVivo", JSON.stringify(novasCargas));
    setCargas(novasCargas);
  }

  function publicarCarga() {
    if (!origem || !destino || !localColeta || !raioMaximo) {
      alert("Preencha todos os campos.");
      return;
    }

    const novaCarga = {
      id: Date.now(),
      origem,
      destino,
      localColeta,
      raioMaximo: Number(raioMaximo),
      status: "Disponível",
      motoristaAceito: null,
      rastreamentoOnline: false,
codigoRastreamento: null,
ultimaLocalizacao: null,
ultimaAtualizacao: null,
statusRastreamento: "Desativado",
      criadaEm: new Date().toLocaleString("pt-BR"),
    };

    const novasCargas = [novaCarga, ...cargas];
    salvarCargas(novasCargas);

    setOrigem("");
    setDestino("");
    setLocalColeta("");
    setRaioMaximo("30");
  }

  function excluirCarga(id) {
    const novasCargas = cargas.filter((carga) => carga.id !== id);
    salvarCargas(novasCargas);
  }
function ativarRastreamento(id) {
  const novasCargas = cargas.map((carga) => {
    if (carga.id === id) {
      return {
        ...carga,
        rastreamentoOnline: true,
        codigoRastreamento: String(carga.id),
        statusRastreamento: "Aguardando motorista iniciar",
      };
    }

    return carga;
  });

  salvarCargas(novasCargas);
}
  return (
    <main className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Carga Ao Vivo</h1>
        <p className="text-slate-300 mb-8">
          Cadastro de cargas com filtro por local de coleta e raio máximo.
        </p>

        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-8">
          <h2 className="text-xl font-semibold mb-4">Publicar nova carga</h2>

          <div className="grid gap-4">
            <input
              className="p-3 rounded-xl bg-slate-800 border border-slate-700 outline-none"
              placeholder="Origem. Ex: Curitiba - PR"
              value={origem}
              onChange={(e) => setOrigem(e.target.value)}
            />

            <input
              className="p-3 rounded-xl bg-slate-800 border border-slate-700 outline-none"
              placeholder="Destino. Ex: São Paulo - SP"
              value={destino}
              onChange={(e) => setDestino(e.target.value)}
            />

            <input
              className="p-3 rounded-xl bg-slate-800 border border-slate-700 outline-none"
              placeholder="Local de coleta. Ex: Curitiba"
              value={localColeta}
              onChange={(e) => setLocalColeta(e.target.value)}
            />

            <select
              className="p-3 rounded-xl bg-slate-800 border border-slate-700 outline-none"
              value={raioMaximo}
              onChange={(e) => setRaioMaximo(e.target.value)}
            >
              <option value="10">Aceito motoristas até 10 km</option>
              <option value="30">Aceito motoristas até 30 km</option>
              <option value="50">Aceito motoristas até 50 km</option>
              <option value="100">Aceito motoristas até 100 km</option>
              <option value="9999">Sem limite de distância</option>
            </select>

            <button
              onClick={publicarCarga}
              className="bg-blue-600 hover:bg-blue-700 rounded-xl p-4 font-semibold"
            >
              Publicar carga
            </button>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">Cargas publicadas</h2>

          {cargas.length === 0 ? (
            <p className="text-slate-400">Nenhuma carga publicada ainda.</p>
          ) : (
            <div className="grid gap-4">
              {cargas.map((carga) => (
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
                    Raio máximo:{" "}
                    {carga.raioMaximo >= 9999
                      ? "Sem limite"
                      : `${carga.raioMaximo} km`}
                  </p>

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
                      Motorista: {carga.motoristaAceito.nome} —{" "}
                      {carga.motoristaAceito.localAtual} (
                      {carga.motoristaAceito.distancia} km)
                    </p>
                  )}

                  <p className="text-xs text-slate-500 mt-3">
                    Criada em: {carga.criadaEm}
                  </p>
{!carga.rastreamentoOnline ? (
  <button
    onClick={() => ativarRastreamento(carga.id)}
    className="mt-4 bg-green-600 hover:bg-green-700 rounded-xl px-4 py-2 font-semibold"
  >
    Ativar rastreamento online
  </button>
) : (
  <div className="mt-4 bg-slate-800 p-3 rounded-xl">
    <p className="text-green-400 font-semibold">
      Rastreamento online ativo
    </p>

    <p className="text-sm mt-2">
      Código: {carga.codigoRastreamento}
    </p>
<p className="text-xs text-slate-400 mt-2 break-all">
  Link: {typeof window !== "undefined" ? `${window.location.origin}/acompanhar/${carga.codigoRastreamento}` : ""}
</p>

<div className="flex flex-col sm:flex-row gap-2 mt-3">
  <button
    onClick={() => {
      const link = `${window.location.origin}/acompanhar/${carga.codigoRastreamento}`;
      navigator.clipboard.writeText(link);
      alert("Link copiado!");
    }}
    className="bg-blue-600 hover:bg-blue-700 rounded-xl px-4 py-2 font-semibold"
  >
    Copiar link
  </button>

  <a
    href={`https://wa.me/?text=${encodeURIComponent(
      `Acompanhe sua carga em tempo real: ${typeof window !== "undefined" ? `${window.location.origin}/acompanhar/${carga.codigoRastreamento}` : ""}`
    )}`}
    target="_blank"
    className="bg-green-600 hover:bg-green-700 rounded-xl px-4 py-2 font-semibold text-center"
  >
    Enviar pelo WhatsApp
  </a>
</div>
    <p className="text-xs text-slate-400 mt-1">
      {carga.statusRastreamento}
    </p>
  </div>
)}
                  <button
                    onClick={() => excluirCarga(carga.id)}
                    className="mt-4 bg-red-600 hover:bg-red-700 rounded-xl px-4 py-2 font-semibold"
                  >
                    Excluir
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