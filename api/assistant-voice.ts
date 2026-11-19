import type { IncomingMessage, ServerResponse } from "http";
import { GoogleGenAI } from "@google/genai";

const ASSISTANT_TEXT =
  "Olá! Seja bem-vindo. Para realizar seu pagamento via Pix, basta clicar no botão Copiar Chave Pix e depois acessar o aplicativo do seu banco para concluir o pagamento. O recebedor é Guilherme Pereira Costa. É simples, rápido e seguro. Obrigado!";

const VOICE_STYLE =
  "Adult Brazilian woman speaking Brazilian Portuguese (pt-BR) with a soft, calm, warm, welcoming, delicate and pleasant voice. Moderate pace, clear pronunciation, natural conversational intonation, gentle reassurance, completely human and never robotic, never like GPS navigation or automated IVR.";

let cachedAudioWav: Buffer | null = null;
let inFlightGeneration: Promise<Buffer> | null = null;

async function generateAssistantAudio(): Promise<Buffer> {
  if (cachedAudioWav) {
    return cachedAudioWav;
  }

  if (inFlightGeneration) {
    return inFlightGeneration;
  }

  inFlightGeneration = (async () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY não configurada no ambiente do servidor.");
    }

    const ai = new GoogleGenAI({
      apiKey,
      apiVersion: "v1beta",
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash-lite-tts",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: ASSISTANT_TEXT,
              speechMetadata: {
                style: VOICE_STYLE,
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: "Zephyr",
            },
          },
        },
      },
    });

    const parts = response.candidates?.[0]?.content?.parts ?? [];
    const audioPart = parts.find((part) => part.inlineData?.data);
    const base64Audio = audioPart?.inlineData?.data;

    if (!base64Audio) {
      throw new Error("O serviço de voz neural não retornou dados de áudio.");
    }

    const wavBuffer = Buffer.from(base64Audio, "base64");
    cachedAudioWav = wavBuffer;
    return wavBuffer;
  })();

  try {
    return await inFlightGeneration;
  } finally {
    inFlightGeneration = null;
  }
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  try {
    const wavBuffer = await generateAssistantAudio();
    res.statusCode = 200;
    res.setHeader("Content-Type", "audio/wav");
    res.setHeader("Content-Length", String(wavBuffer.length));
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=86400");
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    res.end(wavBuffer);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Não foi possível carregar a voz da assistente.";
    console.error("[vercel assistant-voice] Erro ao gerar áudio:", error);
    res.statusCode = 503;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(
      JSON.stringify({
        error: "Não foi possível reproduzir o áudio da assistente no momento.",
        details: message,
      })
    );
  }
}
