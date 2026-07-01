"use client";

import { useEffect, useState } from "react";
import { ref, onValue, remove, set } from "firebase/database";
import dynamic from "next/dynamic";
import { db } from "../../services/firebase";

const MapaCarga = dynamic(() => import("../components/MapaCarga"), {
  ssr: false,
  loading: () => <p>Carregando mapa...</p>,
});

function normalizarEndereco(endereco) {
  return `${endereco}, Brasil`;
}

async function buscarCoordenadas(endereco) {
  const enderecoFinal = normalizarEndereco(endereco);

  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
    enderecoFinal
  )}&limit=1&countrycodes=br&addressdetails=1`;

  const resposta = await fetch(url);
  const dados = await resposta.json();

  if (!dados || dados.length === 0) return null;

  return {
    latitude: Number(dados[0].lat),
    longitude: Number(dados[0].lon),
    enderecoEncontrado: dados[0].display_name,
  };
}

export default function Admin() {
  const [listaCargas, setListaCargas] = useState([]);
  const [cargaSelecionada, setCargaSelecionada] = useState("");
  const [localizacao, setLocalizacao] = useState(null);
  const [trajeto, setTrajeto] = useState([]);
  const [entrega, setEntrega] = useState(null);
  const [geofence, setGeofence] = useState(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [salvandoCarga, setSalvandoCarga] = useState(false);

  const [designacao, setDesignacao] = useState({
    motorista: "",
    telefoneMotorista: "",
    placa: "",
  });

  const [novaCarga, setNovaCarga] = useState({
    codigo: "",
    numeroCarga: "",
    cliente: "",
    telefoneCliente: "",
    origem: "",
    destino: "",
    localColeta: "",
    produto: "",
    transportadoraResponsavel: "",
  });

  const agora = Date.now();

  const cargaAtual = listaCargas.find(
    (carga) => carga.codigo === cargaSelecionada
  );

  let distanciaDestino = null;

  if (
    localizacao &&
    cargaAtual?.destinoCoordenadas &&
    localizacao.latitude &&
    localizacao.longitude
  ) {
    distanciaDestino = calcularDistanciaKm(
      localizacao.latitude,
      localizacao.longitude,
      cargaAtual.destinoCoordenadas.latitude,
      cargaAtual.destinoCoordenadas.longitude
    );
  }

  const cargasAtivas = listaCargas.filter((carga) => !carga.entrega);
  const historicoEntregas = listaCargas.filter((carga) => carga.entrega);

  const semMotorista = cargasAtivas.filter(
    (carga) => carga.status === "Cadastrada" || !carga.motorista
  ).length;

  const motoristasOnline = cargasAtivas.filter((carga) =>
    motoristaEstaOnline(carga)
  ).length;

  const geofencesAtivas = cargasAtivas.filter(
    (carga) => carga.geofence?.ativa
  ).length;

  const chegaramDestino = cargasAtivas.filter(
    (carga) => carga.geofence?.entrouNoDestino
  ).length;

  function calcularDistanciaKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }

  function dataEntregaMs(carga) {
    if (carga.entrega?.entregueEmMs) return Number(carga.entrega.entregueEmMs);
    if (carga.entrega?.entregueEm) {
      const convertido = new Date(carga.entrega.entregueEm).getTime();
      return Number.isNaN(convertido) ? 0 : convertido;
    }
    return 0;
  }

  function mesmoDia(dataMs, referenciaMs) {
    const data = new Date(dataMs);
    const referencia = new Date(referenciaMs);

    return (
      data.getDate() === referencia.getDate() &&
      data.getMonth() === referencia.getMonth() &&
      data.getFullYear() === referencia.getFullYear()
    );
  }

  const inicioOntem = new Date();
  inicioOntem.setDate(inicioOntem.getDate() - 1);
  inicioOntem.setHours(0, 0, 0, 0);

  const entregasHoje = historicoEntregas.filter((carga) =>
    mesmoDia(dataEntregaMs(carga), agora)
  );

  const entregasOntem = historicoEntregas.filter((carga) =>
    mesmoDia(dataEntregaMs(carga), inicioOntem.getTime())
  );

  const entregasUltimos7Dias = historicoEntregas.filter((carga) => {
    const dataMs = dataEntregaMs(carga);
    const seteDiasMs = 7 * 24 * 60 * 60 * 1000;

    return (
      dataMs &&
      agora - dataMs <= seteDiasMs &&
      !mesmoDia(dataMs, agora) &&
      !mesmoDia(dataMs, inicioOntem.getTime())
    );
  });

  const entregasMaisAntigas = historicoEntregas.filter((carga) => {
    const dataMs = dataEntregaMs(carga);
    const seteDiasMs = 7 * 24 * 60 * 60 * 1000;
    return !dataMs || agora - dataMs > seteDiasMs;
  });

  useEffect(() => {
    const cargasRef = ref(db, "cargas");

    const pararCargas = onValue(cargasRef, (snapshot) => {
      if (!snapshot.exists()) {
        setListaCargas([]);
        setCargaSelecionada("");
        return;
      }

      const dados = snapshot.val();

      const lista = Object.entries(dados)
        .map(([codigo, dadosCarga]) => ({
          codigo,
          ...dadosCarga?.dados,
          localizacao: dadosCarga?.localizacao || null,
          trajeto: dadosCarga?.trajeto || null,
          entrega: dadosCarga?.entrega || null,
          geofence: dadosCarga?.geofence || null,
          destinoCoordenadas: dadosCarga?.destinoCoordenadas || null,
          origemCoordenadas: dadosCarga?.origemCoordenadas || null,
        }))
        .filter((carga) => {
          return (
            carga.origem ||
            carga.destino ||
            carga.localColeta ||
            carga.cliente ||
            carga.motorista ||
            carga.produto ||
            carga.entrega
          );
        })
        .sort((a, b) => Number(b.criadoEmMs || b.codigo) - Number(a.criadoEmMs || a.codigo));

      setListaCargas(lista);

      if (!cargaSelecionada && lista.length > 0) {
        const primeiraAtiva = lista.find((carga) => !carga.entrega);
        setCargaSelecionada(primeiraAtiva?.codigo || lista[0].codigo);
      }
    });

    return () => pararCargas();
  }, [cargaSelecionada]);

  useEffect(() => {
    if (!cargaSelecionada) return;

    const localizacaoRef = ref(db, `cargas/${cargaSelecionada}/localizacao`);
    const trajetoRef = ref(db, `cargas/${cargaSelecionada}/trajeto`);
    const entregaRef = ref(db, `cargas/${cargaSelecionada}/entrega`);
    const geofenceRef = ref(db, `cargas/${cargaSelecionada}/geofence`);

    const pararLocalizacao = onValue(localizacaoRef, (snapshot) => {
      setLocalizacao(snapshot.exists() ? snapshot.val() : null);
    });

    const pararTrajeto = onValue(trajetoRef, (snapshot) => {
      setTrajeto(snapshot.exists() ? Object.values(snapshot.val()) : []);
    });

    const pararEntrega = onValue(entregaRef, (snapshot) => {
      setEntrega(snapshot.exists() ? snapshot.val() : null);
    });

    const pararGeofence = onValue(geofenceRef, (snapshot) => {
      setGeofence(snapshot.exists() ? snapshot.val() : null);
    });

    const carga = listaCargas.find((item) => item.codigo === cargaSelecionada);

    if (carga) {
      setDesignacao({
        motorista: carga.motorista || "",
        telefoneMotorista: carga.telefoneMotorista || "",
        placa: carga.placa || "",
      });
    }

    return () => {
      pararLocalizacao();
      pararTrajeto();
      pararEntrega();
      pararGeofence();
    };
  }, [cargaSelecionada, listaCargas]);

  function motoristaEstaOnline(carga) {
    const ultimaAtualizacao =
      carga.localizacao?.timestamp ||
      carga.localizacao?.atualizadoEmMs ||
      carga.localizacao?.ultimaAtualizacao;

    if (!ultimaAtualizacao) return false;

    return Date.now() - Number(ultimaAtualizacao) <= 2 * 60 * 1000;
  }

  function gerarCodigoCarga() {
    return String(Date.now());
  }

  function classeStatus(status) {
    if (status === "Cadastrada") return "text-slate-300";
    if (status === "Motorista designado") return "text-blue-300";
    if (status === "Rastreamento iniciado") return "text-yellow-300";
    if (status === "Em rota") return "text-orange-300";
    if (status === "Chegou ao destino") return "text-green-300";
    if (status?.includes("Entregue")) return "text-green-400";
    return "text-slate-300";
  }

  async function cadastrarNovaCarga(e) {
    e.preventDefault();
    if (salvandoCarga) return;

    const codigoFinal = novaCarga.codigo.trim() || gerarCodigoCarga();

    if (!novaCarga.origem.trim() || !novaCarga.destino.trim()) {
      alert("Preencha origem e destino com rua, número, cidade e estado.");
      return;
    }

    try {
      setSalvandoCarga(true);

      const origemCoordenadas = await buscarCoordenadas(novaCarga.origem.trim());
      const destinoCoordenadas = await buscarCoordenadas(novaCarga.destino.trim());

      if (!origemCoordenadas) {
        alert("Não consegui localizar o endereço de origem.");
        return;
      }

      if (!destinoCoordenadas) {
        alert("Não consegui localizar o endereço de destino.");
        return;
      }

      await set(ref(db, `cargas/${codigoFinal}/dados`), {
        numeroCarga: novaCarga.numeroCarga.trim(),
        cliente: novaCarga.cliente.trim(),
        telefoneCliente: novaCarga.telefoneCliente.trim(),
        origem: novaCarga.origem.trim(),
        destino: novaCarga.destino.trim(),
        localColeta: novaCarga.localColeta.trim() || novaCarga.origem.trim(),
        produto: novaCarga.produto.trim(),
        transportadoraResponsavel:
          novaCarga.transportadoraResponsavel.trim(),
        motorista: "",
        telefoneMotorista: "",
        placa: "",
        status: "Cadastrada",
        linkClienteLiberado: false,
        rastreamentoIniciado: false,
        criadoEm: new Date().toLocaleString("pt-BR"),
        criadoEmMs: Date.now(),
      });

      await set(ref(db, `cargas/${codigoFinal}/origemCoordenadas`), {
        latitude: origemCoordenadas.latitude,
        longitude: origemCoordenadas.longitude,
        enderecoEncontrado: origemCoordenadas.enderecoEncontrado,
      });

      await set(ref(db, `cargas/${codigoFinal}/destinoCoordenadas`), {
        latitude: destinoCoordenadas.latitude,
        longitude: destinoCoordenadas.longitude,
        enderecoEncontrado: destinoCoordenadas.enderecoEncontrado,
      });

      await set(ref(db, `cargas/${codigoFinal}/geofence`), {
        ativa: true,
        raioMetros: 1000,
        raioSaidaMetros: 1500,
        entrouNoDestino: false,
        saiuDoDestino: false,
        entregaAutomatica: false,
        criadoEm: new Date().toLocaleString("pt-BR"),
        criadoEmMs: Date.now(),
      });

      setCargaSelecionada(codigoFinal);
      setMostrarFormulario(false);

      setNovaCarga({
        codigo: "",
        numeroCarga: "",
        cliente: "",
        telefoneCliente: "",
        origem: "",
        destino: "",
        localColeta: "",
        produto: "",
        transportadoraResponsavel: "",
      });

      alert(`Carga ${codigoFinal} cadastrada. Agora designe o motorista.`);
    } catch (erro) {
      console.error(erro);
      alert("Erro ao cadastrar carga. Verifique o endereço e tente novamente.");
    } finally {
      setSalvandoCarga(false);
    }
  }

  async function designarMotorista() {
    if (!cargaSelecionada) {
      alert("Selecione uma carga.");
      return;
    }

    if (!designacao.motorista.trim()) {
      alert("Informe o nome do motorista.");
      return;
    }

    const agoraTexto = new Date().toLocaleString("pt-BR");

    await set(
      ref(db, `cargas/${cargaSelecionada}/dados/motorista`),
      designacao.motorista.trim()
    );

    await set(
      ref(db, `cargas/${cargaSelecionada}/dados/telefoneMotorista`),
      designacao.telefoneMotorista.trim()
    );

    await set(
      ref(db, `cargas/${cargaSelecionada}/dados/placa`),
      designacao.placa.trim()
    );

    await set(
      ref(db, `cargas/${cargaSelecionada}/dados/status`),
      "Motorista designado"
    );

    await set(
      ref(db, `cargas/${cargaSelecionada}/dados/motoristaDesignadoEm`),
      agoraTexto
    );

    alert("Motorista designado com sucesso.");
  }

  async function limparTestesAntigos() {
    const confirmar = window.confirm(
      "Isso vai apagar cargas vazias/sem dados reais. Deseja continuar?"
    );

    if (!confirmar) return;

    const cargasVazias = listaCargas.filter((carga) => {
      return (
        !carga.origem &&
        !carga.destino &&
        !carga.localColeta &&
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

        <p>
          <strong>Rota:</strong> {carga.origem || "-"} →{" "}
          {carga.destino || "-"}
        </p>

        <p>
          <strong>Cliente:</strong> {carga.cliente || "-"}
        </p>

        <p>
          <strong>Motorista:</strong> {carga.motorista || "Sem motorista"}
        </p>

        <p>
          <strong>Status:</strong>{" "}
          <span className={classeStatus(carga.status)}>
            {carga.status || "Cadastrada"}
          </span>
        </p>

        {carga.linkClienteLiberado ? (
          <p className="mt-2 text-sm text-green-300 break-all">
            Cliente liberado: /acompanhar/{carga.codigo}
          </p>
        ) : (
          <p className="mt-2 text-sm text-yellow-300">
            Link do cliente aguardando saída da origem
          </p>
        )}

        <p className="mt-1 text-sm text-blue-300 break-all">
          Link motorista: /motorista — Código {carga.codigo}
        </p>

        {carga.localizacao && !historico && (
          <p className="mt-2 text-sm">
            {motoristaEstaOnline(carga) ? "🟢 GPS online" : "🔴 GPS offline"}
          </p>
        )}

        {carga.geofence?.ativa && !historico && (
          <p className="mt-1 text-sm text-green-300">🟢 Geofence ativa</p>
        )}

        {carga.geofence?.entrouNoDestino && !carga.entrega && (
          <p className="mt-1 text-sm text-yellow-300">
            📍 Chegou ao destino
          </p>
        )}

        {carga.entrega && (
          <div className="mt-3 bg-green-950 rounded-xl p-3 text-sm">
            <p>
              <strong>✅ Recebido por:</strong>{" "}
              {carga.entrega.recebedor || "-"}
            </p>

            <p>
              <strong>Horário:</strong> {carga.entrega.entregueEm || "-"}
            </p>
          </div>
        )}
      </button>
    );
  }

  function SecaoHistorico({ titulo, entregas }) {
    if (entregas.length === 0) return null;

    return (
      <div className="mb-6">
        <h3 className="text-xl font-bold mb-3">
          {titulo} ({entregas.length})
        </h3>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {entregas.map((carga) => (
            <CardCarga key={carga.codigo} carga={carga} historico />
          ))}
        </div>
      </div>
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
            Cadastro, designação de motorista e rastreamento em tempo real
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-3">
          <button
            onClick={() => setMostrarFormulario(!mostrarFormulario)}
            className="bg-green-600 hover:bg-green-700 rounded-xl px-4 py-3 font-semibold"
          >
            {mostrarFormulario ? "Fechar cadastro" : "Adicionar nova carga"}
          </button>

          <button
            onClick={limparTestesAntigos}
            className="bg-red-700 hover:bg-red-800 rounded-xl px-4 py-3 font-semibold"
          >
            Limpar testes vazios
          </button>
        </div>
      </div>

      {mostrarFormulario && (
        <section className="mb-6 bg-slate-900 rounded-2xl p-4">
          <h2 className="text-2xl font-bold mb-4">Cadastrar nova carga</h2>

          <p className="text-slate-400 mb-4">
            A carga nasce como <strong>Cadastrada</strong>. Depois você designa
            motorista e placa. As coordenadas ficam ocultas.
          </p>

          <form onSubmit={cadastrarNovaCarga} className="grid gap-4 md:grid-cols-2">
            <input
              value={novaCarga.codigo}
              onChange={(e) =>
                setNovaCarga({ ...novaCarga, codigo: e.target.value })
              }
              placeholder="Código da carga (opcional)"
              className="bg-slate-800 rounded-xl p-3 outline-none"
            />

            <input
              value={novaCarga.numeroCarga}
              onChange={(e) =>
                setNovaCarga({ ...novaCarga, numeroCarga: e.target.value })
              }
              placeholder="Número da carga / pedido"
              className="bg-slate-800 rounded-xl p-3 outline-none"
            />

            <input
              value={novaCarga.cliente}
              onChange={(e) =>
                setNovaCarga({ ...novaCarga, cliente: e.target.value })
              }
              placeholder="Cliente"
              className="bg-slate-800 rounded-xl p-3 outline-none"
            />

            <input
              value={novaCarga.telefoneCliente}
              onChange={(e) =>
                setNovaCarga({ ...novaCarga, telefoneCliente: e.target.value })
              }
              placeholder="Telefone / WhatsApp do cliente"
              className="bg-slate-800 rounded-xl p-3 outline-none"
            />

            <input
              value={novaCarga.transportadoraResponsavel}
              onChange={(e) =>
                setNovaCarga({
                  ...novaCarga,
                  transportadoraResponsavel: e.target.value,
                })
              }
              placeholder="Transportadora responsável"
              className="bg-slate-800 rounded-xl p-3 outline-none md:col-span-2"
            />

            <input
              value={novaCarga.origem}
              onChange={(e) =>
                setNovaCarga({ ...novaCarga, origem: e.target.value })
              }
              placeholder="Origem: Rua, número, cidade e estado *"
              className="bg-slate-800 rounded-xl p-3 outline-none md:col-span-2"
            />

            <input
              value={novaCarga.destino}
              onChange={(e) =>
                setNovaCarga({ ...novaCarga, destino: e.target.value })
              }
              placeholder="Destino: Rua, número, cidade e estado *"
              className="bg-slate-800 rounded-xl p-3 outline-none md:col-span-2"
            />

            <input
              value={novaCarga.localColeta}
              onChange={(e) =>
                setNovaCarga({ ...novaCarga, localColeta: e.target.value })
              }
              placeholder="Local de coleta (opcional, se vazio usa a origem)"
              className="bg-slate-800 rounded-xl p-3 outline-none"
            />

            <input
              value={novaCarga.produto}
              onChange={(e) =>
                setNovaCarga({ ...novaCarga, produto: e.target.value })
              }
              placeholder="Produto / descrição da carga"
              className="bg-slate-800 rounded-xl p-3 outline-none"
            />

            <button
              type="submit"
              disabled={salvandoCarga}
              className="md:col-span-2 bg-blue-600 hover:bg-blue-700 rounded-xl p-4 font-bold disabled:bg-slate-700"
            >
              {salvandoCarga
                ? "Buscando endereço e salvando..."
                : "Salvar carga"}
            </button>
          </form>
        </section>
      )}

      <div className="grid gap-4 md:grid-cols-6 mb-6">
        <div className="bg-slate-900 rounded-2xl p-4">
          <p className="text-slate-400">Total</p>
          <p className="text-3xl font-bold">{listaCargas.length}</p>
        </div>

        <div className="bg-slate-900 rounded-2xl p-4">
          <p className="text-slate-400">Ativas</p>
          <p className="text-3xl font-bold text-orange-400">
            {cargasAtivas.length}
          </p>
        </div>

        <div className="bg-slate-900 rounded-2xl p-4">
          <p className="text-slate-400">Sem motorista</p>
          <p className="text-3xl font-bold text-yellow-400">{semMotorista}</p>
        </div>

        <div className="bg-slate-900 rounded-2xl p-4">
          <p className="text-slate-400">Online</p>
          <p className="text-3xl font-bold text-blue-400">
            {motoristasOnline}
          </p>
        </div>

        <div className="bg-slate-900 rounded-2xl p-4">
          <p className="text-slate-400">Geofence</p>
          <p className="text-3xl font-bold text-green-400">
            {geofencesAtivas}
          </p>
        </div>

        <div className="bg-slate-900 rounded-2xl p-4">
          <p className="text-slate-400">Entregues</p>
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

      {cargaAtual && !cargaAtual.entrega && (
        <section className="mb-6 bg-slate-900 rounded-2xl p-4">
          <h2 className="text-2xl font-bold mb-4">
            Designar motorista — carga {cargaSelecionada}
          </h2>

          <div className="grid gap-4 md:grid-cols-3">
            <input
              value={designacao.motorista}
              onChange={(e) =>
                setDesignacao({ ...designacao, motorista: e.target.value })
              }
              placeholder="Nome do motorista"
              className="bg-slate-800 rounded-xl p-3 outline-none"
            />

            <input
              value={designacao.telefoneMotorista}
              onChange={(e) =>
                setDesignacao({
                  ...designacao,
                  telefoneMotorista: e.target.value,
                })
              }
              placeholder="Telefone do motorista"
              className="bg-slate-800 rounded-xl p-3 outline-none"
            />

            <input
              value={designacao.placa}
              onChange={(e) =>
                setDesignacao({ ...designacao, placa: e.target.value })
              }
              placeholder="Placa do veículo"
              className="bg-slate-800 rounded-xl p-3 outline-none"
            />

            <button
              onClick={designarMotorista}
              className="md:col-span-3 bg-blue-600 hover:bg-blue-700 rounded-xl p-4 font-bold"
            >
              Salvar motorista designado
            </button>
          </div>

          <div className="mt-4 bg-slate-800 rounded-xl p-4 text-sm">
            <p>
              <strong>Link para motorista:</strong> /motorista
            </p>
            <p>
              <strong>Código da carga:</strong> {cargaSelecionada}
            </p>
            <p className="text-yellow-300 mt-2">
              O destino completo só será liberado para o motorista após ativar o GPS.
            </p>
          </div>
        </section>
      )}

      <section className="bg-slate-900 rounded-2xl p-4 mb-6">
        <h2 className="text-2xl font-bold mb-4">
          Rastreamento da carga: {cargaSelecionada || "nenhuma"}
        </h2>

        {!cargaSelecionada ? (
          <p className="text-slate-400">Selecione uma carga para acompanhar.</p>
        ) : (
          <>
            {cargaAtual && (
              <div className="mb-4 bg-slate-800 rounded-xl p-4 grid gap-2 md:grid-cols-2">
                <p>
                  <strong>Status:</strong>{" "}
                  <span className={classeStatus(cargaAtual.status)}>
                    {cargaAtual.status || "Cadastrada"}
                  </span>
                </p>

                <p>
                  <strong>Cliente:</strong> {cargaAtual.cliente || "-"}
                </p>

                <p>
                  <strong>Motorista:</strong>{" "}
                  {cargaAtual.motorista || "Sem motorista"}
                </p>

                <p>
                  <strong>Placa:</strong> {cargaAtual.placa || "-"}
                </p>

                <p>
                  <strong>Link cliente:</strong>{" "}
                  {cargaAtual.linkClienteLiberado ? (
                    <span className="text-green-300">
                      /acompanhar/{cargaSelecionada}
                    </span>
                  ) : (
                    <span className="text-yellow-300">
                      Aguardando sair 2 km da origem
                    </span>
                  )}
                </p>
              </div>
            )}

            {entrega && (
              <div className="mb-4 bg-green-900 rounded-2xl p-4">
                <h3 className="text-xl font-bold mb-2">
                  Entrega concluída ✅
                </h3>

                <p>
                  <strong>Recebido por:</strong> {entrega.recebedor || "-"}
                </p>

                <p>
                  <strong>Horário:</strong> {entrega.entregueEm || "-"}
                </p>
              </div>
            )}

            {geofence && (
              <div className="mb-4 bg-slate-800 rounded-xl p-4 grid gap-2 md:grid-cols-2">
                <p>
                  <strong>Geofence:</strong>{" "}
                  {geofence.ativa ? "🟢 Ativa" : "⚪ Inativa"}
                </p>

                <p>
                  <strong>Raio entrada:</strong> {geofence.raioMetros || 1000} m
                </p>

                <p>
                  <strong>Raio saída:</strong>{" "}
                  {geofence.raioSaidaMetros || 1500} m
                </p>

                <p>
                  <strong>Chegada:</strong>{" "}
                  {geofence.entrouNoDestino ? "📍 Detectada" : "Aguardando"}
                </p>

                <p>
                  <strong>Automática:</strong>{" "}
                  {geofence.entregaAutomatica ? "✅ Sim" : "Não"}
                </p>
              </div>
            )}

            {!localizacao ? (
              <p className="text-slate-400">
                Aguardando o motorista iniciar o GPS...
              </p>
            ) : (
              <>
                <div className="mb-4 bg-slate-800 rounded-xl p-4 grid gap-2 md:grid-cols-2">
                  <p>
                    <strong>Pontos registrados:</strong> {trajeto.length}
                  </p>

                  <p>
                    <strong>Última atualização:</strong>{" "}
                    {localizacao.atualizadoEm || "-"}
                  </p>

                  <p>
                    <strong>Precisão:</strong>{" "}
                    {localizacao.precisao
                      ? `${Math.round(localizacao.precisao)} m`
                      : "-"}
                  </p>

                  <p>
                    <strong>GPS:</strong>{" "}
                    {motoristaEstaOnline({ localizacao })
                      ? "🟢 Online"
                      : "🔴 Offline"}
                  </p>

                  {distanciaDestino !== null && (
                    <p>
                      <strong>Distância até destino:</strong>{" "}
                      {distanciaDestino.toFixed(2)} km
                    </p>
                  )}
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

      <section className="mb-6 bg-slate-900 rounded-2xl p-4">
        <h2 className="text-2xl font-bold mb-4">Histórico de entregas</h2>

        {historicoEntregas.length === 0 ? (
          <p className="text-slate-400">Nenhuma entrega concluída ainda.</p>
        ) : (
          <>
            <SecaoHistorico titulo="Hoje" entregas={entregasHoje} />
            <SecaoHistorico titulo="Ontem" entregas={entregasOntem} />
            <SecaoHistorico
              titulo="Últimos 7 dias"
              entregas={entregasUltimos7Dias}
            />
            <SecaoHistorico
              titulo="Mais antigas"
              entregas={entregasMaisAntigas}
            />
          </>
        )}
      </section>
    </main>
  );
}