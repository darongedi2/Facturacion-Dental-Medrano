import { GoogleGenAI } from "@google/genai";
import { ESQUEMA_FACTURA } from "./esquema";
import { INSTRUCCION_EXTRACCION } from "./prompt";

const MODELO = "gemini-flash-latest";

let clienteCache: GoogleGenAI | null = null;

function obtenerCliente(): GoogleGenAI {
  if (!clienteCache) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Falta GEMINI_API_KEY en las variables de entorno");
    clienteCache = new GoogleGenAI({ apiKey });
  }
  return clienteCache;
}

export class ErrorExtraccion extends Error {}

/**
 * Le manda el archivo (imagen o PDF) a Gemini y devuelve el JSON
 * estructurado ya parseado (forma de ESQUEMA_FACTURA). No valida ni
 * calcula confianza — eso lo hace el llamador (ver app/api/archivos/[id]/procesar).
 */
export async function extraerFactura(
  contenido: Buffer,
  tipoMime: string,
): Promise<Record<string, unknown>> {
  const ai = obtenerCliente();

  const respuesta = await ai.models.generateContent({
    model: MODELO,
    contents: [
      {
        role: "user",
        parts: [
          { text: INSTRUCCION_EXTRACCION },
          { inlineData: { mimeType: tipoMime, data: contenido.toString("base64") } },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: ESQUEMA_FACTURA,
    },
  });

  const texto = respuesta.text;
  if (!texto) {
    throw new ErrorExtraccion("Gemini no devolvio contenido para este archivo");
  }

  try {
    return JSON.parse(texto) as Record<string, unknown>;
  } catch {
    throw new ErrorExtraccion("La respuesta de Gemini no fue un JSON valido");
  }
}
