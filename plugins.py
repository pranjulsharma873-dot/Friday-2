"""
FRIDAY AI - Plugins
====================
Ek plugin ke 2 parts hote hain:
  1. Ek "tool" schema (OpenAI function-calling format) - ye AI ko batata
     hai ki plugin kya karta hai aur kaunse arguments leta hai.
  2. Ek Python function - jo asal mein kaam karta hai.

NAYA plugin add karna hai (Gmail, WhatsApp, Calendar, koi bhi app se
connect karna hai)?
  1. Us app ki API key / OAuth credentials lo.
  2. Neeche jaisa ek function likho jo us app ki API ko call kare.
  3. Uska schema PLUGIN_TOOLS list mein add karo.
  4. Usko PLUGIN_FUNCTIONS dict mein map karo.
  5. PLUGIN_INFO mein ek line add karo (Plugins menu mein dikhega).
Bas — FRIDAY khud decide karega ki kab use karna hai.
"""

import ast
import operator
import datetime
import os
import requests

# ---------- Plugin: Calculator (koi external key nahi chahiye) ----------
_ALLOWED_OPS = {
    ast.Add: operator.add, ast.Sub: operator.sub,
    ast.Mult: operator.mul, ast.Div: operator.truediv,
    ast.Pow: operator.pow, ast.USub: operator.neg,
    ast.Mod: operator.mod,
}


def _safe_eval(node):
    if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
        return node.value
    if isinstance(node, ast.BinOp) and type(node.op) in _ALLOWED_OPS:
        return _ALLOWED_OPS[type(node.op)](_safe_eval(node.left), _safe_eval(node.right))
    if isinstance(node, ast.UnaryOp) and type(node.op) in _ALLOWED_OPS:
        return _ALLOWED_OPS[type(node.op)](_safe_eval(node.operand))
    raise ValueError("Unsupported expression")


def calculate(expression: str) -> str:
    """Safely evaluates a math expression like '12*7+3'."""
    try:
        tree = ast.parse(expression, mode="eval")
        return str(_safe_eval(tree.body))
    except Exception:
        return "Sorry, I couldn't calculate that."


# ---------- Plugin: Current time (koi external key nahi chahiye) ----------
def get_current_time(timezone: str = "Asia/Kolkata") -> str:
    try:
        from zoneinfo import ZoneInfo
        now = datetime.datetime.now(ZoneInfo(timezone))
    except Exception:
        now = datetime.datetime.utcnow()
        timezone = "UTC"
    return now.strftime("%A, %d %B %Y, %I:%M %p") + f" ({timezone})"


# ---------- Plugin: Web search (SERPAPI_KEY env var chahiye) ----------
def web_search(query: str) -> str:
    api_key = os.environ.get("SERPAPI_KEY")
    if not api_key:
        return "Web search plugin abhi configure nahi hai (SERPAPI_KEY environment variable missing)."
    try:
        r = requests.get(
            "https://serpapi.com/search",
            params={"q": query, "api_key": api_key, "num": 3},
            timeout=10,
        )
        results = r.json().get("organic_results", [])[:3]
        if not results:
            return "Koi result nahi mila."
        return "\n".join(f"- {x.get('title')}: {x.get('snippet', '')}" for x in results)
    except Exception as e:
        return f"Search fail ho gayi: {e}"


# ---------- Registry: yahan naye plugins add karo ----------
PLUGIN_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "calculate",
            "description": "Evaluate a math expression, e.g. '12*7+3'",
            "parameters": {
                "type": "object",
                "properties": {"expression": {"type": "string"}},
                "required": ["expression"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_current_time",
            "description": "Get the current date and time",
            "parameters": {
                "type": "object",
                "properties": {
                    "timezone": {"type": "string", "description": "e.g. Asia/Kolkata"}
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "web_search",
            "description": "Search the web for current information",
            "parameters": {
                "type": "object",
                "properties": {"query": {"type": "string"}},
                "required": ["query"],
            },
        },
    },
]

PLUGIN_FUNCTIONS = {
    "calculate": calculate,
    "get_current_time": get_current_time,
    "web_search": web_search,
}

PLUGIN_INFO = [
    {"name": "Calculator", "description": "Math expressions solve karta hai"},
    {"name": "Clock", "description": "Current date & time batata hai"},
    {"name": "Web Search", "description": "Web se current info laata hai (SERPAPI_KEY chahiye)"},
]
