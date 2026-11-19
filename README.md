# Chatbot de Black Ops Paintball

Chatbot web en español basado en el documento **Black Ops Paintball — Base de conocimiento para el chatbot** (18 de noviembre de 2026).

## Funciones

- Interfaz adaptable a celular y computador.
- Respuestas breves en español, con reglas estrictas para no inventar información.
- Consulta desde el servidor de la configuración pública y disponibilidad de Black Ops.
- API de IA compatible con OpenAI; se puede usar OpenRouter u otro proveedor compatible.
- La clave de IA se guarda como variable de entorno y nunca se expone al navegador.
- Limitación básica de solicitudes y validación de mensajes.

## Requisitos

- Node.js 20 o superior.
- Una clave de un proveedor de IA compatible con la API de Chat Completions.

## Configuración local

1. Clona el repositorio.
2. Instala dependencias:

   ```bash
   npm install
   ```

3. Copia `.env.example` a `.env` y configura:

   ```env
   PORT=3000
   AI_API_KEY=tu_clave
   AI_BASE_URL=https://openrouter.ai/api/v1
   AI_MODEL=openrouter/free
   BLACKOPS_API_URL=https://yxldniscfjmzuvikgwaf.supabase.co/functions/v1/api
   ```

4. Inicia:

   ```bash
   npm start
   ```

5. Abre http://localhost:3000.

## Despliegue en Render

- Crear un servicio **Web Service** conectado a este repositorio.
- Runtime: Node.
- Build Command: `npm install`.
- Start Command: `npm start`.
- Agregar las variables `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL` y, opcionalmente, `BLACKOPS_API_URL`.
- No subir el archivo `.env` ni pegar claves en el código.

## Integración de datos en vivo

El servidor hace solicitudes POST a la función pública Supabase con `Content-Type: application/json`:

- Configuración: `{"method":"GET","path":"/api/public/config"}`
- Disponibilidad: `{"method":"GET","path":"/api/public/availability?from=AAAA-MM-DD&to=AAAA-MM-DD"}`

Estas consultas son de solo lectura. El chatbot no crea, modifica ni elimina reservas y no puede verificar pagos.

## Límites importantes

El bot nunca debe confirmar una reserva ni un pago, aceptar claves o contraseñas, ni revelar datos de otros clientes. Para información no incluida en la base de conocimiento, atención humana, lesiones, emergencias o quejas serias, debe remitir al WhatsApp **311 334 8774** y al apartado PQRS cuando corresponda.

La información de dirección exacta, edad mínima, política completa de reembolsos, inasistencias, correo, redes y servicios extra no está confirmada: el bot debe pedir al cliente que consulte por WhatsApp.
