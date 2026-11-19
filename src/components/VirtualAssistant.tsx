import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, Volume2, AlertCircle } from "lucide-react";
import { motion } from "motion/react";

export const ASSISTANT_MESSAGE =
  "Olá! Seja bem-vindo. Para realizar seu pagamento via Pix, basta clicar no botão Copiar Chave Pix e depois acessar o aplicativo do seu banco para concluir o pagamento. O recebedor é Guilherme Pereira Costa. É simples, rápido e seguro. Obrigado!";

type AssistantState =
  | "loading"
  | "playing"
  | "paused"
  | "autoplay-blocked"
  | "finished"
  | "error";

const BAR_COUNT = 24;
const IDLE_BARS = Array.from({ length: BAR_COUNT }, (_, idx) => {
  const distanceFromCenter = Math.abs(idx - (BAR_COUNT - 1) / 2);
  return Math.max(0.18, 0.45 - distanceFromCenter * 0.025);
});

export function VirtualAssistant() {
  const [status, setStatus] = useState<AssistantState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [bars, setBars] = useState<number[]>(IDLE_BARS);
  const [orbEnergy, setOrbEnergy] = useState<number>(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceConnectedRef = useRef<boolean>(false);
  const rafRef = useRef<number | null>(null);
  const isMountedRef = useRef<boolean>(true);

  const stopVisualizer = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setBars(IDLE_BARS);
    setOrbEnergy(0);
  }, []);

  const startVisualizer = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
    }

    const analyser = analyserRef.current;
    const freqData = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;

    const tick = (now: number) => {
      if (!isMountedRef.current) return;

      const audio = audioRef.current;
      if (!audio || audio.paused || audio.ended) {
        stopVisualizer();
        return;
      }

      if (analyser && freqData) {
        analyser.getByteFrequencyData(freqData);
        const nextBars: number[] = [];
        const usableBins = Math.min(freqData.length, 48);
        let energySum = 0;

        for (let i = 0; i < BAR_COUNT; i++) {
          const mirrorIdx =
            i < BAR_COUNT / 2
              ? Math.floor((BAR_COUNT / 2 - 1 - i) * (usableBins / BAR_COUNT))
              : Math.floor((i - BAR_COUNT / 2) * (usableBins / BAR_COUNT));
          const val = freqData[Math.max(0, Math.min(usableBins - 1, mirrorIdx))] / 255;
          energySum += val;
          const shaped = Math.min(1, Math.max(0.14, val * 1.18));
          nextBars.push(shaped);
        }

        const avgEnergy = energySum / BAR_COUNT;
        setBars(nextBars);
        setOrbEnergy(avgEnergy);
      } else {
        // Fallback smooth organic modulation if WebAudio analyser is unavailable
        const nextBars = Array.from({ length: BAR_COUNT }, (_, i) => {
          const wave =
            0.45 +
            0.35 * Math.sin(now * 0.008 + i * 0.55) * Math.cos(now * 0.004 - i * 0.3);
          return Math.min(1, Math.max(0.16, wave));
        });
        setBars(nextBars);
        setOrbEnergy(0.45 + 0.25 * Math.sin(now * 0.006));
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [stopVisualizer]);

  const ensureAudioGraph = useCallback(async (audio: HTMLAudioElement) => {
    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioContextClass) return;

      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContextClass();
      }
      if (audioCtxRef.current.state === "suspended") {
        await audioCtxRef.current.resume();
      }
      if (!sourceConnectedRef.current && audioCtxRef.current) {
        const analyser = audioCtxRef.current.createAnalyser();
        analyser.fftSize = 128;
        analyser.smoothingTimeConstant = 0.78;
        const source = audioCtxRef.current.createMediaElementSource(audio);
        source.connect(analyser);
        analyser.connect(audioCtxRef.current.destination);
        analyserRef.current = analyser;
        sourceConnectedRef.current = true;
      }
    } catch {
      // Audio still plays directly via HTMLAudioElement even if AudioContext fails
    }
  }, []);

  const attemptPlay = useCallback(
    async (fromStart = false) => {
      const audio = audioRef.current;
      if (!audio) return;

      try {
        if (fromStart) {
          audio.currentTime = 0;
        }
        await ensureAudioGraph(audio);
        await audio.play();
        if (!isMountedRef.current) return;
        setStatus("playing");
        startVisualizer();
      } catch (err) {
        if (!isMountedRef.current) return;
        if (err instanceof DOMException && err.name === "NotAllowedError") {
          setStatus("autoplay-blocked");
          stopVisualizer();
        } else {
          setStatus("autoplay-blocked");
          stopVisualizer();
        }
      }
    },
    [ensureAudioGraph, startVisualizer, stopVisualizer]
  );

  const loadAndPlayVoice = useCallback(async () => {
    setStatus("loading");
    setErrorMessage(null);

    try {
      let url = audioUrlRef.current;
      if (!url) {
        const response = await fetch("/api/assistant-voice");
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(
            payload?.error ||
              "Não foi possível carregar a voz da assistente virtual."
          );
        }
        const blob = await response.blob();
        url = URL.createObjectURL(blob);
        audioUrlRef.current = url;
      }

      if (!isMountedRef.current) return;

      let audio = audioRef.current;
      if (!audio) {
        audio = new Audio(url);
        audio.preload = "auto";
        audio.onended = () => {
          if (!isMountedRef.current) return;
          setStatus("finished");
          stopVisualizer();
        };
        audio.onpause = () => {
          if (!isMountedRef.current) return;
          if (!audio?.ended) {
            stopVisualizer();
          }
        };
        audioRef.current = audio;
      } else if (audio.src !== url) {
        audio.src = url;
      }

      await attemptPlay(true);
    } catch (err) {
      if (!isMountedRef.current) return;
      setStatus("error");
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Erro inesperado ao inicializar a assistente virtual."
      );
      stopVisualizer();
    }
  }, [attemptPlay, stopVisualizer]);

  useEffect(() => {
    isMountedRef.current = true;
    void loadAndPlayVoice();

    return () => {
      isMountedRef.current = false;
      stopVisualizer();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.onended = null;
        audioRef.current.onpause = null;
      }
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
        void audioCtxRef.current.close().catch(() => undefined);
      }
    };
  }, [loadAndPlayVoice, stopVisualizer]);

  const handleTogglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) {
      void loadAndPlayVoice();
      return;
    }

    if (status === "playing") {
      audio.pause();
      setStatus("paused");
      stopVisualizer();
    } else if (status === "paused") {
      void attemptPlay(false);
    } else {
      void attemptPlay(true);
    }
  };

  const handleReplay = () => {
    if (!audioRef.current) {
      void loadAndPlayVoice();
      return;
    }
    void attemptPlay(true);
  };

  const isSpeaking = status === "playing";
  const ringScale = 1 + orbEnergy * 0.24;
  const outerRingScale = 1.15 + orbEnergy * 0.34;

  return (
    <section
      aria-label="Assistente virtual de pagamento"
      className="relative w-full rounded-3xl border border-white/10 bg-[#102B50]/35 backdrop-blur-xl px-5 py-7 sm:px-8 sm:py-8 shadow-[0_24px_64px_-20px_rgba(8,13,24,0.85),0_0_48px_-18px_rgba(22,139,255,0.28)] overflow-hidden"
    >
      {/* Ambient radial lighting behind the orb */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-64 w-64 rounded-full bg-[#168BFF]/20 blur-3xl"
      />

      <div className="relative flex flex-col items-center text-center gap-6">
        {/* Illuminated Blue Orb + Synchronized Soundwaves */}
        <div className="relative flex flex-col items-center gap-5 w-full">
          <button
            type="button"
            onClick={
              status === "error"
                ? loadAndPlayVoice
                : handleTogglePlayPause
            }
            aria-label={
              isSpeaking
                ? "Pausar assistente virtual"
                : "Ouvir assistente virtual"
            }
            className="group relative flex items-center justify-center w-28 h-28 sm:w-32 sm:h-32 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#19DDB5] focus-visible:ring-offset-4 focus-visible:ring-offset-[#080D18] cursor-pointer"
          >
            {/* Outer acoustic halo */}
            <span
              aria-hidden="true"
              style={{
                transform: `scale(${isSpeaking ? outerRingScale : 1.08})`,
                opacity: isSpeaking ? 0.35 + orbEnergy * 0.45 : 0.22,
              }}
              className="absolute inset-0 rounded-full bg-[#168BFF]/30 blur-md transition-transform duration-100 ease-out"
            />

            {/* Mid concentric ripple */}
            <span
              aria-hidden="true"
              style={{
                transform: `scale(${isSpeaking ? ringScale : 1})`,
              }}
              className={`absolute inset-1 rounded-full border border-[#19DDB5]/45 transition-transform duration-100 ease-out ${
                !isSpeaking ? "animate-orb-breathe" : ""
              }`}
            />

            {/* Core glowing blue circle */}
            <span
              className="relative flex items-center justify-center w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-br from-[#168BFF] via-[#1266D6] to-[#102B50] border border-[#19DDB5]/50 shadow-[0_0_32px_rgba(22,139,255,0.6),inset_0_2px_12px_rgba(255,255,255,0.35)] transition-transform duration-200 group-hover:scale-[1.03] group-active:scale-[0.98]"
            >
              {/* Inner luminous sheen */}
              <span
                aria-hidden="true"
                className="absolute inset-2 rounded-full bg-gradient-to-tr from-transparent via-[#19DDB5]/20 to-white/30 pointer-events-none"
              />
              <Volume2
                className={`relative w-9 h-9 sm:w-10 sm:h-10 text-white drop-shadow-[0_2px_8px_rgba(8,13,24,0.45)] transition-transform duration-200 ${
                  isSpeaking ? "scale-110" : "scale-100"
                }`}
              />
            </span>
          </button>

          {/* Animated Soundwaves synchronized with audio */}
          <div
            aria-hidden="true"
            className="flex items-center justify-center gap-1 sm:gap-1.5 h-10 px-4"
          >
            {bars.map((height, idx) => (
              <span
                key={idx}
                style={{
                  transform: `scaleY(${height})`,
                  opacity: isSpeaking ? 0.55 + height * 0.45 : 0.35,
                }}
                className="w-1 sm:w-1.5 h-9 rounded-full bg-gradient-to-t from-[#168BFF] to-[#19DDB5] origin-center transition-transform duration-75 ease-out"
              />
            ))}
          </div>
        </div>

        {/* Assistant Headline & Transcript */}
        <div className="max-w-xl space-y-2.5">
          <h1 className="font-display text-lg sm:text-xl font-semibold tracking-tight text-white">
            Assistente Virtual de Pagamento
          </h1>
          <p className="text-sm sm:text-[15px] leading-relaxed text-white/80">
            “{ASSISTANT_MESSAGE}”
          </p>
        </div>

        {/* Audio Interaction Controls */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
          {status === "autoplay-blocked" && (
            <motion.button
              type="button"
              onClick={() => void attemptPlay(true)}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="inline-flex items-center justify-center gap-2.5 min-h-[46px] px-6 py-2.5 rounded-xl bg-[#168BFF] hover:bg-[#168BFF]/90 active:scale-[0.98] text-white font-display font-semibold text-sm shadow-[0_8px_24px_-6px_rgba(22,139,255,0.65)] transition-all cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#19DDB5]"
            >
              <Play className="w-4 h-4 fill-current" />
              Ativar áudio da assistente
            </motion.button>
          )}

          {status === "loading" && (
            <div className="inline-flex items-center gap-2.5 min-h-[44px] px-5 py-2 rounded-xl border border-white/15 bg-white/5 text-white/80 text-sm">
              <span className="w-4 h-4 rounded-full border-2 border-[#19DDB5] border-t-transparent animate-spin" />
              Preparando boas-vindas em áudio...
            </div>
          )}

          {(status === "playing" || status === "paused") && (
            <button
              type="button"
              onClick={handleTogglePlayPause}
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2 rounded-xl border border-[#168BFF]/50 bg-[#168BFF]/20 hover:bg-[#168BFF]/30 active:scale-[0.98] text-white font-medium text-sm transition-all cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#19DDB5]"
            >
              {status === "playing" ? (
                <>
                  <Pause className="w-4 h-4" />
                  Pausar voz
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  Continuar voz
                </>
              )}
            </button>
          )}

          {(status === "playing" ||
            status === "paused" ||
            status === "finished") && (
            <button
              type="button"
              onClick={handleReplay}
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 active:scale-[0.98] text-white font-medium text-sm transition-all cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#19DDB5]"
            >
              <RotateCcw className="w-4 h-4 text-[#19DDB5]" />
              Ouvir novamente
            </button>
          )}

          {status === "error" && (
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <span className="inline-flex items-center gap-2 text-xs sm:text-sm text-amber-200/90">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-300" />
                {errorMessage || "Áudio indisponível no momento."}
              </span>
              <button
                type="button"
                onClick={() => void loadAndPlayVoice()}
                className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-xl border border-white/15 bg-white/10 hover:bg-white/15 text-white font-medium text-sm transition-all cursor-pointer whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-4 h-4 text-[#19DDB5]" />
                Tentar novamente
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
