import "dotenv/config";
import express from "express";
import type { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ASSISTANT_TEXT =
  "Olá! Seja bem-vindo. Para realizar seu pagamento via Pix, basta clicar no botão Copiar Chave Pix e depois acessar o aplicativo do seu banco para concluir o pagamento. O recebedor é Guilherme Pereira Costa e o banco é Mercado Pago. É simples, rápido e seguro. Obrigado!";

const VOICE_STYLE =
  "Adult Brazilian woman speaking Brazilian Portuguese (pt-BR) with a soft, calm, warm, welcoming, delicate and pleasant voice. Moderate pace, clear pronunciation, natural conversational intonation, gentle reassurance, completely human and never robotic, never like GPS navigation or automated IVR.";

let cachedAudioWav: Buffer | null = null;
let inFlightGeneration: Promise<Buffer> | null = null;

function createGeminiClient(): GoogleGenAI {
  const apiKey =
    process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY não configurada no ambiente do servidor.");
  }
  return new GoogleGenAI({
    apiKey,
    apiVersion: "v1beta",
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

async function generateAssistantAudio(): Promise<Buffer> {
  if (cachedAudioWav) {
    return cachedAudioWav;
  }

  if (inFlightGeneration) {
    return inFlightGeneration;
  }

  inFlightGeneration = (async () => {
    const ai = createGeminiClient();
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

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;

  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.get("/api/assistant-voice", async (_req: Request, res: Response) => {
    try {
      const wavBuffer = await generateAssistantAudio();
      res.setHeader("Content-Type", "audio/wav");
      res.setHeader("Content-Length", String(wavBuffer.length));
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.status(200).send(wavBuffer);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível carregar a voz da assistente.";
      console.error("[assistant-voice] Erro ao gerar áudio:", error);
      res.setHeader("Cache-Control", "no-store");
      res.status(503).json({
        error: "Não foi possível reproduzir o áudio da assistente no momento.",
        details: message,
      });
    }
  });

  const distDir = path.resolve(__dirname, "dist");
  const distIndexPath = path.join(distDir, "index.html");
  const isDev =
    process.env.NODE_ENV === "development" ||
    process.env.npm_lifecycle_event === "dev" ||
    !fs.existsSync(distIndexPath);

  if (isDev) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distDir));
    app.get("/{*splat}", (_req: Request, res: Response) => {
      res.sendFile(distIndexPath);
    });
  }

  app.listen(port, "0.0.0.0", () => {
    console.log(`Server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
