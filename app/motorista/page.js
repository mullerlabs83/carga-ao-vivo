"use client";

import { useEffect, useState } from "react";
import { ref, onValue, update } from "firebase/database";
import { db } from "../../services/firebase";

export default function Motorista() {
  const [cargas, setCargas] = useState([]);
  const [rastreandoId, setRastreandoId] = useState(null);

  useEffect(() => {
    const cargasRef = ref(db, "cargas");

    const unsubscribe = onValue(cargasRef, (snapshot) => {
      const dados = snapshot.val();

      if (dados) {
        const lista = Object.entries(dados)
          .map(([id, carga]) => ({
            id,
            ...carga,
          }))
          .filter((carga) => carga.status === "em_rota")
          .sort(
            (a, b) =>
              (b.motoristaVinculadoEm || 0) -
              (a.motoristaVinculadoEm || 0)
          );

        setCargas(lista);
      } else {
        setCargas([]);
      }
    });

    return () => unsubscribe();
  }, []);

  async function iniciarViagem(carga) {
    await update(ref(db, `cargas/${carga.id}`), {
      statusViagem: "viagem_iniciada",
      viagemIniciadaEm: Date.now(),
    });

    alert("Viagem iniciada!");
  }

  function compartilharLocalizacao(carga) {
    if (!navigator.geolocation) {
      alert("GPS não suportado neste navegador");
      return;
    }

    alert("Rastreamento iniciado");
    setRastreandoId(carga.id);

    navigator.geolocation.watchPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const velocidade = position.coords.speed || 0;
        const precisao = position.coords.accuracy || 0;

        try {
          await update(ref(db, `cargas/${carga.id}`), {
            localizacao: {
              lat,
              lng,
              velocidade,
              precisao,
              atualizadoEm: Date.now(),
            },
            statusRastreamento: "ativo",
          });

          console.log("GPS enviado:", lat, lng);
        } catch (error) {
          console.error(error);
          alert("Erro ao salvar localização");
        }
      },
      (erro) => {
        console.error(erro);
        alert("Erro ao acessar GPS");
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }

  async function finalizarEntrega(carga) {
    await update(ref(db, `cargas/${carga.id}`), {
      status: "entregue",
      statusViagem: "entrega_finalizada",
      statusRastreamento: "finalizado",
      entregueEm: Date.now(),
    });

    alert("Entrega finalizada!");
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-5xl mx-auto">
        <header className="mb-8">
          <p className="text-green-400 font-semibold">Carga Ao Vivo</p>

          <h1 className="text-4xl font-bold mt-2">Painel do Motorista</h1>

          <p className="text-gray-400 mt-2">
            Veja suas cargas em rota e atualize o andamento da entrega.
          </p>
        </header>

        {cargas.length === 0 && (
          <div className="card">
            <p className="text-gray-400">
              Nenhuma carga em rota vinculada no momento.
            </p>
          </div>
        )}

        <section className="grid gap-4">
          {cargas.map((carga) => (
            <div key={carga.id} className="card">
              <div className="flex justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold">
                    {carga.descricao || "Carga sem descrição"}
                  </h2>

                  <p className="text-gray-400 mt-2">
                    {carga.origem} → {carga.destino}
                  </p>

                  <p className="text-gray-500 text-sm mt-2">
                    Contratante: {carga.contratante}
                  </p>

                  {carga.motorista && (
                    <div className="mt-4 text-sm text-gray-300">
                      <p className="text-green-400 font-semibold">Motorista</p>
                      <p>Nome: {carga.motorista.nome}</p>
                      <p>Telefone: {carga.motorista.telefone}</p>
                      <p>Placa: {carga.motorista.placa}</p>
                    </div>
                  )}

                  {carga.statusViagem && (
                    <p className="text-blue-400 text-sm mt-4">
                      Status da viagem: {carga.statusViagem}
                    </p>
                  )}

                  {carga.localizacao && (
                    <div className="mt-4 text-xs text-gray-400">
                      <p className="text-green-400 font-semibold">
                        Última localização enviada
                      </p>
                      <p>Lat: {carga.localizacao.lat}</p>
                      <p>Lng: {carga.localizacao.lng}</p>
                      <p>Precisão: {Math.round(carga.localizacao.precisao || 0)}m</p>
                    </div>
                  )}

                  {rastreandoId === carga.id && (
                    <p className="text-green-400 text-sm mt-4">
                      📍 Rastreamento ativo
                    </p>
                  )}
                </div>

                <span className="text-green-400 text-sm font-semibold">
                  Em rota
                </span>
              </div>

              <div className="grid md:grid-cols-3 gap-3 mt-6">
                <button
                  onClick={() => iniciarViagem(carga)}
                  className="bg-blue-600 hover:bg-blue-700 rounded-xl p-4 font-semibold"
                >
                  Iniciar viagem
                </button>

                <button
                  onClick={() => compartilharLocalizacao(carga)}
                  className="btn-dark"
                >
                  Compartilhar localização
                </button>

                <button
                  onClick={() => finalizarEntrega(carga)}
                  className="bg-green-600 hover:bg-green-700 rounded-xl p-4 font-semibold"
                >
                  Finalizar entrega
                </button>
              </div>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}