import Anthropic from "npm:@anthropic-ai/sdk@^0.104.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Modelo configurable por entorno. Por defecto el más capaz (Opus 4.8); puedes
// cambiarlo a claude-haiku-4-5 (más barato) con el secreto ANTHROPIC_MODEL.
const MODEL = Deno.env.get("ANTHROPIC_MODEL") || "claude-opus-4-8";

const anthropic = new Anthropic({
  apiKey: Deno.env.get("ANTHROPIC_API_KEY")!,
});

const SYSTEM = `Eres un asistente de salud que redacta información orientativa sobre medicamentos para cuidadores familiares en México, en español claro y sencillo (sin tecnicismos innecesarios).

Dado el nombre de un medicamento o producto de salud, devuelve:
- indication: para qué se usa habitualmente, en 2 o 3 líneas como máximo.
- side_effects: los efectos secundarios más comunes, en 2 o 3 líneas como máximo (no una lista exhaustiva).

Reglas:
- Sé conciso, neutral y factual. Nada de saludos ni introducciones.
- No incluyas dosis ni instrucciones de uso.
- Si el nombre no corresponde a un medicamento conocido o no puedes identificarlo con seguridad, deja ambos campos como cadena vacía "".
- No inventes información: ante la duda, deja el campo vacío.`;

const tool: Anthropic.Tool = {
  name: "record_med_info",
  description:
    "Registra la información orientativa del medicamento (indicación y efectos secundarios).",
  input_schema: {
    type: "object",
    properties: {
      indication: {
        type: "string",
        description: "Para qué está indicado, 2-3 líneas. Vacío si se desconoce.",
      },
      side_effects: {
        type: "string",
        description:
          "Efectos secundarios más comunes, 2-3 líneas. Vacío si se desconoce.",
      },
    },
    required: ["indication", "side_effects"],
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { name } = await req.json();
    if (!name || typeof name !== "string" || !name.trim()) {
      return new Response(JSON.stringify({ error: "Falta el nombre" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 600,
      system: SYSTEM,
      tools: [tool],
      tool_choice: { type: "tool", name: "record_med_info" },
      messages: [
        { role: "user", content: `Medicamento: ${name.trim()}` },
      ],
    });

    const block = message.content.find((b) => b.type === "tool_use");
    const input = (block && "input" in block ? block.input : {}) as {
      indication?: string;
      side_effects?: string;
    };

    return new Response(
      JSON.stringify({
        indication: (input.indication || "").trim(),
        side_effects: (input.side_effects || "").trim(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
