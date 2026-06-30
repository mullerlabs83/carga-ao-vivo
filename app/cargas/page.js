"use client";

import { useEffect, useState } from "react";
import { ref, set, onValue, remove } from "firebase/database";
import { db } from "../../services/firebase";

export default function CargasPage() {
  const [origem, setOrigem] = useState("");
  const [destino, setDestino] = useState("");
  const [localColeta, setLocalColeta] = useState("");
  const [raioMaximo, setRaioMaximo] = useState("30");
  const [cargas, setCargas] = useState([]);
  const [publicando, setPublicando] = useState(false);

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
          entrega: carga?.entrega || null,
          localizacao: carga?.localizacao || null,
        }))
        .filter((carga) => carga.origem || carga.destino || carga.localColeta)
        .sort((a, b) => Number(b.id) - Number(a.id));

      setCargas(lista);
    });

    return () => parar();
  }, []);

  async function buscarCoordenadas(endereco) {
    try {
      const resposta = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          endereco
        )}&limit=1`
      );

      const dados = await resposta.json();

      if (!dados || dados.length === 0) {
        return null;
      }

      return {
        latitude: Number(dados[0].lat),
        longitude: Number(dados[0].lon),
      };
    } catch (erro) {
      console.error("Erro ao buscar coordenadas:", erro);
      return null;
    }
  }

  async function publicarCarga() {
    if (!origem || !destino || !localColeta || !raioMaximo) {
      alert("Preencha todos os campos.");
      return;
    }

    setPublicando(true);

    const coordenadasDestino = await buscarCoordenadas(destino);
    const id = Date.now();

    await set(ref(db, `cargas/${id}`), {
      dados: {
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
        statusRastreamento: coordenadasDestino
          ? "Desativado"
          : "Desativado - destino sem coordenada automática",
        criadaEm: new Date().toLocaleString("pt-BR"),
      },

      destinoCoordenadas: coordenadasDestino,

      geofence: {
        ativa: !!coordenadasDestino,
        raioMetros: 500,
        entrouNoDestino: false,
        saiuDoDestino: false,
        entregaAutomatica: false,
        horarioEntradaDestino: null,
        horarioSaidaDestino: null,
      },
    });

    setOrigem("");
    setDestino("");
    setLocalColeta("");
    setRaioMaximo("30");
    setPublicando(false);

    if (!coordenadasDestino) {
      alert(
        "Carga publicada, mas o sistema não conseguiu localizar automaticamente o destino. Depois ajustamos isso com busca de endereço mais forte."
      );
    }
  }

  async function excluirCarga(id) {
    await remove(ref(db, `cargas/${id}`));
  }

  async function ativarRastreamento(id) {
    const carga = cargas.find((item) => String(item.id) === String(id));

    if (!carga) {
      alert("Carga não encontrada.");
      return;
    }

    await set(ref(db, `cargas/${id}/dados`), {
      origem: carga.origem || "",
      destino: carga.destino || "",
      localColeta: carga.localColeta || "",
      raioMaximo: carga.raioMaximo || 30,
      status: carga.status || "Disponível",
      motoristaAceito: carga.motoristaAceito || null,
      rastreamentoOnline: true,
      codigoRastreamento: String(id),
      ultimaLocalizacao: carga.ultimaLocalizacao || null,
      ultimaAtualizacao: carga.ultimaAtualizacao || null,
      statusRastreamento: "Aguardando motorista iniciar",
      criadaEm: carga.criadaEm || new Date().toLocaleString("pt-BR"),
    });
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
              placeholder="Destino. Ex: Rua Augusta, 100 - São Paulo"
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
              disabled={publicando}
              className="bg-blue-600 hover:bg-blue-700 rounded-xl p-4 font-semibold disabled:bg-slate-700"
            >
              {publicando ? "Publicando..." : "Publicar carga"}
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
                    Raio máximo motorista:{" "}
                    {Number(carga.raioMaximo) >= 9999
                      ? "Sem limite"
                      : `${carga.raioMaximo || 30} km`}
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
                      {carga.status || "Disponível"}
                    </span>
                  </p>

                  <p className="text-xs text-slate-500 mt-3">
                    Criada em: {carga.criadaEm || "-"}
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
                        Código: {carga.codigoRastreamento || carga.id}
                      </p>

                      <p className="text-xs text-slate-400 mt-2 break-all">
                        Link:{" "}
                        {typeof window !== "undefined"
                          ? `${window.location.origin}/acompanhar/${
                              carga.codigoRastreamento || carga.id
                            }`
                          : ""}
                      </p>

                      <div className="flex flex-col sm:flex-row gap-2 mt-3">
                        <button
                          onClick={() => {
                            const link = `${window.location.origin}/acompanhar/${
                              carga.codigoRastreamento || carga.id
                            }`;
                            navigator.clipboard.writeText(link);
                            alert("Link copiado!");
                          }}
                          className="bg-blue-600 hover:bg-blue-700 rounded-xl px-4 py-2 font-semibold"
                        >
                          Copiar link
                        </button>

                        <a
                          href={`https://wa.me/?text=${encodeURIComponent(
                            `Acompanhe sua carga em tempo real: ${
                              typeof window !== "undefined"
                                ? `${window.location.origin}/acompanhar/${
                                    carga.codigoRastreamento || carga.id
                                  }`
                                : ""
                            }`
                          )}`}
                          target="_blank"
                          className="bg-green-600 hover:bg-green-700 rounded-xl px-4 py-2 font-semibold text-center"
                        >
                          Enviar pelo WhatsApp
                        </a>
                      </div>

                      <p className="text-xs text-slate-400 mt-2">
                        {carga.statusRastreamento || ""}
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