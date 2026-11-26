"""Opening-line rules shared by channel-formula (measuring a channel) and formula-script (checking a new script),
so a script is classified exactly like the channel it is written for. Stdlib only."""
import re

BANNED_OPENERS = ["did you know", "in this video", "in today's video", "today we", "today i", "let's talk about",
                  "hey", "hi ", "hi,", "hello", "welcome", "what's up", "whats up", "what is up", "greetings"]


def hook_type(first: str) -> str:
    s = first.lower().strip().lstrip("\"'“‘")   # curly quotes too
    rules = [
        (r"^if (you|you're|you've)\b", "if_you_hypothetical"),
        (r"^if\b", "if_hypothetical_other"),           # "If everyone…", "If Alcatraz had…"
        (r"^(what|what would happen) if\b", "what_if"),
        (r"^(have|did) you ever\b", "have_you_ever"),
        (r"^(imagine|picture)\b", "imagine"),
        (r"^when(ever)? you\b", "when_you"),
        (r"^when(ever)?\b", "when_a_explainer"),       # "When a doctor gives you a shot…"
        (r"^(this|these|that) (is|are|was|were|guy|man|woman|person|kid)\b", "this_is_reveal"),
        (r"^(meet|here'?s|here is)\b", "this_is_reveal"),
        (r"^(look at|watch|keep|take|try|put|place|hold)\b", "command"),
        (r"^(did you know|you probably|most people)\b", "did_you_know"),
        (r"^(how|why|what|where|who|can|could|is|are|do|does)\b.*\?", "question"),
        # starts on a concrete action in progress: "A red hot iron is pushed…", "He pulled…", "They opened…"
        (r"^(a|an|the|he|she|they|it|his|her|one)\b", "in_medias_res"),
    ]
    for pat, name in rules:
        if re.search(pat, s):
            return name
    if "?" in s:
        return "question"
    return "other"
