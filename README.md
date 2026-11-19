# Black Ops — Secretario de IA

Agente de apoyo administrativo para Black Ops Paintball. Usa Gemini, WhatsApp Cloud API, Instagram Messaging (si se habilita) y Supabase.

## Funciones implementadas en el servidor
- Chat web con Gemini y base de conocimiento del negocio.
- Webhook de WhatsApp para recibir mensajes y responder clientes.
- Escalamiento al dueño por WhatsApp cuando falta información.
- Ventana de 2 minutos: si el dueño responde con `#CODIGO respuesta`, el agente transmite la respuesta al cliente. Si vence el plazo, el cliente recibe un aviso honesto y el caso queda marcado como vencido.
- Webhook de mensajes directos de Instagram con respuesta asistida por Gemini.
- Endpoint protegido para recibir eventos del sitio: reservas nuevas, pagos reportados/verificados, errores web, novedades y existencias bajas de consumibles/protección.
- Borradores de ideas para Instagram enviados al dueño.
- Monitor HTTP básico de la página y resumen diario a las 8:00 a. m. hora Colombia.
- Dos claves Gemini opcionales: la segunda se usa si falla la primera.

## Configuración
1. Node.js 20 o superior.
2. En Render: Build `npm install`, Start `npm start`.
3. Configura las variables de `.env.example` en el entorno del servidor. Nunca subas claves reales al repositorio.
4. Ejecuta `supabase/migrations/001_agent_secretary.sql` en el SQL Editor del proyecto Supabase.
5. Configura el webhook de WhatsApp en Meta con:
   - Callback: `https://TU-DOMINIO/webhooks/whatsapp`
   - Verify token: el mismo valor de `WHATSAPP_VERIFY_TOKEN`
   - Suscribe el campo `messages`.
6. Configura el webhook de Instagram en Meta:
   - Callback: `https://TU-DOMINIO/webhooks/instagram`
   - Usa el mismo verify token.
   - Activa los eventos de mensajes que estén disponibles para tu app y cuenta.
7. El dueño debe autorizar los activos de Meta y los permisos correspondientes. La cuenta de Instagram debe ser profesional y cumplir los requisitos vigentes de Meta.
8. Define `OWNER_WHATSAPP_NUMBER` con código de país, por ejemplo 57 seguido del número, sin + ni espacios.

## Respuesta del dueño a una consulta
El agente envía un código de 8 caracteres. El dueño responde en el chat de WhatsApp del negocio:
`#A1B2C3D4 La respuesta que debe recibir el cliente`
El código real aparecerá en la notificación.

## Conectar la página web
La web debe llamar a `POST /api/agent/events` al producirse cada evento, enviando el encabezado `x-agent-secret` y un JSON:
`{ "type": "reservation_created", "details": { "reservation_code": "..." } }`
Tipos permitidos: `reservation_created`, `payment_reported`, `payment_verified`, `website_error`, `website_update`, `low_stock`.
Para existencias bajas solo se aceptan categorías de consumibles, protección o limpieza. No enviar datos privados de clientes ni credenciales.

## Ideas de Instagram
Llama a `POST /api/agent/instagram/ideas` con `x-agent-secret`. El agente genera borradores y se los manda al dueño. La publicación automática está deshabilitada hasta construir un flujo de aprobación y completar los permisos de Meta.

## Limitaciones que debes conocer
- Gemini no puede leer por sí solo Instagram ni vigilar toda la web. Los webhooks y eventos del backend aportan esos datos.
- El monitor web comprueba disponibilidad HTTP; no sustituye pruebas funcionales de reservas, pagos o formularios.
- Las notificaciones proactivas por WhatsApp pueden requerir plantillas aprobadas por Meta fuera de la ventana de atención. Revisa la configuración y facturación de WhatsApp Business Platform.
- El servidor debe permanecer encendido para procesar eventos y plazos. El almacenamiento de consultas usa Supabase para sobrevivir reinicios.
- La respuesta al cliente tras dos minutos depende de que el webhook y Supabase estén configurados y operativos.
- El agente no confirma pagos ni reservas, no inventa datos y no ejecuta acciones administrativas delicadas sin aprobación humana.
