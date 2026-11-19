const form = document.querySelector("#chat-form");
const input = document.querySelector("#message-input");
const sendButton = document.querySelector("#send-button");
const messages = document.querySelector("#messages");
const suggestions = document.querySelector("#suggestions");

function addMessage(text, role) {
  const row = document.createElement("div");
  row.className = "message " + role;
  if (role === "bot") {
    const avatar = document.createElement("span");
    avatar.className = "avatar";
    avatar.textContent = "BO";
    row.append(avatar);
  }
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;
  row.append(bubble);
  messages.append(row);
  messages.scrollTop = messages.scrollHeight;
  return row;
}

async function sendMessage(text) {
  const clean = text.trim();
  if (!clean || sendButton.disabled) return;
  addMessage(clean, "user");
  input.value = "";
  sendButton.disabled = true;
  const pending = addMessage("Escribiendo...", "bot");
  pending.querySelector(".bubble").classList.add("typing");
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: clean })
    });
    const data = await response.json();
    pending.remove();
    addMessage(response.ok ? data.answer : (data.error || "No pude responder. Escríbenos al 311 334 8774."), "bot");
  } catch {
    pending.remove();
    addMessage("No pude conectar ahora. Inténtalo más tarde o escríbenos al 311 334 8774.", "bot");
  } finally {
    sendButton.disabled = false;
    input.focus();
  }
}

form.addEventListener("submit", event => {
  event.preventDefault();
  sendMessage(input.value);
});
suggestions.addEventListener("click", event => {
  if (event.target.matches("button")) sendMessage(event.target.textContent);
});
