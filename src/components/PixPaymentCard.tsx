import { useEffect, useRef, useState } from "react";
import {
  Check,
  CheckCircle2,
  Copy,
  ShieldCheck,
  Smartphone,
  ArrowUpRight,
  AlertTriangle,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { PixLogo } from "./PixLogo";
import { MercadoPagoLogo } from "./MercadoPagoLogo";

const RAW_PIX_KEY = "24992687918";
const FORMATTED_PIX_KEY = "(24) 99268-7918";
const RECIPIENT_NAME = "Guilherme Pereira Costa";
const RECIPIENT_BANK = "MERCADO PAGO";

export function PixPaymentCard() {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [hasCopiedOnce, setHasCopiedOnce] = useState(false);
  const resetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  const fallbackCopyText = (text: string): boolean => {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.top = "-9999px";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const succeeded = document.execCommand("copy");
      document.body.removeChild(textarea);
      return succeeded;
    } catch {
      return false;
    }
  };

  const handleCopyPixKey = async () => {
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }

    let copied = false;
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      try {
        await navigator.clipboard.writeText(RAW_PIX_KEY);
        copied = true;
      } catch {
        copied = fallbackCopyText(RAW_PIX_KEY);
      }
    } else {
      copied = fallbackCopyText(RAW_PIX_KEY);
    }

    if (copied) {
      setCopyState("copied");
      setHasCopiedOnce(true);
      resetTimerRef.current = window.setTimeout(() => {
        setCopyState("idle");
      }, 4500);
    } else {
      setCopyState("error");
    }
  };

  return (
    <section
      aria-labelledby="pix-card-title"
      className="relative w-full rounded-3xl border border-[#168BFF]/30 bg-gradient-to-b from-[#102B50]/85 via-[#0B172B]/95 to-[#080D18]/95 backdrop-blur-2xl p-6 sm:p-9 shadow-[0_32px_80px_-24px_rgba(8,13,24,0.95),0_0_60px_-24px_rgba(25,221,181,0.22)]"
    >
      {/* Subtle top edge highlight */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[#19DDB5]/60 to-transparent"
      />

      {/* Card Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-white/10">
        <div className="flex items-center gap-3.5">
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-[#19DDB5]/12 border border-[#19DDB5]/30 text-[#19DDB5] shadow-[0_0_24px_-6px_rgba(25,221,181,0.45)] shrink-0">
            <PixLogo className="w-7 h-7" />
          </div>
          <div>
            <h2
              id="pix-card-title"
              className="font-display text-xl sm:text-2xl font-bold tracking-tight text-white"
            >
              PAGAMENTO VIA PIX
            </h2>
            <p className="text-sm text-white/75 mt-0.5">
              Rápido, prático e seguro.
            </p>
          </div>
        </div>

        <div className="inline-flex items-center gap-2 text-xs font-medium text-[#19DDB5]">
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span>Ambiente protegido</span>
        </div>
      </div>

      {/* Selo PIX CONFIÁVEL */}
      <div className="mt-6">
        <div className="inline-flex w-full sm:w-auto items-center gap-3.5 rounded-full border border-[#19DDB5]/45 bg-[#19DDB5]/14 px-4 py-2.5 shadow-[0_0_28px_-8px_rgba(25,221,181,0.5)]">
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-[#19DDB5]/20 border border-[#19DDB5]/40 text-[#19DDB5] shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <PixLogo className="w-4 h-4 text-[#19DDB5] shrink-0" />
              <span className="font-display text-sm font-bold tracking-wide text-white">
                PIX CONFIÁVEL
              </span>
            </div>
            <p className="text-xs text-[#A8F5E5] leading-snug">
              Pagamento via Pix com chave identificada.
            </p>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-white/50 pl-1">
          Selo visual informativo de conferência da chave do recebedor.
        </p>
      </div>

      {/* Recipient, Bank & Pix Key Details */}
      <div className="mt-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
          <div>
            <span className="block text-xs font-medium text-white/60">
              Nome do recebedor
            </span>
            <p className="mt-1.5 font-display text-lg sm:text-xl font-semibold text-white">
              {RECIPIENT_NAME}
            </p>
          </div>

          <div>
            <span className="block text-xs font-medium text-white/60">
              Tipo de chave
            </span>
            <div className="mt-1.5 flex items-center gap-2 text-base font-medium text-white">
              <Smartphone className="w-4 h-4 text-[#168BFF] shrink-0" />
              <span>Celular</span>
            </div>
          </div>

          {/* Banco recebedor: MERCADO PAGO */}
          <div className="sm:col-span-2 rounded-2xl border border-[#009EE3]/35 bg-[#009EE3]/10 px-4 py-3.5 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <span className="block text-xs font-medium text-white/65">
                Banco recebedor
              </span>
              <p className="mt-1 font-display text-base sm:text-lg font-extrabold tracking-wide text-white">
                {RECIPIENT_BANK}
              </p>
            </div>
            <div className="flex items-center justify-center rounded-xl bg-white/10 border border-white/15 px-2.5 py-1.5 shrink-0">
              <MercadoPagoLogo className="w-10 h-7" />
            </div>
          </div>
        </div>

        {/* Highlighted Pix Key */}
        <div className="rounded-2xl border border-[#168BFF]/35 bg-[#080D18]/75 px-5 py-5 shadow-inner">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-white/65">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <PixLogo className="w-3.5 h-3.5 text-[#19DDB5]" />
              Chave Pix
            </span>
            <span className="font-mono text-[11px] text-[#19DDB5]/90 tabular-nums">
              Cópia numérica: {RAW_PIX_KEY}
            </span>
          </div>

          <p className="mt-2 font-mono text-2xl sm:text-3xl font-bold tracking-tight text-white tabular-nums select-all">
            {FORMATTED_PIX_KEY}
          </p>
        </div>
      </div>

      {/* Primary CTA Button: COPIAR CHAVE PIX */}
      <div className="mt-7">
        <button
          type="button"
          onClick={() => void handleCopyPixKey()}
          className={`group relative w-full min-h-[58px] rounded-2xl px-6 py-4 font-display font-bold text-base tracking-wide flex items-center justify-center gap-3 overflow-hidden transition-all duration-200 active:scale-[0.985] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#080D18] ${
            copyState === "copied"
              ? "bg-[#19DDB5] text-[#080D18] shadow-[0_12px_36px_-6px_rgba(25,221,181,0.75)]"
              : "bg-gradient-to-r from-[#19DDB5] via-[#1AE8BE] to-[#19DDB5] text-[#080D18] hover:brightness-105 shadow-[0_12px_36px_-8px_rgba(25,221,181,0.6)]"
          }`}
        >
          {/* Shimmer sweep */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer"
          />

          {copyState === "copied" ? (
            <>
              <CheckCircle2 className="relative w-5 h-5 shrink-0 stroke-[2.5]" />
              <span className="relative">CHAVE COPIADA!</span>
            </>
          ) : (
            <>
              <Copy className="relative w-5 h-5 shrink-0 stroke-[2.3]" />
              <span className="relative">COPIAR CHAVE PIX</span>
            </>
          )}
        </button>

        {/* Copy Feedback & Bank App Guidance */}
        <AnimatePresence mode="wait">
          {hasCopiedOnce && copyState !== "error" && (
            <motion.div
              key="copy-success"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              role="status"
              aria-live="polite"
              className="mt-4 rounded-2xl border border-[#19DDB5]/40 bg-[#19DDB5]/10 px-4 py-4 text-left"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex items-center justify-center w-6 h-6 rounded-full bg-[#19DDB5] text-[#080D18] shrink-0">
                  <Check className="w-4 h-4 stroke-[2.75]" />
                </div>
                <div className="space-y-1.5">
                  <p className="font-display text-sm sm:text-base font-semibold text-white">
                    Chave Pix copiada com sucesso!
                  </p>
                  <p className="text-xs sm:text-sm leading-relaxed text-white/85">
                    Agora abra o aplicativo do seu banco, acesse a opção{" "}
                    <strong className="text-white font-semibold">Pix</strong>,
                    cole a chave{" "}
                    <span className="font-mono text-[#19DDB5] tabular-nums">
                      {RAW_PIX_KEY}
                    </span>
                    , confira o recebedor{" "}
                    <strong className="text-white font-semibold">
                      {RECIPIENT_NAME}
                    </strong>{" "}
                    ({RECIPIENT_BANK}) e conclua seu pagamento por lá.
                  </p>
                  <p className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#A8F5E5] pt-0.5">
                    <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                    A transferência é finalizada diretamente no app do seu banco.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {copyState === "error" && (
            <motion.div
              key="copy-error"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              role="alert"
              className="mt-4 rounded-2xl border border-amber-400/40 bg-amber-500/10 px-4 py-4 text-left"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
                <div className="space-y-1.5">
                  <p className="font-display text-sm font-semibold text-white">
                    Não foi possível copiar automaticamente
                  </p>
                  <p className="text-xs sm:text-sm text-white/85">
                    Selecione e copie manualmente os números da chave Pix abaixo
                    e finalize o pagamento no aplicativo do seu banco:
                  </p>
                  <input
                    type="text"
                    readOnly
                    value={RAW_PIX_KEY}
                    onFocus={(e) => e.currentTarget.select()}
                    aria-label="Chave Pix em números para cópia manual"
                    className="w-full rounded-xl border border-white/20 bg-[#080D18] px-3 py-2 font-mono text-base font-semibold text-[#19DDB5] tabular-nums focus:outline-none focus:ring-2 focus:ring-[#19DDB5]"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
