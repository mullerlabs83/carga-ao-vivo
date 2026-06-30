"use client";

import { useState } from "react";

export default function RastreamentoPage() {
 const [numeroCarga, setNumeroCarga] = useState("");
const [transportadoraResponsavel, setTransportadoraResponsavel] = useState("");
  const [origem, setOrigem] = useState("");
  const [destino, setDestino] = useState("");
  const [placa, setPlaca] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [rastreamentoCriado, setRastreamentoCriado] = useState(null);

  function gerarRastreamento() {
    if (!numeroCarga || !transportadoraResponsavel || !origem || !destino) {
  alert("Preencha número da carga, transportadora responsável, origem e destino.");
  return;
}

    const codigo = String(Date.now());

    const novoRastreamento = {
      id: codigo,
      codigoRastreamento: codigo,
      tipo: "rastreamento-direto",
      numeroCarga,
transportadoraResponsavel,
      origem,
      destino,
      placa,
      observacoes,
      statusRastreamento: "Aguardando motorista iniciar",
      ultimaLocalizacao: null,
      ultimaAtualizacao: null,
      criadoEm: new Date().toLocaleString("pt-BR"),
    };

    const salvos = JSON.parse(localStorage.getItem("cargasAoVivo") || "[]");
    const atualizados = [novoRastreamento, ...salvos];

    localStorage.setItem("cargasAoVivo", JSON.stringify(atualizados));
    setRastreamentoCriado(novoRastreamento);
  }

  const link =
    rastreamentoCriado && typeof window !== "undefined"
      ? `${window.location.origin}/acompanhar/${rastreamentoCriado.codigoRastreamento}`
      : "";

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Criar Rastreamento Direto</h1>

        <p className="text-slate-300 mb-8">
          Use esta tela quando a carga já tem motorista contratado e você só
          precisa gerar um link de acompanhamento.
        </p>

        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="grid gap-4">
            <input
              className="p-3 rounded-xl bg-slate-800 border border-slate-700 outline-none"
              placeholder="Número da carga / pedido"
value={numeroCarga}
onChange={(e) => setNumeroCarga(e.target.value)}
            />

            <input
              className="p-3 rounded-xl bg-slate-800 border border-slate-700 outline-none"
             placeholder="Transportadora responsável"
value={transportadoraResponsavel}
onChange={(e) => setTransportadoraResponsavel(e.target.value)}
            />

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
              placeholder="Placa do veículo (opcional)"
              value={placa}
              onChange={(e) => setPlaca(e.target.value)}
            />

            <textarea
              className="p-3 rounded-xl bg-slate-800 border border-slate-700 outline-none"
              placeholder="Observações (opcional)"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
            />

            <button
              onClick={gerarRastreamento}
              className="bg-blue-600 hover:bg-blue-700 rounded-xl p-4 font-semibold"
            >
              Gerar link de rastreamento
            </button>
          </div>
        </section>

        {rastreamentoCriado && (
          <section className="mt-6 bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <p className="text-green-400 font-semibold">
              Rastreamento criado com sucesso
            </p>

            <p className="mt-3">Código: {rastreamentoCriado.codigoRastreamento}</p>

            <p className="text-sm text-slate-300 mt-2 break-all">Link: {link}</p>

            <div className="flex flex-col sm:flex-row gap-2 mt-4">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(link);
                  alert("Link copiado!");
                }}
                className="bg-blue-600 hover:bg-blue-700 rounded-xl px-4 py-2 font-semibold"
              >
                Copiar link
              </button>

              <a
                href={`https://wa.me/?text=${encodeURIComponent(
                  `Acompanhe sua carga em tempo real: ${link}`
                )}`}
                target="_blank"
                className="bg-green-600 hover:bg-green-700 rounded-xl px-4 py-2 font-semibold text-center"
              >
                Enviar pelo WhatsApp
              </a>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}