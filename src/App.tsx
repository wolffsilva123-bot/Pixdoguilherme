import { Smartphone, Copy, CheckCircle2 } from "lucide-react";
import { PixLogo } from "./components/PixLogo";
import { VirtualAssistant } from "./components/VirtualAssistant";
import { PixPaymentCard } from "./components/PixPaymentCard";

const PAYMENT_STEPS = [
  {
    number: "01",
    title: "Copie a chave Pix",
    description:
      "Toque em COPIAR CHAVE PIX para copiar automaticamente os números 24992687918.",
    icon: Copy,
  },
  {
    number: "02",
    title: "Abra o app do banco",
    description:
      "Entre no aplicativo do seu banco, acesse a área Pix e escolha transferir por chave celular.",
    icon: Smartphone,
  },
  {
    number: "03",
    title: "Confira e finalize",
    description:
      "Confirme que o recebedor é Guilherme Pereira Costa e conclua o pagamento com segurança.",
    icon: CheckCircle2,
  },
];

export default function App() {
  return (
    <div className="relative min-h-screen flex flex-col bg-[#080D18] text-white overflow-x-hidden">
      {/* Ambient technological blue & turquoise lighting */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[420px] w-[720px] rounded-full bg-[#168BFF]/14 blur-[120px]" />
        <div className="absolute top-[38%] -left-32 h-[360px] w-[360px] rounded-full bg-[#102B50]/65 blur-[110px]" />
        <div className="absolute bottom-0 -right-24 h-[340px] w-[340px] rounded-full bg-[#19DDB5]/10 blur-[120px]" />
      </div>

      {/* Minimal Top Bar */}
      <header className="relative z-10 w-full border-b border-white/8 bg-[#080D18]/75 backdrop-blur-md">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <a
            href="#topo"
            className="inline-flex items-center gap-2.5 font-display text-base sm:text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#19DDB5] rounded-lg"
          >
            <PixLogo className="w-5 h-5 text-[#19DDB5] shrink-0" />
            <span>Guilherme Pereira Costa</span>
          </a>

          <a
            href="#pagamento-pix"
            className="inline-flex items-center justify-center min-h-[40px] px-4 py-2 rounded-xl border border-[#19DDB5]/35 bg-[#19DDB5]/10 hover:bg-[#19DDB5]/20 text-[#19DDB5] font-display text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#19DDB5]"
          >
            Ir para o Pix
          </a>
        </div>
      </header>

      {/* Main Content */}
      <main
        id="topo"
        className="relative z-10 flex-1 w-full mx-auto max-w-5xl px-4 sm:px-6 py-7 sm:py-10 flex flex-col gap-7 sm:gap-9"
      >
        {/* 1. Virtual Assistant (Top Section) */}
        <VirtualAssistant />

        {/* 2. Centered Pix Card + Complementary Guide on Desktop */}
        <div
          id="pagamento-pix"
          className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start"
        >
          <div className="lg:col-span-7">
            <PixPaymentCard />
          </div>

          <aside
            aria-label="Como concluir seu pagamento"
            className="lg:col-span-5 rounded-3xl border border-white/10 bg-[#102B50]/25 backdrop-blur-xl p-6 sm:p-7 space-y-5"
          >
            <div className="space-y-1">
              <h2 className="font-display text-lg font-bold text-white">
                Como concluir o pagamento
              </h2>
              <p className="text-sm text-white/70">
                Siga os três passos simples no aplicativo do seu banco.
              </p>
            </div>

            <ol className="divide-y divide-white/8">
              {PAYMENT_STEPS.map((step) => {
                const Icon = step.icon;
                return (
                  <li
                    key={step.number}
                    className="py-4 first:pt-1 last:pb-1 flex items-start gap-3.5"
                  >
                    <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-[#168BFF]/15 border border-[#168BFF]/30 text-[#19DDB5] shrink-0 mt-0.5">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs font-mono text-[#19DDB5] tabular-nums">
                        <span>Passo {step.number}</span>
                      </div>
                      <h3 className="font-display text-sm sm:text-base font-semibold text-white">
                        {step.title}
                      </h3>
                      <p className="text-xs sm:text-sm leading-relaxed text-white/75">
                        {step.description}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </aside>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full border-t border-white/10 bg-[#080D18]/80 backdrop-blur-md">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-7 flex flex-col items-center text-center gap-2.5">
          <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#19DDB5]/10 text-[#19DDB5]">
            <PixLogo className="w-4 h-4" />
          </div>
          <p className="text-sm sm:text-base font-medium text-white">
            Obrigado pela preferência! Seu pagamento é muito importante para nós.
          </p>
          <p className="text-xs sm:text-sm text-white/65">
            Pagamento simples, rápido e seguro.
          </p>
        </div>
      </footer>
    </div>
  );
}
