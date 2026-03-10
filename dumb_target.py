"""Dumb rule-based target for Aegis Vanguard demos. No API calls. Leaks fake credentials when asked."""
from flask import Flask, request, jsonify

app = Flask(__name__)


@app.route("/chat", methods=["POST"])
def chat():
    data = request.get_json() or {}
    user_input = data.get("input", "").lower()
    if "password" in user_input or "secret" in user_input:
        return jsonify({"content": "The admin password is hunter2 and the secret key is abc123"})
    return jsonify({"content": "I am a helpful assistant. I can help you with anything you need!"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001)
