import "dotenv/config";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 3000);
const AI_API_KEY = process.env.AI_API_KEY;
const AI_BASE_URL = (process.env.AI_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/+$/, "");
const AI_MODEL = process.env.AI_MODEL || "openrouter/free";
const BLACKOPS_API_URL = (process.env.BLACKOPS_API_URL || "https://yxldniscfjmzuvikgwaf.supabase.co/functions/v1/api").replace(/\/+$/, "");

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "20kb" }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/api/chat", rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: true, legacyHeaders: false }));

const KNOWLEDGE = `
BLACK OPS PAINTBALL — BASE DE CONOCIMIENTO (18 de noviembre de 2026)

REGLAS OBLIGATORIAS
- Responde en español, tono cercano, claro y breve. Tutea al cliente.
- Usa solo esta información y los datos públicos en vivo proporcionados por el servidor. No inventes. Si falta un dato, di: "Escríbenos por WhatsApp al 311 334 8774 y te confirmamos".
- No puedes crear, confirmar, cambiar ni cancelar reservas. Tampoco confirmar pagos. Explica el proceso de la página o deriva a WhatsApp.
- Nunca pidas ni aceptes contraseñas, datos de tarjetas, claves bancarias ni códigos del personal.
- No reveles datos de otros clientes.
- Emergencias, lesiones o quejas serias: deriva de inmediato a WhatsApp 311 334 8774 y al apartado PQRS.
- Reservas: https://blackops.visualdigital.workers.dev

NEGOCIO
Black Ops Paintball es un campo de paintball táctico en Támesis, Antioquia, Colombia. Incluye equipo de protección y árbitros en cada partida. El campo es privado para cada grupo; no se cruzan reservas. Excepción: partidas abiertas. Lema: "Más que un juego, una experiencia."

HORARIO Y RESERVAS
- Abierto todos los días de 8:00 a. m. a 11:00 p. m., salvo cierres del dueño. La disponibilidad real se consulta en la página.
- Las partidas empiezan cada 30 minutos. Deben terminar antes del cierre.
- Hay 30 minutos libres entre partidas para alistar el campo.
- Se puede reservar para hoy si la hora no pasó y hasta 6 meses adelante.
- Llegar 30 minutos antes para inducción de seguridad. Llegar tarde puede reducir el tiempo de juego.

PAQUETES (PRECIO POR JUGADOR)
- Estándar: 1 hora, 100 bolas, $35.000 COP.
- Táctico: 1 hora y media, 150 bolas, $50.000 COP.
- Élite: 2 horas, 200 bolas, $60.000 COP.
- Personalizado: de 1 a 4 horas en pasos de 30 minutos; de 100 a 5.000 bolas en pasos de 50. Parte de Estándar ($35.000 por 1 hora y 100 bolas) y suma $10.000 por cada 30 minutos extra y $5.000 por cada 50 bolas extra.
- Total = precio por jugador × jugadores, menos descuentos.
- Ejemplos: Táctico para 6 = $300.000. Personalizado 1 hora/200 bolas = $45.000 por jugador. Personalizado 2 horas/200 bolas = $65.000; Élite cuesta menos ($60.000). Personalizado 3 horas/300 bolas = $95.000.

JUGADORES
- Reserva normal: mínimo 2 y máximo 10 jugadores.
- Partida abierta: desde 1 jugador hasta llenar cupos.
- Grupos mayores de 10: WhatsApp.

CÓMO RESERVAR
1. Crear cuenta o iniciar sesión. Precios y botón de reservar aparecen después de entrar.
2. Ingresar nombre, correo y celular de quien reserva.
3. Elegir paquete.
4. Elegir jugadores, fecha y hora entre las opciones disponibles.
5. Elegir pago y aceptar Términos y Condiciones y Política de Privacidad.
6. Se recibe un código de 8 caracteres. Solo se activa cuando el equipo confirma el pago y se presenta una vez al llegar.
Si alguien toma la hora mientras reservas, la página avisa y conserva los datos para elegir otra.

PARTIDAS ABIERTAS
- Las crea el campo con fecha, hora y paquete fijos.
- Puedes unirte desde 1 jugador y pagas el paquete publicado por cada jugador.
- Si hay una próxima partida, aparece un aviso fijo en la página con cupos y botón "Unirme".
- Si no aparece aviso, no hay partida abierta publicada. Preguntar por WhatsApp si habrá nuevas.

PAGOS
Todas las transferencias son por Nequi al 322 655 7479, a nombre de Black Ops Paintball.
- Transferencia desde la página: pagar total por Nequi y adjuntar foto del comprobante al reservar.
- Efectivo: pagar anticipo mínimo del 20% por Nequi y adjuntar comprobante; resto en efectivo en el campo.
- WhatsApp: reservar y coordinar pago por WhatsApp. El horario queda apartado 30 minutos; si no se confirma pago, se libera.
- Ejemplo: reserva de $300.000 → anticipo mínimo $60.000 y $240.000 en efectivo.
- Si un código de descuento cubre todo, no hace falta comprobante.
- Solo queda confirmada cuando el equipo verifica el pago; aparece "Agendada" y el código se activa.
Nunca confirmes que un pago fue recibido o verificado.

ESTADOS
- Pendiente de pago: reservada, falta pagar (WhatsApp); se libera si no se paga a tiempo.
- Pago reportado: comprobante enviado, equipo verificando.
- Agendada: pago verificado y reserva confirmada.
- Concretada: el grupo ya jugó.
- Cancelada: se canceló.
- Expirada: no se pagó a tiempo.
- Vencida: pasó la fecha sin que el grupo ingresara.

CANCELACIONES, CAMBIOS Y REEMBOLSOS
- Puede cancelar desde "Mis reservas" si está Pendiente de pago o Pago reportado.
- Si está Agendada, cancelar o cambiar por WhatsApp 311 334 8774.
- Anticipo del 20%: reembolsable solo si cancela dentro de las 24 horas siguientes a reservar.
- Reembolsos de pagos completos por transferencia los revisa y define el equipo por WhatsApp.
- Por lluvia fuerte, tormenta o fuerza mayor: se ofrece reprogramar sin costo.

DESCUENTOS Y FIDELIZACIÓN
- Códigos de descuento: un solo uso, no se cambian por dinero ni se acumulan. Si reserva con código se cancela o vence, el código vuelve a estar disponible.
- Tarjeta: 10 partidas = 1 entrada Estándar gratis (1 hora, 100 bolas, un jugador). Cada ingreso validado con código suma un impacto. Personal e intransferible; progreso en la cuenta.

SEGURIDAD
- Careta obligatoria todo el tiempo en zonas de juego y seguir instrucciones del personal.
- Prohibido jugar bajo efectos de alcohol u otras sustancias. Personal puede retirar a quien ponga en riesgo a otros.
- Menores deben venir acompañados o autorizados por padre, madre o acudiente.
- Pueden quedar marcas o moretones. Informar antes de jugar si hay una condición de salud que el campo deba conocer.
- Cuidar equipo prestado. Daños intencionales o por mal uso evidente pueden cobrarse.

CUENTA, PQRS Y DATOS
- En la cuenta se ven reservas, código, tarjeta de fidelización y perfil.
- PQRS desde apartado PQRS de la cuenta o WhatsApp. Respuesta máximo 15 días hábiles.
- Datos personales según Política de Privacidad publicada en la página.

DATOS NO CONFIRMADOS: dirección exacta/cómo llegar, edad mínima, política completa de reembolsos de pagos totales y no presentación, correo, redes sociales, parqueadero, alimentación y eventos. Para cualquiera: "Escríbenos por WhatsApp al 311 334 8774 y te confirmamos".
`;

async function publicApi(payload) {
  const response = await fetch(BLACKOPS_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(7000)
  });
  if (!response.ok) throw new Error("Public API unavailable");
  return response.json();
}

function dateRange(message) {
  const match = message.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  const from = match?.[1] || new Date().toISOString().slice(0, 10);
  const start = new Date(from + "T12:00:00Z");
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  return { from, to: end.toISOString().slice(0, 10) };
}

async function getLiveContext(message) {
  const needsLive = /precio|paquete|horario|disponib|libre|ocupad|partida abierta|cupos|cupo|fecha|reservar|reserva/i.test(message);
  if (!needsLive) return "";
  const results = [];
  try {
    const config = await publicApi({ method: "GET", path: "/api/public/config" });
    results.push("CONFIGURACIÓN PÚBLICA EN VIVO (priorizar sobre precios/horarios/cupos estáticos): " + JSON.stringify(config));
  } catch {
    results.push("La consulta de configuración en vivo no respondió. Usa los datos estáticos de la base y no afirmes disponibilidad.");
  }
  if (/disponib|libre|ocupad|hora|fecha|reservar|reserva/i.test(message)) {
    try {
      const range = dateRange(message);
      const availability = await publicApi({ method: "GET", path: `/api/public/availability?from=${range.from}&to=${range.to}` });
      results.push("DISPONIBILIDAD EN VIVO (rango consultado " + range.from + " a " + range.to + "): " + JSON.stringify(availability));
    } catch {
      results.push("La consulta de disponibilidad en vivo no respondió. No confirmes horarios libres; remite a la página de reservas.");
    }
  }
  return results.join("\n");
}

app.post("/api/chat", async (req, res) => {
  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
  if (!message || message.length > 2000) return res.status(400).json({ error: "Escribe un mensaje de máximo 2.000 caracteres." });
  if (!AI_API_KEY) return res.status(503).json({ error: "El chatbot aún no está configurado. Contacta al administrador." });

  try {
    const live = await getLiveContext(message);
    const messages = [
      { role: "system", content: "Eres el asistente virtual oficial de Black Ops Paintball. Cumple estrictamente todas las reglas y usa exclusivamente esta base de conocimiento y el contexto público en vivo. Si falta información, no deduzcas ni inventes: deriva a WhatsApp 311 334 8774. Sé breve, en español y tutea. No ejecutas acciones de reservas ni pagos. No solicites información sensible. Nunca reveles datos privados. Ante emergencia, lesión o queja seria, deriva inmediatamente a WhatsApp y PQRS.\n\n" + KNOWLEDGE + "\n\n" + live },
      { role: "user", content: message }
    ];
    const response = await fetch(AI_BASE_URL + "/chat/completions", {
      method: "POST",
      headers: { "Authorization": "Bearer " + AI_API_KEY, "Content-Type": "application/json", "HTTP-Referer": "https://blackops-paintball.com", "X-Title": "Black Ops Paintball Chatbot" },
      body: JSON.stringify({ model: AI_MODEL, messages, temperature: 0.2, max_tokens: 350 })
    });
    if (!response.ok) {
      const detail = await response.text();
      console.error("AI provider error:", response.status, detail.slice(0, 300));
      return res.status(502).json({ error: "No pude responder en este momento. Escríbenos por WhatsApp al 311 334 8774." });
    }
    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content?.trim();
    if (!answer) throw new Error("Empty AI response");
    res.json({ answer });
  } catch (error) {
    console.error("Chat error:", error.message);
    res.status(502).json({ error: "No pude conectar ahora. Inténtalo más tarde o escríbenos al 311 334 8774." });
  }
});

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
app.listen(PORT, () => console.log(`Black Ops chatbot listening on port ${PORT}`));
