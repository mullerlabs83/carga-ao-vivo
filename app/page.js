"use client";

import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center px-6">
      <h1 className="text-5xl font-bold mb-4">Carga Ao Vivo</h1>

      <p className="text-xl text-gray-300 text-center max-w-2xl">
        Rastreamento inteligente de cargas em tempo real.
      </p>

      <div className="mt-10 grid gap-4 w-full max-w-md">
        <button
          onClick={() => router.push("/admin")}
          className="bg-blue-600 hover:bg-blue-700 rounded-xl p-4 font-semibold"
        >
          Painel da Transportadora
        </button>

        <button
          onClick={() => router.push("/motorista")}
          className="bg-green-600 hover:bg-green-700 rounded-xl p-4 font-semibold"
        >
          Área do Motorista
        </button>

        <button
          onClick={() => router.push("/acompanhar")}
          className="bg-orange-500 hover:bg-orange-600 rounded-xl p-4 font-semibold"
        >
          Acompanhar Carga
        </button>
      </div>
    </main>
  );
}