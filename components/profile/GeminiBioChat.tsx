"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, Send, X, Loader2 } from "lucide-react";

async function askGemini(prompt: string): Promise<string> {
  try {
    const res = await fetch("/api/gemini", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    if (!res.ok) return "";
    const data = await res.json();
    return data.text ?? "";
  } catch {
    return "";
  }
}

const QUESTIONS = [
  "What sport(s) do you play or want to play?",
  "How often do you play, and what's your skill level?",
  "What do you enjoy most about playing sports — competition, fitness, socializing, or something else?",
];

interface Props {
  onBioGenerated: (bio: string) => void;
}

type Message = { role: "ai" | "user"; text: string };

function cleanAnswer(answer: string) {
  return answer.trim().replace(/[.。]+$/, "");
}

function fallbackBio([sportsAnswer, frequencyAnswer, motivationAnswer]: string[]) {
  const sports = cleanAnswer(sportsAnswer);
  const frequency = cleanAnswer(frequencyAnswer).toLowerCase();
  const motivation = cleanAnswer(motivationAnswer).toLowerCase();

  const first = sports
    ? `I'm into ${sports} and currently building my rhythm.`
    : "I'm looking to get more active and meet people through sport.";

  const secondParts = [
    frequency ? `I play ${frequency}` : "",
    motivation ? `and I enjoy it most for ${motivation}` : "",
  ].filter(Boolean);

  const second = secondParts.length > 0
    ? `${secondParts.join(" ")}.`
    : "I'm happy to join relaxed games and improve over time.";

  return `${first} ${second}`;
}

export default function GeminiBioChat({ onBioGenerated }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "ai", text: QUESTIONS[0] },
  ]);
  const [input, setInput] = useState("");
  const [answers, setAnswers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [generatedBio, setGeneratedBio] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const questionIndex = answers.length;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");

    const newAnswers = [...answers, text];
    const newMessages: Message[] = [...messages, { role: "user", text }];
    setAnswers(newAnswers);
    setMessages(newMessages);

    if (newAnswers.length < QUESTIONS.length) {
      setMessages([...newMessages, { role: "ai", text: QUESTIONS[newAnswers.length] }]);
    } else {
      setLoading(true);
      const aiBio = await askGemini(
        `Based on these answers from a sports app user, write a short, natural-sounding sports profile bio (2-3 sentences max). Do NOT use hashtags or bullet points. Sound like a real person, not a marketing pitch.

Q: ${QUESTIONS[0]}
A: ${newAnswers[0]}

Q: ${QUESTIONS[1]}
A: ${newAnswers[1]}

Q: ${QUESTIONS[2]}
A: ${newAnswers[2]}

Write only the bio text, nothing else.`
      );
      const bio = aiBio || fallbackBio(newAnswers);

      setMessages([...newMessages, {
        role: "ai",
        text: `${aiBio ? "Here's your bio" : "Gemini is unavailable, so I drafted this from your answers"}:\n\n"${bio}"\n\nLook good?`,
      }]);
      setDone(true);
      setGeneratedBio(bio);
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-zinc-800 transition-colors"
      >
        <Sparkles className="w-4 h-4 text-orange-400" />
        Write bio with AI
      </button>
    );
  }

  return (
    <div className="rounded-2xl border-2 border-orange-100 bg-orange-50/50 p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-zinc-700">
          <Sparkles className="w-4 h-4 text-orange-400" />
          AI Bio Assistant
        </div>
        <button onClick={() => setOpen(false)} className="text-zinc-400 hover:text-zinc-600">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`text-sm px-3 py-2 rounded-xl max-w-[85%] leading-relaxed whitespace-pre-wrap ${
              msg.role === "ai"
                ? "bg-white border border-zinc-200 text-zinc-800"
                : "bg-zinc-900 text-white"
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-zinc-200 rounded-xl px-3 py-2">
              <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {!done && (
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleSend(); }}
            placeholder={`Question ${questionIndex + 1} of ${QUESTIONS.length}…`}
            className="flex-1 h-9 px-3 rounded-xl border border-zinc-200 bg-white text-sm outline-none focus:border-zinc-400 transition-colors"
            disabled={loading}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="w-9 h-9 rounded-xl bg-zinc-900 text-white flex items-center justify-center hover:bg-zinc-800 disabled:opacity-40 transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {done && (
        <button onClick={() => {
          onBioGenerated(generatedBio);
          setOpen(false);
        }}
          className="text-sm font-semibold text-orange-600 hover:text-orange-700 transition-colors self-start">
          Use this bio →
        </button>
      )}
    </div>
  );
}
