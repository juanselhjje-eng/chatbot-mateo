const ROLES = {
  orchestrator: {
    name: "Orquestador",
    mission: "Coordinar subagentes, dividir tareas y decidir el orden. No inventar datos ni ejecutar cambios sensibles."
  },
  reviewer: {
    name: "Revisor de calidad",
    mission: "Verificar exactitud, coherencia, datos disponibles, tono y riesgos. Rechazar afirmaciones no respaldadas."
  },
  webResearcher: {
    name: "Investigador web",
    mission: "Investigar tendencias, competidores y oportunidades de publicidad con búsqueda web. Diferenciar hechos, fuentes e ideas."
  },
  whatsapp: {
    name: "Atención al cliente por WhatsApp",
    mission: "Entender preguntas, responder con la base de conocimiento y datos operativos. Escalar dudas en vez de inventar."
  },
  ownerSecretary: {
    name: "Secretario del dueño",
    mission: "Redactar avisos claros y priorizados sobre reservas, pagos reportados, errores, preguntas, agenda, investigación e ideas."
  },
  websiteCalendar: {
    name: "Supervisor de página y agenda",
    mission: "Revisar disponibilidad HTTP, eventos del sitio y agenda cuando exista una fuente autorizada. No asumir que un horario está libre sin consultarlo."
  },
  auditor: {
    name: "Auditor general",
    mission: "Revisar eventos y resultados de todos los agentes, detectar omisiones, fallos repetidos y tareas pendientes; producir informe para el dueño."
  }
};

function rolePrompt(role, context = "") {
  const selected = ROLES[role];
  if (!selected) throw new Error("Subagente desconocido");
  return [
    "Eres un subagente especializado del sistema Black Ops Paintball.",
    "Negocio ubicado en Támesis, Antioquia. Responde en español.",
    "Tu identidad: " + selected.name + ".",
    "Tu misión: " + selected.mission,
    "Reglas: no inventes hechos, precios, horarios, reservas, pagos, stock, fuentes ni resultados. Señala claramente lo que no puedes verificar. Protege los datos de clientes. No publiques ni cambies información sensible sin aprobación del dueño.",
    context ? "CONTEXTO DE TRABAJO:\n" + context : ""
  ].filter(Boolean).join("\n\n");
}

export async function runSubagent(gemini, role, task, context = "", options = {}) {
  const prompt = rolePrompt(role, context);
  const contents = [{ role: "user", parts: [{ text: String(task).slice(0, 12000) }] }];
  return gemini(contents, prompt, Boolean(options.json), Boolean(options.search));
}

export async function runCustomerTeam(gemini, message, history, businessKnowledge, liveContext) {
  const routing = await runSubagent(
    gemini,
    "orchestrator",
    "Clasifica la consulta y elige especialista. Devuelve SOLO JSON: { \"specialist\": \"whatsapp\", \"needs_owner\": boolean, \"reason\": \"...\" }. Si falta información del negocio, needs_owner=true. Consulta: " + message,
    businessKnowledge + "\nDATOS OPERATIVOS:\n" + liveContext,
    { json: true }
  );

  let route;
  try { route = JSON.parse(routing.replace(/^```json\s*/i, "").replace(/```$/, "").trim()); }
  catch { route = { specialist: "whatsapp", needs_owner: true, reason: "No se pudo clasificar la consulta con seguridad." }; }

  const customerTask = [
    "Responde a este cliente de forma breve y útil.",
    "Historial reciente: " + JSON.stringify((history || []).slice(-8)),
    "Mensaje actual: " + message,
    "Devuelve SOLO JSON: {\"reply\":\"...\",\"needs_owner\":false,\"owner_question\":\"\"}.",
    "Si falta un dato o no entiendes, needs_owner=true y formula una pregunta concreta para el dueño."
  ].join("\n");

  let raw = await runSubagent(
    gemini,
    "whatsapp",
    customerTask,
    businessKnowledge + "\nDATOS OPERATIVOS:\n" + liveContext,
    { json: true }
  );

  const review = await runSubagent(
    gemini,
    "reviewer",
    "Revisa la respuesta propuesta para el cliente. Comprueba que no invente datos, no confirme reservas ni pagos y no prometa acciones no realizadas. Si no es segura, corrígela y escala al dueño. Devuelve SOLO JSON: {\"reply\":\"...\",\"needs_owner\":false,\"owner_question\":\"\",\"review\":\"approved|corrected|escalate\"}.",
    "Pregunta del cliente: " + message + "\nRespuesta propuesta: " + raw + "\nBase: " + businessKnowledge + "\nDatos en vivo: " + liveContext,
    { json: true }
  );

  try {
    const parsed = JSON.parse(review.replace(/^```json\s*/i, "").replace(/```$/, "").trim());
    return {
      reply: String(parsed.reply || "Voy a confirmar ese dato con el equipo y te respondo."),
      needs_owner: Boolean(parsed.needs_owner || route.needs_owner),
      owner_question: String(parsed.owner_question || route.reason || ""),
      reviewed: true
    };
  } catch {
    return {
      reply: "No pude verificar la respuesta. Voy a consultar al equipo para no darte información incorrecta.",
      needs_owner: true,
      owner_question: "El revisor no pudo validar la respuesta de esta consulta.",
      reviewed: false
    };
  }
}

export async function runMarketingResearchTeam(gemini, task, businessContext = "") {
  const research = await runSubagent(
    gemini,
    "webResearcher",
    task,
    businessContext,
    { search: true }
  );
  const reviewed = await runSubagent(
    gemini,
    "reviewer",
    "Comprueba que las tendencias y afirmaciones estén respaldadas por fuentes citadas, que no haya datos inventados y que las recomendaciones estén separadas de los hechos. Si faltan fuentes, dilo. No inventes enlaces.",
    research,
    {}
  );
  return { research, review: reviewed };
}

export async function runOwnerSecretary(gemini, event, details, recentContext = "") {
  return runSubagent(
    gemini,
    "ownerSecretary",
    "Redacta una notificación WhatsApp para el dueño. Prioriza qué pasó, impacto, qué necesita decidir y siguiente paso. Evento: " + event + ". Detalles: " + JSON.stringify(details),
    recentContext
  );
}

export async function runGeneralAudit(gemini, events, pendingQuestions, monitorStatus) {
  const audit = await runSubagent(
    gemini,
    "auditor",
    "Audita el funcionamiento reciente de los subagentes. Identifica incidentes, tareas sin resolver, patrones, riesgos y acciones recomendadas. No declares resuelto algo que siga pendiente. Devuelve un informe corto con prioridades.",
    "EVENTOS: " + JSON.stringify(events).slice(0, 9000) +
    "\nCONSULTAS PENDIENTES: " + JSON.stringify(pendingQuestions).slice(0, 3000) +
    "\nESTADO DE MONITOREO: " + JSON.stringify(monitorStatus).slice(0, 3000)
  );
  const reviewed = await runSubagent(gemini, "reviewer", "Revisa este informe de auditoría para evitar conclusiones no demostradas. Señala cualquier afirmación que no se sostenga con los datos.", audit);
  return { audit, review: reviewed };
}

export function getAgentRoster() {
  return Object.entries(ROLES).map(([id, agent]) => ({ id, name: agent.name, mission: agent.mission }));
}
