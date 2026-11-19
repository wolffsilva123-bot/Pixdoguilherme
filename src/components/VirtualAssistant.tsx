import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, Volume2, AlertCircle } from "lucide-react";
import { motion } from "motion/react";

export const ASSISTANT_MESSAGE =
  "Olá! Seja bem-vindo. Para realizar seu pagamento via Pix, basta clicar no botão Copiar Chave Pix e depois acessar o aplicativo do seu banco para concluir o pagamento. O recebedor é Guilherme Pereira Costa e o banco é Mercado Pago. É simples, rápido e seguro. Obrigado!";

type AssistantState =
  | "loading"
  | "playing"
  | "paused"
  | "autoplay-blocked"
  | "finished"
  | "error";

type AudioEngine = "neural-audio" | "speech-synthesis";

const BAR_COUNT = 24;
const IDLE_BARS = Array.from({ length: BAR_COUNT }, (_, idx) => {
  const distanceFromCenter = Math.abs(idx - (BAR_COUNT - 1) / 2);
  return Math.max(0.18, 0.45 - distanceFromCenter * 0.025);
});

const FETCH_TIMEOUT_MS = 10000;

function isAppleMobileOrSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/i.test(ua);
  const isTouchMac =
    navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
  return isIOS || isTouchMac || isSafari;
}

function pickBrazilianFemaleVoice(
  voices: SpeechSynthesisVoice[]
): SpeechSynthesisVoice | null {
  if (!voices.length) return null;

  const ptBrVoices = voices.filter((v) =>
    v.lang.toLowerCase().replace("_", "-").startsWith("pt-br")
  );
  const ptVoices =
    ptBrVoices.length > 0
      ? ptBrVoices
      : voices.filter((v) => v.lang.toLowerCase().startsWith("pt"));

  if (!ptVoices.length) return null;

  const femalePreferredNames = [
    "francisca",
    "thalita",
    "luciana",
    "maria",
    "vitoria",
    "vitória",
    "camila",
    "fernanda",
    "raquel",
    "leticia",
    "letícia",
    "google português do brasil",
    "female",
    "mulher",
    "natural",
  ];
  const maleOrRoboticNames = [
    "daniel",
    "felipe",
    "ricardo",
    "antonio",
    "antônio",
    "thiago",
    "espeak",
    "male",
  ];

  const scored = ptVoices.map((voice) => {
    const name = voice.name.toLowerCase();
    let score = 0;
    if (voice.lang.toLowerCase().replace("_", "-") === "pt-br") score += 20;
    if (!voice.localService) score += 8;
    for (let i = 0; i < femalePreferredNames.length; i++) {
      if (name.includes(femalePreferredNames[i])) {
        score += 35 - i;
      }
    }
    for (const bad of maleOrRoboticNames) {
      if (name.includes(bad)) {
        score -= 50;
      }
    }
    return { voice, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.voice ?? ptVoices[0];
}

function loadSpeechVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      resolve([]);
      return;
    }

    const existing = window.speechSynthesis.getVoices();
    if (existing.length > 0) {
      resolve(existing);
      return;
    }

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.speechSynthesis.removeEventListener?.("voiceschanged", onChanged);
      resolve(window.speechSynthesis.getVoices());
    };

    const onChanged = () => finish();
    window.speechSynthesis.addEventListener?.("voiceschanged", onChanged);
    window.setTimeout(finish, 600);
  });
}

export function VirtualAssistant() {
  const [status, setStatus] = useState<AssistantState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [bars, setBars] = useState<number[]>(IDLE_BARS);
  const [orbEnergy, setOrbEnergy] = useState<number>(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const audioReadyRef = useRef<boolean>(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceConnectedRef = useRef<boolean>(false);
  const engineRef = useRef<AudioEngine>("neural-audio");
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const speechVoicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const rafRef = useRef<number | null>(null);
  const statusRef = useRef<AssistantState>("loading");
  const isMountedRef = useRef<boolean>(true);

  const updateStatus = useCallback((next: AssistantState) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

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

      if (engineRef.current === "neural-audio") {
        const audio = audioRef.current;
        if (!audio || audio.paused || audio.ended) {
          stopVisualizer();
          return;
        }
      } else if (statusRef.current !== "playing") {
        stopVisualizer();
        return;
      }

      let usedAnalyser = false;
      if (engineRef.current === "neural-audio" && analyser && freqData) {
        analyser.getByteFrequencyData(freqData);
        let energySum = 0;
        const usableBins = Math.min(freqData.length, 48);
        const nextBars: number[] = [];

        for (let i = 0; i < BAR_COUNT; i++) {
          const mirrorIdx =
            i < BAR_COUNT / 2
              ? Math.floor((BAR_COUNT / 2 - 1 - i) * (usableBins / BAR_COUNT))
              : Math.floor((i - BAR_COUNT / 2) * (usableBins / BAR_COUNT));
          const val =
            freqData[Math.max(0, Math.min(usableBins - 1, mirrorIdx))] / 255;
          energySum += val;
          nextBars.push(Math.min(1, Math.max(0.14, val * 1.18)));
        }

        const avgEnergy = energySum / BAR_COUNT;
        if (avgEnergy > 0.01) {
          usedAnalyser = true;
          setBars(nextBars);
          setOrbEnergy(avgEnergy);
        }
      }

      if (!usedAnalyser) {
        // Organic speech-synchronized animation (used on iOS Safari & SpeechSynthesis)
        const nextBars = Array.from({ length: BAR_COUNT }, (_, i) => {
          const centerFactor =
            1 - Math.abs(i - (BAR_COUNT - 1) / 2) / (BAR_COUNT / 1.4);
          const wave =
            (0.32 + 0.45 * centerFactor) +
            0.28 *
              Math.sin(now * 0.009 + i * 0.52) *
              Math.cos(now * 0.0045 - i * 0.28);
          return Math.min(1, Math.max(0.16, wave));
        });
        setBars(nextBars);
        setOrbEnergy(0.38 + 0.24 * Math.sin(now * 0.007));
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [stopVisualizer]);

  const attachDesktopAnalyser = useCallback((audio: HTMLAudioElement) => {
    // Never attach createMediaElementSource on Apple/Safari: it mutes blob audio on iOS.
    if (isAppleMobileOrSafari() || sourceConnectedRef.current) return;
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
        void audioCtxRef.current.resume().catch(() => undefined);
      }
      const analyser = audioCtxRef.current.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.78;
      const source = audioCtxRef.current.createMediaElementSource(audio);
      source.connect(analyser);
      analyser.connect(audioCtxRef.current.destination);
      analyserRef.current = analyser;
      sourceConnectedRef.current = true;
    } catch {
      // Safe fallback: audio plays natively without WebAudio analyser
    }
  }, []);

  const playSpeechSynthesis = useCallback(
    (isUserGesture: boolean) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        updateStatus("error");
        setErrorMessage(
          "Seu navegador não suporta reprodução de áudio da assistente."
        );
        stopVisualizer();
        return;
      }

      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(ASSISTANT_MESSAGE);
        utterance.lang = "pt-BR";
        utterance.rate = 0.96;
        utterance.pitch = 1.03;
        utterance.volume = 1;

        const chosenVoice = pickBrazilianFemaleVoice(
          speechVoicesRef.current.length > 0
            ? speechVoicesRef.current
            : window.speechSynthesis.getVoices()
        );
        if (chosenVoice) {
          utterance.voice = chosenVoice;
        }

        let started = false;
        const startGuardTimer = window.setTimeout(() => {
          if (!isMountedRef.current || started) return;
          if (!isUserGesture) {
            window.speechSynthesis.cancel();
            updateStatus("autoplay-blocked");
            stopVisualizer();
          }
        }, 1200);

        utterance.onstart = () => {
          started = true;
          window.clearTimeout(startGuardTimer);
          if (!isMountedRef.current) return;
          updateStatus("playing");
          startVisualizer();
        };

        utterance.onend = () => {
          window.clearTimeout(startGuardTimer);
          if (!isMountedRef.current) return;
          updateStatus("finished");
          stopVisualizer();
        };

        utterance.onerror = (event) => {
          window.clearTimeout(startGuardTimer);
          if (!isMountedRef.current) return;
          if (event.error === "not-allowed" || !isUserGesture) {
            updateStatus("autoplay-blocked");
          } else if (event.error !== "interrupted" && event.error !== "canceled") {
            updateStatus("error");
            setErrorMessage("Não foi possível reproduzir a voz da assistente.");
          }
          stopVisualizer();
        };

        utteranceRef.current = utterance;
        window.speechSynthesis.speak(utterance);

        if (isUserGesture) {
          updateStatus("playing");
          startVisualizer();
        }
      } catch {
        updateStatus(isUserGesture ? "error" : "autoplay-blocked");
        if (isUserGesture) {
          setErrorMessage("Não foi possível iniciar a reprodução de voz.");
        }
        stopVisualizer();
      }
    },
    [startVisualizer, stopVisualizer, updateStatus]
  );

  const playNeuralAudioSync = useCallback(
    (fromStart: boolean) => {
      const audio = audioRef.current;
      if (!audio || !audioReadyRef.current) return false;

      try {
        if (fromStart && audio.readyState >= 1 && audio.currentTime > 0) {
          audio.currentTime = 0;
        }
        attachDesktopAnalyser(audio);
        const playPromise = audio.play();
        if (playPromise && typeof playPromise.then === "function") {
          playPromise
            .then(() => {
              if (!isMountedRef.current) return;
              updateStatus("playing");
              startVisualizer();
            })
            .catch(() => {
              if (!isMountedRef.current) return;
              updateStatus("autoplay-blocked");
              stopVisualizer();
            });
        } else {
          updateStatus("playing");
          startVisualizer();
        }
        return true;
      } catch {
        updateStatus("autoplay-blocked");
        stopVisualizer();
        return false;
      }
    },
    [attachDesktopAnalyser, startVisualizer, stopVisualizer, updateStatus]
  );

  const initializeAssistantVoice = useCallback(
    async (playImmediatelyIfAllowed: boolean) => {
      updateStatus("loading");
      setErrorMessage(null);

      // Preload browser voices in parallel for instant fallback if needed
      void loadSpeechVoices().then((voices) => {
        speechVoicesRef.current = voices;
      });

      const controller = new AbortController();
      const timeoutId = window.setTimeout(
        () => controller.abort(),
        FETCH_TIMEOUT_MS
      );

      try {
        let url = audioUrlRef.current;
        if (!url) {
          const response = await fetch("/api/assistant-voice", {
            signal: controller.signal,
            cache: "force-cache",
          });
          if (!response.ok) {
            throw new Error("Serviço de voz neural indisponível.");
          }
          const contentType = response.headers.get("content-type") || "";
          if (!contentType.includes("audio")) {
            throw new Error("Formato de áudio inválido recebido do servidor.");
          }
          const buffer = await response.arrayBuffer();
          if (buffer.byteLength < 1000) {
            throw new Error("Áudio recebido incompleto.");
          }
          const wavBlob = new Blob([buffer], { type: "audio/wav" });
          url = URL.createObjectURL(wavBlob);
          audioUrlRef.current = url;
        }

        window.clearTimeout(timeoutId);
        if (!isMountedRef.current) return;

        const audio = audioRef.current;
        if (!audio) {
          throw new Error("Elemento de áudio não encontrado.");
        }

        engineRef.current = "neural-audio";
        audio.src = url;
        audio.load();
        audioReadyRef.current = true;

        if (playImmediatelyIfAllowed) {
          playNeuralAudioSync(true);
        } else {
          updateStatus("autoplay-blocked");
        }
      } catch {
        window.clearTimeout(timeoutId);
        if (!isMountedRef.current) return;

        // Graceful fallback to Brazilian Portuguese female SpeechSynthesis
        const voices = await loadSpeechVoices();
        speechVoicesRef.current = voices;

        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          engineRef.current = "speech-synthesis";
          if (playImmediatelyIfAllowed && !isAppleMobileOrSafari()) {
            playSpeechSynthesis(false);
          } else {
            updateStatus("autoplay-blocked");
            stopVisualizer();
          }
        } else {
          updateStatus("error");
          setErrorMessage(
            "Não foi possível carregar o áudio da assistente no momento."
          );
          stopVisualizer();
        }
      }
    },
    [playNeuralAudioSync, playSpeechSynthesis, stopVisualizer, updateStatus]
  );

  useEffect(() => {
    isMountedRef.current = true;
    void initializeAssistantVoice(true);

    return () => {
      isMountedRef.current = false;
      stopVisualizer();
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
        void audioCtxRef.current.close().catch(() => undefined);
      }
    };
  }, [initializeAssistantVoice, stopVisualizer]);

  const handleActivateAudio = () => {
    if (engineRef.current === "neural-audio" && audioReadyRef.current) {
      playNeuralAudioSync(true);
      return;
    }
    if (engineRef.current === "speech-synthesis") {
      playSpeechSynthesis(true);
      return;
    }
    void initializeAssistantVoice(true);
  };

  const handleTogglePlayPause = () => {
    if (status === "error") {
      void initializeAssistantVoice(true);
      return;
    }
    if (status === "autoplay-blocked") {
      handleActivateAudio();
      return;
    }

    if (engineRef.current === "speech-synthesis") {
      if (status === "playing") {
        window.speechSynthesis.cancel();
        updateStatus("paused");
        stopVisualizer();
      } else {
        playSpeechSynthesis(true);
      }
      return;
    }

    const audio = audioRef.current;
    if (!audio || !audioReadyRef.current) {
      void initializeAssistantVoice(true);
      return;
    }

    if (status === "playing") {
      audio.pause();
      updateStatus("paused");
      stopVisualizer();
    } else if (status === "paused") {
      playNeuralAudioSync(false);
    } else {
      playNeuralAudioSync(true);
    }
  };

  const handleReplay = () => {
    if (engineRef.current === "speech-synthesis") {
      playSpeechSynthesis(true);
      return;
    }
    if (audioReadyRef.current) {
      playNeuralAudioSync(true);
    } else {
      void initializeAssistantVoice(true);
    }
  };

  const isSpeaking = status === "playing";
  const ringScale = 1 + orbEnergy * 0.24;
  const outerRingScale = 1.15 + orbEnergy * 0.34;

  return (
    <section
      aria-label="Assistente virtual de pagamento"
      className="relative w-full rounded-3xl border border-white/10 bg-[#102B50]/35 backdrop-blur-xl px-5 py-7 sm:px-8 sm:py-8 shadow-[0_24px_64px_-20px_rgba(8,13,24,0.85),0_0_48px_-18px_rgba(22,139,255,0.28)] overflow-hidden"
    >
      {/* Declarative playsInline audio element for iOS Safari reliability */}
      <audio
        ref={audioRef}
        playsInline
        preload="auto"
        className="hidden"
        onEnded={() => {
          if (!isMountedRef.current) return;
          updateStatus("finished");
          stopVisualizer();
        }}
        onPause={() => {
          if (!isMountedRef.current) return;
          if (audioRef.current && !audioRef.current.ended) {
            stopVisualizer();
          }
        }}
        onError={() => {
          if (!isMountedRef.current || !audioReadyRef.current) return;
          // If WAV playback fails on device, transparently fall back to PT-BR SpeechSynthesis
          if (typeof window !== "undefined" && "speechSynthesis" in window) {
            engineRef.current = "speech-synthesis";
            audioReadyRef.current = false;
            updateStatus("autoplay-blocked");
            stopVisualizer();
          } else {
            updateStatus("error");
            setErrorMessage("Não foi possível reproduzir o áudio neste dispositivo.");
            stopVisualizer();
          }
        }}
      />

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
            onClick={handleTogglePlayPause}
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
            <span className="relative flex items-center justify-center w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-br from-[#168BFF] via-[#1266D6] to-[#102B50] border border-[#19DDB5]/50 shadow-[0_0_32px_rgba(22,139,255,0.6),inset_0_2px_12px_rgba(255,255,255,0.35)] transition-transform duration-200 group-hover:scale-[1.03] group-active:scale-[0.98]">
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
              onClick={handleActivateAudio}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="inline-flex items-center justify-center gap-2.5 min-h-[48px] px-6 py-2.5 rounded-xl bg-[#168BFF] hover:bg-[#168BFF]/90 active:scale-[0.98] text-white font-display font-bold text-sm tracking-wide shadow-[0_8px_24px_-6px_rgba(22,139,255,0.65)] transition-all cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#19DDB5]"
            >
              <Play className="w-4 h-4 fill-current" />
              ATIVAR ÁUDIO
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
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 active:scale-[0.98] text-white font-display font-semibold text-sm tracking-wide transition-all cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#19DDB5]"
            >
              <RotateCcw className="w-4 h-4 text-[#19DDB5]" />
              OUVIR NOVAMENTE
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
                onClick={() => void initializeAssistantVoice(true)}
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
