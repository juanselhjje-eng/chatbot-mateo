import "dotenv/config";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "node:path";
import { randomUUID, createHmac, timingSafeEqual } from "node:crypto";
import { fileURLToPath } from "node:url";
import { runCustomerTeam, runMarketingResearchTeam, runOwnerSecretary, runGeneralAudit, getAgentRoster } from "./agents.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 3000);
const GEMINI_KEYS = [process.env.GEMINI_API_KEY_1, process.env.GEMINI_API_KEY_2].filter(Boolean);
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const OWNER_PHONE = digits(process.env.OWNER_WHATSAPP_NUMBER || "");
const WA_TOKEN = process.env.WHATSAPP_TOKEN || "";
const WA_PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || "";
const WA_VERIFY = process.env.WHATSAPP_VERIFY_TOKEN || "";
const META_APP_SECRET = process.env.META_APP_SECRET || "";
const WA_NOTIFICATION_TEMPLATE = process.env.WHATSAPP_NOTIFICATION_TEMPLATE || "";
const WA_VERSION = process.env.WHATSAPP_API_VERSION || "v27.0";
const IG_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN || "";
const IG_ACCOUNT_ID = process.env.INSTAGRAM_ACCOUNT_ID || "";
const INTERNAL_SECRET = process.env.AGENT_INTERNAL_WEBHOOK_SECRET || "";
const WEBSITE_URL = process.env.BLACKOPS_WEBSITE_URL || "https://blackops.visualdigital.workers.dev";
const BLACKOPS_API_URL = (process.env.BLACKOPS_API_URL || "https://yxldniscfjmzuvikgwaf.supabase.co/functions/v1/api").replace(/\/+$/, "");
const ESCALATION_MS = 2 * 60 * 1000;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "1mb", verify: (req, _res, buffer) => { req.rawBody = Buffer.from(buffer); } }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/api/chat", rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: true, legacyHeaders: false }));

const KNOWLEDGE = `
BLACK OPS PAINTBALL — BASE DE CONOCIMIENTO (18 de noviembre de 2026)
Responde en español, breve, claro y sin inventar. Black Ops Paintball está en Támesis, Antioquia. Lema: "Más que un juego, una experiencia."
Reservas: https://blackops.visualdigital.workers.dev. WhatsApp de atención: 311 334 8774.
Horario publicado: todos los días de 8:00 a. m. a 11:00 p. m., sujeto a cierres. Las partidas empiezan cada 30 minutos. Llegar 30 minutos antes.
Paquetes por jugador: Estándar 1 hora/100 bolas/$35.000 COP; Táctico 1,5 horas/150 bolas/$50.000; Élite 2 horas/200 bolas/$60.000.
Personalizado: 1 a 4 horas en pasos de 30 minutos y 100 a 5.000 bolas en pasos de 50. Parte de $35.000 por 1 hora/100 bolas; suma $10.000 por cada 30 minutos extra y $5.000 por cada 50 bolas extra.
Reserva normal: 2 a 10 jugadores. Grupos mayores deben consultar por WhatsApp. Partidas abiertas dependen de las que publique el negocio.
Pagos: transferencias por Nequi al 322 655 7479, a nombre de Black Ops Paintball. Transferencia desde la página: pagar total y adjuntar comprobante. Efectivo: anticipo mínimo del 20% por Nequi y saldo en el campo. WhatsApp: se coordina pago y la hora se aparta 30 minutos. Una reserva solo queda confirmada cuando el equipo verifica el pago.
Nunca confirmes reservas ni pagos. No pidas contraseñas, claves, tarjetas ni códigos. No reveles información de otros clientes.
Cancelaciones/cambios de reservas agendadas: por WhatsApp 311 334 8774. Lluvia fuerte, tormenta o fuerza mayor: se ofrece reprogramar sin costo.
Seguridad: seguir instrucciones del personal, usar la protección obligatoria en las zonas de juego. Menores deben venir acompañados o autorizados por padre, madre o acudiente.
PQRS por la cuenta o WhatsApp; respuesta máxima 15 días hábiles.
No están confirmados dirección exacta, edad mínima, política completa de reembolsos, parqueadero, alimentación, correo ni redes oficiales. Consulta al dueño antes de responder esos datos.
`;

function digits(value) { return String(value || "").replace(/\D/g, ""); }
function dbReady() { return Boolean(SUPABASE_URL && SUPABASE_KEY); }
function validMetaSignature(req) {
  if (!META_APP_SECRET || !req.rawBody) return false;
  const signature = req.get("x-hub-signature-256") || "";
  if (!signature.startsWith("sha256=")) return false;
  const expected = Buffer.from("sha256=" + createHmac("sha256", META_APP_SECRET).update(req.rawBody).digest("hex"));
  const received = Buffer.from(signature);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
function waReady() { return Boolean(WA_TOKEN && WA_PHONE_ID); }

async function db(pathname, options = {}) {
  if (!dbReady()) throw new Error("Supabase no está configurado");
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${pathname}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: options.prefer || "return=representation",
      ...(options.headers || {})
    },
    signal: AbortSignal.timeout(10000)
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${body.slice(0, 300)}`);
  return body ? JSON.parse(body) : [];
}

async function gemini(contents, systemInstruction, jsonMode = false, useSearch = false) {
  if (!GEMINI_KEYS.length) throw new Error("Falta GEMINI_API_KEY_1");
  let lastError;
  for (const key of GEMINI_KEYS) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents,
          generationConfig: { temperature: 0.25, maxOutputTokens: 1200, ...(jsonMode ? { responseMimeType: "application/json" } : {}) },
          ...(useSearch ? { tools: [{ google_search: {} }] } : {})
        }),
        signal: AbortSignal.timeout(25000)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || `Gemini HTTP ${response.status}`);
      const text = data.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("").trim();
      if (!text) throw new Error("Gemini devolvió una respuesta vacía");
      return text;
    } catch (error) { lastError = error; }
  }
  throw lastError || new Error("Gemini no disponible");
}

async function sendWhatsApp(to, body) {
  if (!waReady()) throw new Error("WhatsApp Cloud API no está configurada");
  const endpoint = `https://graph.facebook.com/${WA_VERSION}/${WA_PHONE_ID}/messages`;
  const headers = { Authorization: `Bearer ${WA_TOKEN}`, "Content-Type": "application/json" };
  const textPayload = { messaging_product: "whatsapp", recipient_type: "individual", to: digits(to), type: "text", text: { preview_url: false, body: String(body).slice(0, 4000) } };
  let response = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(textPayload), signal: AbortSignal.timeout(15000) });
  let data = await response.json();
  if (!response.ok && WA_NOTIFICATION_TEMPLATE) {
    const templatePayload = {
      messaging_product: "whatsapp", to: digits(to), type: "template",
      template: { name: WA_NOTIFICATION_TEMPLATE, language: { code: "es_CO" }, components: [{ type: "body", parameters: [{ type: "text", text: String(body).slice(0, 950) }] }] }
    };
    response = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(templatePayload), signal: AbortSignal.timeout(15000) });
    data = await response.json();
  }
  if (!response.ok) throw new Error(data.error?.message || `WhatsApp HTTP ${response.status}`);
  return data;
}

async function notifyOwner(message) {
  if (!OWNER_PHONE || !waReady()) {
    console.warn("Aviso al dueño no enviado: falta OWNER_WHATSAPP_NUMBER o configuración de WhatsApp.");
    return false;
  }
  try { await sendWhatsApp(OWNER_PHONE, message); return true; }
  catch (error) {
    console.error("No se pudo notificar al dueño:", error.message);
    return false;
  }
}

async function answerCustomer(message, history = [], liveContext = "") {
  return runCustomerTeam(gemini, message, history, KNOWLEDGE, liveContext);
}

async function createEscalation(customerPhone, customerMessage, ownerQuestion) {
  if (!dbReady()) throw new Error("Se necesita Supabase para guardar la consulta pendiente");
  const ticket = randomUUID().slice(0, 8).toUpperCase();
  const rows = await db("agent_escalations", {
    method: "POST",
    body: JSON.stringify({
      ticket_code: ticket,
      customer_phone: digits(customerPhone),
      customer_message: customerMessage,
      owner_question: ownerQuestion,
      status: "pending",
      deadline_at: new Date(Date.now() + ESCALATION_MS).toISOString()
    })
  });
  const row = rows[0];
  await notifyOwner(`BLACK OPS — CONSULTA PENDIENTE #${ticket}\nCliente: +${digits(customerPhone)}\nPregunta del cliente: ${customerMessage}\nNecesito que confirmes: ${ownerQuestion}\n\nResponde por este WhatsApp así: #${ticket} tu respuesta. Tienes 2 minutos antes de que el bot informe que no pudo resolverlo.`);
  return row;
}

async function processCustomerMessage(phone, message, channel = "whatsapp", history = []) {
  let decision;
  try {
    const live = await getLiveContext(message).catch(() => "No se pudo consultar la disponibilidad en vivo; no confirmes horarios.");
    decision = await answerCustomer(message, history, live);
  } catch (error) {
    console.error("Gemini error:", error.message);
    decision = { reply: "No pude confirmar esa información ahora. Voy a consultarlo con el equipo.", needs_owner: true, owner_question: "Gemini no pudo procesar la consulta. Revisa la pregunta y responde manualmente." };
  }

  if (decision.needs_owner) {
    if (channel !== "whatsapp") {
      return "Necesito confirmar ese dato con el equipo. Escríbenos por WhatsApp al 311 334 8774.";
    }
    try {
      await createEscalation(phone, message, decision.owner_question || "¿Cuál es la respuesta correcta para el cliente?");
      return decision.reply;
    } catch (error) {
      console.error("Escalation error:", error.message);
      await notifyOwner(`No pude guardar una consulta pendiente. Cliente +${digits(phone)}: ${message}`);
      return "No tengo ese dato confirmado y no pude contactar al equipo automáticamente. Escríbenos al 311 334 8774 para que te ayuden.";
    }
  }
  return decision.reply;
}

async function handleOwnerReply(phone, text) {
  if (!OWNER_PHONE || digits(phone) !== OWNER_PHONE) return false;
  const match = text.match(/^#([A-F0-9]{8})\s+([\s\S]+)/i);
  let rows;
  if (match) {
    rows = await db(`agent_escalations?ticket_code=eq.${match[1].toUpperCase()}&status=eq.pending&select=*&limit=1`);
    text = match[2].trim();
  } else {
    rows = await db("agent_escalations?status=eq.pending&select=*&order=created_at.desc&limit=1");
  }
  const ticket = rows[0];
  if (!ticket) {
    await sendWhatsApp(phone, "No encuentro una consulta pendiente. Para responder una consulta, usa el formato #CODIGO respuesta.");
    return true;
  }
  await db(`agent_escalations?id=eq.${ticket.id}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "answered", owner_answer: text, answered_at: new Date().toISOString() })
  });
  await sendWhatsApp(ticket.customer_phone, `Respuesta de Black Ops: ${text}`);
  await sendWhatsApp(phone, `La respuesta de la consulta #${ticket.ticket_code} fue enviada al cliente.`);
  return true;
}

async function checkExpiredEscalations() {
  if (!dbReady() || !waReady()) return;
  try {
    const expired = await db(`agent_escalations?status=eq.pending&deadline_at=lt.${encodeURIComponent(new Date().toISOString())}&select=*`);
    for (const item of expired) {
      const changed = await db(`agent_escalations?id=eq.${item.id}&status=eq.pending`, {
        method: "PATCH",
        body: JSON.stringify({ status: "timed_out", timed_out_at: new Date().toISOString() })
      });
      if (changed.length) {
        await sendWhatsApp(item.customer_phone, "No he recibido confirmación del equipo en estos 2 minutos y no quiero darte información incorrecta. Por favor, escríbenos directamente al 311 334 8774 para que te atiendan.");
        await notifyOwner(`La consulta #${item.ticket_code} venció sin respuesta. Cliente: +${item.customer_phone}. Pregunta: ${item.customer_message}`);
      }
    }
  } catch (error) { console.error("Error revisando consultas vencidas:", error.message); }
}

async function publicApi(payload) {
  const response = await fetch(BLACKOPS_API_URL, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    signal: AbortSignal.timeout(7000)
  });
  if (!response.ok) throw new Error("Black Ops API no disponible");
  return response.json();
}

function dateRange(message) {
  const match = message.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  const from = match?.[1] || new Date().toISOString().slice(0, 10);
  const end = new Date(from + "T12:00:00Z"); end.setUTCDate(end.getUTCDate() + 7);
  return { from, to: end.toISOString().slice(0, 10) };
}

async function getLiveContext(message) {
  if (!/precio|paquete|horario|disponib|libre|ocupad|partida abierta|cupos|cupo|fecha|reservar|reserva/i.test(message)) return "";
  const results = [];
  try {
    const config = await publicApi({ method: "GET", path: "/api/public/config" });
    results.push("CONFIGURACIÓN PÚBLICA EN VIVO: " + JSON.stringify(config));
  } catch { results.push("La consulta de configuración en vivo falló; no afirmes disponibilidad."); }
  if (/disponib|libre|ocupad|hora|fecha|reservar|reserva/i.test(message)) {
    try {
      const range = dateRange(message);
      const availability = await publicApi({ method: "GET", path: `/api/public/availability?from=${range.from}&to=${range.to}` });
      results.push("DISPONIBILIDAD EN VIVO: " + JSON.stringify(availability));
    } catch { results.push("La consulta de disponibilidad falló; no confirmes horarios libres."); }
  }
  return results.join("\n");
}

app.post("/api/chat", async (req, res) => {
  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
  if (!message || message.length > 2000) return res.status(400).json({ error: "Escribe un mensaje de máximo 2.000 caracteres." });
  const history = Array.isArray(req.body?.history) ? req.body.history.slice(-8).filter(x => x && ["user", "assistant"].includes(x.role) && typeof x.content === "string").map(x => ({ role: x.role, content: x.content.slice(0, 2000) })) : [];
  try {
    const live = await getLiveContext(message);
    const prompt = `Eres el asistente virtual de Black Ops Paintball. Responde en español, breve, sin inventar y usa solo la base y contexto en vivo. No confirmes reservas ni pagos. No pidas datos sensibles.\n\n${KNOWLEDGE}\n${live}`;
    const contents = [...history.map(x => ({ role: x.role === "assistant" ? "model" : "user", parts: [{ text: x.content }] })), { role: "user", parts: [{ text: message }] }];
    const answer = await gemini(contents, prompt);
    res.json({ answer });
  } catch (error) {
    console.error("Chat error:", error.message);
    res.status(503).json({ error: "No pude responder ahora. Escríbenos al 311 334 8774." });
  }
});

app.get("/webhooks/whatsapp", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === WA_VERIFY) return res.status(200).send(challenge);
  res.sendStatus(403);
});

app.post("/webhooks/whatsapp", async (req, res) => {
  if (!validMetaSignature(req)) return res.sendStatus(401);
  res.sendStatus(200);
  try {
    for (const entry of req.body?.entry || []) for (const change of entry.changes || []) {
      const value = change.value || {};
      for (const message of value.messages || []) {
        if (message.type !== "text") continue;
        const phone = message.from;
        const text = message.text?.body?.trim();
        if (!text) continue;
        if (OWNER_PHONE && digits(phone) === OWNER_PHONE) {
          await handleOwnerReply(phone, text);
        } else {
          const reply = await processCustomerMessage(phone, text, "whatsapp");
          await sendWhatsApp(phone, reply);
        }
      }
    }
  } catch (error) { console.error("WhatsApp webhook error:", error.message); }
});

app.get("/webhooks/instagram", (req, res) => {
  if (req.query["hub.mode"] === "subscribe" && req.query["hub.verify_token"] === WA_VERIFY) return res.status(200).send(req.query["hub.challenge"]);
  res.sendStatus(403);
});

async function sendInstagram(recipientId, text) {
  if (!IG_TOKEN || !IG_ACCOUNT_ID) throw new Error("Instagram no está configurado");
  const response = await fetch(`https://graph.facebook.com/${WA_VERSION}/${IG_ACCOUNT_ID}/messages`, {
    method: "POST", headers: { Authorization: `Bearer ${IG_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ recipient: { id: recipientId }, message: { text: String(text).slice(0, 1000) } }),
    signal: AbortSignal.timeout(15000)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "Error de Instagram");
  return data;
}

app.post("/webhooks/instagram", async (req, res) => {
  if (!validMetaSignature(req)) return res.sendStatus(401);
  res.sendStatus(200);
  try {
    for (const entry of req.body?.entry || []) for (const event of entry.messaging || []) {
      const sender = event.sender?.id;
      const text = event.message?.text?.trim();
      if (!sender || !text || event.message?.is_echo) continue;
      const reply = await processCustomerMessage(sender, text, "instagram");
      await sendInstagram(sender, reply);
    }
  } catch (error) { console.error("Instagram webhook error:", error.message); }
});

app.post("/api/agent/events", async (req, res) => {
  if (!INTERNAL_SECRET || req.get("x-agent-secret") !== INTERNAL_SECRET) return res.sendStatus(401);
  const { type, details = {} } = req.body || {};
  const allowed = ["reservation_created", "payment_reported", "payment_verified", "website_error", "low_stock", "website_update"];
  if (!allowed.includes(type)) return res.status(400).json({ error: "Tipo de evento no permitido" });
  if (type === "low_stock") {
    const category = String(details.category || "").toLowerCase();
    if (!["consumibles", "proteccion", "protección", "limpieza"].includes(category)) return res.status(400).json({ error: "Solo se notifican existencias de consumibles y elementos de protección." });
  }
  try {
    await db("agent_events", { method: "POST", body: JSON.stringify({ event_type: type, details, created_at: new Date().toISOString() }) });
    const labels = {
      reservation_created: "Nueva reserva pendiente de revisión",
      payment_reported: "Un cliente reportó un pago",
      payment_verified: "Pago verificado por el equipo",
      website_error: "Error detectado en la página web",
      low_stock: "Existencias bajas",
      website_update: "Novedad de la página web"
    };
    await notifyOwner(`BLACK OPS — ${labels[type]}\n${JSON.stringify(details).slice(0, 2500)}`);
    res.json({ ok: true });
  } catch (error) {
    console.error("Event error:", error.message);
    res.status(503).json({ error: "No se pudo guardar el evento. Configura Supabase y revisa el servidor." });
  }
});

app.post("/api/agent/instagram/ideas", async (req, res) => {
  if (!INTERNAL_SECRET || req.get("x-agent-secret") !== INTERNAL_SECRET) return res.sendStatus(401);
  try {
    const { research: ideas, review } = await runMarketingResearchTeam(gemini, "Investiga tendencias actuales de contenido y publicidad para negocios locales de experiencias y actividades al aire libre en Colombia. Propón 5 ideas concretas para Instagram de Black Ops Paintball en Támesis, Antioquia. Incluye formato, gancho, texto breve, llamada a la acción y enlaces de fuentes consultadas. Distingue tendencias observadas de recomendaciones. No inventes precios, promociones, resultados ni reseñas.", KNOWLEDGE);
    await notifyOwner("IDEAS PARA INSTAGRAM — BORRADOR PARA REVISAR\n\n" + ideas);
    res.json({ ideas, sent_to_owner: Boolean(OWNER_PHONE && waReady()) });
  } catch (error) { res.status(503).json({ error: error.message }); }
});

app.post("/api/agent/instagram/publish", async (req, res) => {
  if (!INTERNAL_SECRET || req.get("x-agent-secret") !== INTERNAL_SECRET) return res.sendStatus(401);
  res.status(501).json({ error: "La publicación automática no está habilitada. Primero se debe implementar aprobación del dueño y configurar permisos de publicación de Meta." });
});

async function monitorWebsite() {
  if (!dbReady()) return;
  try {
    const response = await fetch(WEBSITE_URL, { method: "GET", signal: AbortSignal.timeout(12000), redirect: "follow" });
    const state = response.ok ? "online" : "error";
    const previous = await db("agent_monitor_snapshots?monitor_name=eq.website&select=*&limit=1");
    const old = previous[0];
    const changed = !old || old.state !== state;
    await db("agent_monitor_snapshots?on_conflict=monitor_name", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({ monitor_name: "website", state, http_status: response.status, checked_at: new Date().toISOString() })
    });
    if (changed || !response.ok) await notifyOwner(`MONITOR WEB — ${state === "online" ? "La página volvió a responder" : "La página presenta un error"}\nURL: ${WEBSITE_URL}\nHTTP: ${response.status}`);
  } catch (error) {
    await notifyOwner(`MONITOR WEB — No pude acceder a ${WEBSITE_URL}. Error: ${error.message}`);
  }
}

async function sendDailySummary() {
  if (!dbReady() || !OWNER_PHONE) return;
  const now = new Date();
  const local = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const sent = await db(`agent_events?event_type=eq.daily_summary&details->>day=eq.${local}&select=id&limit=1`);
  if (sent.length) return;
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const events = await db(`agent_events?created_at=gte.${encodeURIComponent(since)}&select=event_type,details,created_at&order=created_at.desc&limit=50`);
  const pending = await db("agent_escalations?status=eq.pending&select=ticket_code,customer_message,deadline_at");
  const { research: ideas, review: marketingReview } = await runMarketingResearchTeam(gemini, "Investiga tendencias recientes de marketing local para negocios de experiencias al aire libre en Colombia y crea 3 ideas breves para Black Ops Paintball. Incluye enlaces a las fuentes. No inventes promociones ni precios.", KNOWLEDGE);
  const report = `RESUMEN DIARIO BLACK OPS — ${local}\nEventos de las últimas 24 horas: ${JSON.stringify(events).slice(0, 2200)}\nConsultas pendientes al dueño: ${JSON.stringify(pending).slice(0, 800)}\n\nIDEAS DE PUBLICIDAD (borradores):\n${ideas}`;
  await notifyOwner(report);
  await db("agent_events", { method: "POST", body: JSON.stringify({ event_type: "daily_summary", details: { day: local }, created_at: new Date().toISOString() }) });
}

app.get("/api/health", (_req, res) => res.json({
  status: "ok",
  integrations: { gemini: GEMINI_KEYS.length > 0, supabase: dbReady(), whatsapp: waReady(), instagram: Boolean(IG_TOKEN && IG_ACCOUNT_ID) }, agents: getAgentRoster()
}));

setInterval(() => checkExpiredEscalations().catch(e => console.error(e.message)), 15000);
setInterval(() => monitorWebsite().catch(e => console.error(e.message)), 5 * 60 * 1000);
setInterval(() => {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Bogota", hour: "2-digit", minute: "2-digit" }).format(new Date());
  if (parts === "08:00") sendDailySummary().catch(e => console.error("Resumen diario:", e.message));
}, 60 * 1000);

app.listen(PORT, () => console.log(`Black Ops AI Secretary listening on port ${PORT}`));
