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

  const cargasAtivas = listaCargas.filter((carga) => !carga.entrega);
  const historicoEntregas = listaCargas.filter((carga) => carga.entrega);

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
          }))
          .filter((carga) => {
            return (
              carga.cliente ||
              carga.motorista ||
              carga.produto ||
              carga.localizacao ||
              carga.entrega
            );
          });

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

    const pararLocalizacao = onValue(localizacaoRef, (snapshot) => {
      setLocalizacao(snapshot.exists() ? snapshot.val() : null);
    });

    const pararTrajeto = onValue(trajetoRef, (snapshot) => {
      setTrajeto(snapshot.exists() ? Object.values(snapshot.val()) : []);
    });

    const pararEntrega = onValue(entregaRef, (snapshot) => {
      setEntrega(snapshot.exists() ? snapshot.val() : null);
    });

    return () => {
      pararLocalizacao();
      pararTrajeto();
      pararEntrega();
    };
  }, [cargaSelecionada]);

  async function limparTestesAntigos() {
    const confirmar = window.confirm(
      "Isso vai apagar apenas cargas vazias/sem dados reais. Deseja continuar?"
    );

    if (!confirmar) return;

    const cargasVazias = listaCargas.filter((carga) => {
      return (
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

        <p><strong>Cliente:</strong> {carga.cliente || "-"}</p>
        <p><strong>Motorista:</strong> {carga.motorista || "-"}</p>
        <p><strong>Produto:</strong> {carga.produto || "-"}</p>
        <p><strong>Status:</strong> {carga.status || "-"}</p>

        {carga.entrega && (
          <div className="mt-3 bg-green-950 rounded-xl p-3 text-sm">
            <p><strong>✅ Recebido por:</strong> {carga.entrega.recebedor || "-"}</p>
            <p><strong>Horário:</strong> {carga.entrega.entregueEm || "-"}</p>
          </div>
        )}
      </button>
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

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <div className="bg-slate-900 rounded-2xl p-4">
          <p className="text-slate-400">Total de cargas</p>
          <p className="text-3xl font-bold">{listaCargas.length}</p>
        </div>

        <div className="bg-slate-900 rounded-2xl p-4">
          <p className="text-slate-400">Cargas ativas</p>
          <p className="text-3xl font-bold text-orange-400">
            {cargasAtivas.length}
          </p>
        </div>

        <div className="bg-slate-900 rounded-2xl p-4">
          <p className="text-slate-400">Entregas concluídas</p>
          <p className="text-3xl font-bold text-green-400">
            {historicoEntregas.length}
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
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {historicoEntregas.map((carga) => (
              <CardCarga key={carga.codigo} carga={carga} historico />
            ))}
          </div>
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
                <p><strong>Recebido por:</strong> {entrega.recebedor || "-"}</p>
                <p><strong>Horário:</strong> {entrega.entregueEm || "-"}</p>
              </div>
            )}

            {!localizacao ? (
              <p className="text-slate-400">
                Aguardando rastreamento dessa carga...
              </p>
            ) : (
              <>
                <div className="mb-4 bg-slate-800 rounded-xl p-4 grid gap-2 md:grid-cols-2">
                  <p><strong>Status:</strong> {localizacao.status || "-"}</p>
                  <p><strong>Motorista:</strong> {localizacao.motorista || "-"}</p>
                  <p><strong>Veículo:</strong> {localizacao.veiculo || "-"}</p>
                  <p><strong>Carga:</strong> {localizacao.carga || "-"}</p>
                  <p><strong>Pontos registrados:</strong> {trajeto.length}</p>
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