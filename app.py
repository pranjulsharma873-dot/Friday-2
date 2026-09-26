import os
import json
from flask import Flask, request, jsonify
from flask_cors import CORS
from openai import OpenAI

from plugins import PLUGIN_TOOLS, PLUGIN_FUNCTIONS, PLUGIN_INFO

# ============================
# SETUP
# ============================

app = Flask(__name__)
CORS(app)  # Allows your GitHub Pages frontend to call this backend

# Read the API key from an environment variable (never hardcode it in code)
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

MODEL = "gpt-4o-mini"   # fast + inexpensive; use "gpt-4o" for higher quality
MAX_TOOL_ITERATIONS = 3

# System prompt defines FRIDAY's personality
SYSTEM_PROMPT = (
    "You are FRIDAY, a helpful, friendly voice assistant. "
    "Keep answers concise and conversational, since replies "
    "are also spoken aloud to the user. Use the available tools "
    "when they would give a more accurate or up-to-date answer."
)

# In-memory conversation history (resets when server restarts).
# Keyed by a simple session id sent from the frontend.
conversations = {}


# ============================
# HELPERS
# ============================

def run_chat(history):
    """Calls the model and automatically runs any plugin/tool calls it makes,
    looping until it gives a final text answer (or MAX_TOOL_ITERATIONS is hit)."""
    for _ in range(MAX_TOOL_ITERATIONS):
        response = client.chat.completions.create(
            model=MODEL,
            messages=history,
            tools=PLUGIN_TOOLS,
            max_tokens=300,
        )
        msg = response.choices[0].message

        if not msg.tool_calls:
            reply_text = (msg.content or "").strip()
            history.append({"role": "assistant", "content": reply_text})
            return reply_text, history

        # Model wants to use one or more plugins first
        history.append({
            "role": "assistant",
            "content": msg.content,
            "tool_calls": [tc.model_dump() for tc in msg.tool_calls],
        })
        for tc in msg.tool_calls:
            fn = PLUGIN_FUNCTIONS.get(tc.function.name)
            try:
                args = json.loads(tc.function.arguments or "{}")
                result = fn(**args) if fn else f"Unknown plugin: {tc.function.name}"
            except Exception as e:
                result = f"Plugin error: {e}"
            history.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "content": str(result),
            })

    return "Sorry, that took too many steps - try rephrasing.", history


def trim_history(history):
    if len(history) > 21:
        return [history[0]] + history[-20:]
    return history


# ============================
# ROUTES
# ============================

@app.route("/", methods=["GET"])
def health_check():
    return jsonify({"status": "FRIDAY AI backend is running"})


@app.route("/plugins", methods=["GET"])
def list_plugins():
    return jsonify({"plugins": PLUGIN_INFO})


@app.route("/chat", methods=["POST"])
def chat():
    data = request.get_json(silent=True) or {}

    user_message = data.get("message", "").strip()
    session_id = data.get("session_id", "default")

    if not user_message:
        return jsonify({"error": "No message provided"}), 400

    history = conversations.get(session_id, [
        {"role": "system", "content": SYSTEM_PROMPT}
    ])
    history.append({"role": "user", "content": user_message})

    try:
        reply_text, history = run_chat(history)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    conversations[session_id] = trim_history(history)

    return jsonify({"reply": reply_text})


@app.route("/vision", methods=["POST"])
def vision():
    data = request.get_json(silent=True) or {}

    image_base64 = data.get("image", "")
    question = data.get("message", "").strip() or "What do you see in this image? Describe it briefly."
    session_id = data.get("session_id", "default")

    if not image_base64:
        return jsonify({"error": "No image provided"}), 400

    history = conversations.get(session_id, [
        {"role": "system", "content": SYSTEM_PROMPT}
    ])
    history.append({
        "role": "user",
        "content": [
            {"type": "text", "text": question},
            {
                "type": "image_url",
                "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"}
            }
        ]
    })

    try:
        response = client.chat.completions.create(
            model=MODEL,  # gpt-4o-mini supports vision too
            messages=history,
            max_tokens=300,
        )
        reply_text = response.choices[0].message.content.strip()
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    history.append({"role": "assistant", "content": reply_text})
    conversations[session_id] = trim_history(history)

    return jsonify({"reply": reply_text})


@app.route("/reset", methods=["POST"])
def reset():
    data = request.get_json(silent=True) or {}
    session_id = data.get("session_id", "default")
    conversations.pop(session_id, None)
    return jsonify({"status": "conversation reset"})


# ============================
# ENTRY POINT
# ============================

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
