"use client";

import { useEffect, useState } from "react";
import { ref, push, set, onValue, update } from "firebase/database";
import { db } from "../../services/firebase";

const modulos = {
  core: true,
  trackingPlus: false,
  alertas: false,
  pod: true,
  driverHub: false,
  marketplace: false,
  finance: false,
};

const usuario = {
  nome: "Admin",
  perfil: "admin",
};

export default function Admin() {
  const [contratante, setContratante] = useState("");
  const [telefone, setTelefone] = useState("");
  const [descricao, setDescricao] = useState("");
  const [peso, setPeso] = useState("");
  const [dimensoes, setDimensoes] = useState("");
  const [origem, setOrigem] = useState("");
  const [destino, setDestino] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [valorCliente, setValorCliente] = useState("");
  const [valorMotorista, setValorMotorista] = useState("");
  const [custosExtras, setCustosExtras] = useState("");
  const [cargas, setCargas] = useState([]);

  const [cargaSelecionada, setCargaSelecionada] = useState(null);
  const [nomeMotorista, setNomeMotorista] = useState("");
  const [telefoneMotorista, setTelefoneMotorista] = useState("");
  const [placaMotorista, setPlacaMotorista] = useState("");

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
          .sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0));

        setCargas(lista);
      } else {
        setCargas([]);
      }
    });

    return () => unsubscribe();
  }, []);

  const aguardandoMotorista = cargas.filter(
    (carga) => carga.status === "aguardando_motorista"
  ).length;

  const emRota = cargas.filter((carga) => carga.status === "em_rota").length;

  const entreguesHoje = cargas.filter((carga) => {
    if (carga.status !== "entregue" || !carga.entregueEm) return false;

    const hoje = new Date();
    const dataEntrega = new Date(carga.entregueEm);

    return (
      hoje.getDate() === dataEntrega.getDate() &&
      hoje.getMonth() === dataEntrega.getMonth() &&
      hoje.getFullYear() === dataEntrega.getFullYear()
    );
  }).length;

  const comAlerta = cargas.filter((carga) => carga.alerta === true).length;

  async function criarCarga() {
    if (!contratante || !origem || !destino) {
      alert("Preencha ao menos contratante, origem e destino");
      return;
    }

    try {
      const novaCargaRef = push(ref(db, "cargas"));

      await set(novaCargaRef, {
        contratante,
        telefone,
        descricao,
        peso,
        dimensoes,
        origem,
        destino,
        observacoes,
        financeiro: {
          valorCliente,
          valorMotorista,
          custosExtras,
        },
        status: "aguardando_motorista",
        alerta: false,
        criadoEm: Date.now(),
      });

      alert("Carga criada com sucesso!");

      setContratante("");
      setTelefone("");
      setDescricao("");
      setPeso("");
      setDimensoes("");
      setOrigem("");
      setDestino("");
      setObservacoes("");
      setValorCliente("");
      setValorMotorista("");
      setCustosExtras("");
    } catch (error) {
      console.error(error);
      alert("Erro ao criar carga");
    }
  }

  function abrirVincularMotorista(carga) {
    setCargaSelecionada(carga);
    setNomeMotorista(carga.motorista?.nome || "");
    setTelefoneMotorista(carga.motorista?.telefone || "");
    setPlacaMotorista(carga.motorista?.placa || "");
  }

  function fecharVincularMotorista() {
    setCargaSelecionada(null);
    setNomeMotorista("");
    setTelefoneMotorista("");
    setPlacaMotorista("");
  }

  async function salvarMotorista() {
    if (!cargaSelecionada) return;

    if (!nomeMotorista || !telefoneMotorista || !placaMotorista) {
      alert("Preencha nome, telefone e placa do motorista");
      return;
    }

    try {
      await update(ref(db, `cargas/${cargaSelecionada.id}`), {
        motorista: {
          nome: nomeMotorista,
          telefone: telefoneMotorista,
          placa: placaMotorista,
        },
        status: "em_rota",
        motoristaVinculadoEm: Date.now(),
      });

      alert("Motorista vinculado com sucesso!");
      fecharVincularMotorista();
    } catch (error) {
      console.error(error);
      alert("Erro ao vincular motorista");
    }
  }

  function textoStatus(status) {
    if (status === "aguardando_motorista") return "Aguardando motorista";
    if (status === "em_rota") return "Em rota";
    if (status === "entregue") return "Entregue";
    return "Status desconhecido";
  }

  function corStatus(status) {
    if (status === "aguardando_motorista") return "text-yellow-400";
    if (status === "em_rota") return "text-green-400";
    if (status === "entregue") return "text-blue-400";
    return "text-gray-400";
  }

  function formatarHorario(timestamp) {
    if (!timestamp) return "Sem atualização";

    return new Date(timestamp).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  function abrirGoogleMaps(localizacao) {
    if (!localizacao?.lat || !localizacao?.lng) {
      alert("Essa carga ainda não possui localização");
      return;
    }

    const url = `https://www.google.com/maps?q=${localizacao.lat},${localizacao.lng}`;
    window.open(url, "_blank");
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <p className="text-blue-400 font-semibold">
            Carga Ao Vivo • Muller Labs
          </p>
          <h1 className="text-4xl font-bold mt-2">
            Painel da Transportadora
          </h1>
          <p className="text-gray-400 mt-2">
            Crie cargas, acompanhe viagens e compartilhe o rastreamento com o
            contratante.
          </p>
        </header>

        <section className="grid md:grid-cols-4 gap-4 mb-8">
          <div className="card-kpi">
            <p className="text-gray-400 text-sm">Aguardando motorista</p>
            <h2 className="text-3xl font-bold text-yellow-400 mt-2">
              {aguardandoMotorista}
            </h2>
          </div>

          <div className="card-kpi">
            <p className="text-gray-400 text-sm">Em rota</p>
            <h2 className="text-3xl font-bold text-green-400 mt-2">{emRota}</h2>
          </div>

          <div className="card-kpi">
            <p className="text-gray-400 text-sm">Entregues hoje</p>
            <h2 className="text-3xl font-bold text-blue-400 mt-2">
              {entreguesHoje}
            </h2>
          </div>

          <div className="card-kpi">
            <p className="text-gray-400 text-sm">Com alerta</p>
            <h2 className="text-3xl font-bold text-red-400 mt-2">
              {comAlerta}
            </h2>
          </div>
        </section>

        <section className="grid lg:grid-cols-2 gap-6">
          <div className="card">
            <h2 className="text-2xl font-bold mb-4">Nova carga</h2>

            <div className="grid gap-4">
              <input
                className="input"
                placeholder="Nome do contratante"
                value={contratante}
                onChange={(e) => setContratante(e.target.value)}
              />

              <input
                className="input"
                placeholder="Telefone do contratante"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
              />

              <input
                className="input"
                placeholder="Descrição da carga"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
              />

              <input
                className="input"
                placeholder="Peso aproximado"
                value={peso}
                onChange={(e) => setPeso(e.target.value)}
              />

              <input
                className="input"
                placeholder="Dimensões / m³"
                value={dimensoes}
                onChange={(e) => setDimensoes(e.target.value)}
              />

              <input
                className="input"
                placeholder="Origem"
                value={origem}
                onChange={(e) => setOrigem(e.target.value)}
              />

              <input
                className="input"
                placeholder="Destino final"
                value={destino}
                onChange={(e) => setDestino(e.target.value)}
              />

              <textarea
                className="input min-h-28"
                placeholder="Observações"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
              />

              {usuario.perfil === "admin" && (
                <div className="card border border-green-800 bg-slate-950">
                  <h3 className="text-lg font-bold text-green-400 mb-4">
                    Financeiro (Admin)
                  </h3>

                  <div className="grid gap-4">
                    <input
                      className="input"
                      placeholder="Valor cobrado do cliente"
                      value={valorCliente}
                      onChange={(e) => setValorCliente(e.target.value)}
                    />

                    <input
                      className="input"
                      placeholder="Valor pago ao motorista"
                      value={valorMotorista}
                      onChange={(e) => setValorMotorista(e.target.value)}
                    />

                    <input
                      className="input"
                      placeholder="Custos extras / pedágio"
                      value={custosExtras}
                      onChange={(e) => setCustosExtras(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <button
                onClick={criarCarga}
                className="bg-blue-600 hover:bg-blue-700 rounded-xl p-4 font-semibold"
              >
                Criar carga
              </button>
            </div>
          </div>

          <div className="card">
            <h2 className="text-2xl font-bold mb-4">Cargas recentes</h2>

            {cargas.length === 0 && (
              <p className="text-gray-400">Nenhuma carga criada ainda.</p>
            )}

            <div className="space-y-4">
              {cargas.map((carga) => (
                <div
                  key={carga.id}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-4"
                >
                  <div className="flex justify-between gap-4">
                    <div>
                      <h3 className="font-bold">
                        {carga.descricao || "Carga sem descrição"}
                      </h3>

                      <p className="text-gray-400 text-sm">
                        {carga.origem} → {carga.destino}
                      </p>

                      <p className="text-gray-500 text-xs mt-1">
                        Contratante: {carga.contratante}
                      </p>

                      {carga.telefone && (
                        <p className="text-gray-500 text-xs mt-1">
                          Telefone: {carga.telefone}
                        </p>
                      )}

                      {carga.motorista && (
                        <div className="mt-3 text-xs text-gray-400 border-t border-slate-800 pt-3">
                          <p className="text-green-400 font-semibold">
                            Motorista vinculado
                          </p>
                          <p>Nome: {carga.motorista.nome}</p>
                          <p>Telefone: {carga.motorista.telefone}</p>
                          <p>Placa: {carga.motorista.placa}</p>
                        </div>
                      )}

                      {carga.localizacao && (
                        <div className="mt-3 text-xs text-gray-400 border-t border-slate-800 pt-3">
                          <p className="text-blue-400 font-semibold">
                            📍 Rastreamento ao vivo
                          </p>
                          <p>Latitude: {carga.localizacao.lat}</p>
                          <p>Longitude: {carga.localizacao.lng}</p>
                          <p>
                            Precisão:{" "}
                            {Math.round(carga.localizacao.precisao || 0)} metros
                          </p>
                          <p>
                            Velocidade:{" "}
                            {Math.round((carga.localizacao.velocidade || 0) * 3.6)}{" "}
                            km/h
                          </p>
                          <p>
                            Atualizado em:{" "}
                            {formatarHorario(carga.localizacao.atualizadoEm)}
                          </p>
                        </div>
                      )}
                    </div>

                    <span
                      className={`${corStatus(
                        carga.status
                      )} text-sm font-semibold`}
                    >
                      {textoStatus(carga.status)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <button
                      onClick={() => abrirVincularMotorista(carga)}
                      className="btn-dark"
                    >
                      {carga.motorista
                        ? "Editar motorista"
                        : "Vincular motorista"}
                    </button>

                    <button
                      onClick={() => abrirGoogleMaps(carga.localizacao)}
                      className="btn-dark"
                    >
                      Abrir no Google Maps
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid md:grid-cols-3 gap-4 mt-8">
          {modulos.trackingPlus && (
            <div className="card">
              <h2 className="font-bold text-xl">Tracking+</h2>
              <p className="text-gray-400 mt-2">
                Histórico completo, ETA e replay da rota.
              </p>
            </div>
          )}

          {modulos.alertas && (
            <div className="card">
              <h2 className="font-bold text-xl">Alertas inteligentes</h2>
              <p className="text-gray-400 mt-2">
                Paradas longas, desvios e sinal perdido.
              </p>
            </div>
          )}

          {modulos.pod && (
            <div className="card">
              <h2 className="font-bold text-xl">Comprovantes</h2>
              <p className="text-gray-400 mt-2">
                Foto, assinatura e canhoto digital na finalização.
              </p>
            </div>
          )}
        </section>
      </div>

      {cargaSelecionada && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-950 border border-slate-700 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-2">Vincular motorista</h2>

            <p className="text-gray-400 text-sm mb-4">
              {cargaSelecionada.origem} → {cargaSelecionada.destino}
            </p>

            <div className="grid gap-4">
              <input
                className="input"
                placeholder="Nome do motorista"
                value={nomeMotorista}
                onChange={(e) => setNomeMotorista(e.target.value)}
              />

              <input
                className="input"
                placeholder="Telefone do motorista"
                value={telefoneMotorista}
                onChange={(e) => setTelefoneMotorista(e.target.value)}
              />

              <input
                className="input"
                placeholder="Placa do veículo"
                value={placaMotorista}
                onChange={(e) => setPlacaMotorista(e.target.value)}
              />

              <div className="grid grid-cols-2 gap-3">
                <button onClick={fecharVincularMotorista} className="btn-dark">
                  Cancelar
                </button>

                <button
                  onClick={salvarMotorista}
                  className="bg-green-600 hover:bg-green-700 rounded-xl p-4 font-semibold"
                >
                  Salvar motorista
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}