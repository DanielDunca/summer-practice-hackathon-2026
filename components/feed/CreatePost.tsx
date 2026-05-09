"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Send, ChevronDown } from "lucide-react";

const SPORTS = [
  { id: "", name: "No sport tag", icon: "" },
  { id: "football",   name: "Football",   icon: "⚽" },
  { id: "basketball", name: "Basketball", icon: "🏀" },
  { id: "tennis",     name: "Tennis",     icon: "🎾" },
  { id: "volleyball", name: "Volleyball", icon: "🏐" },
  { id: "running",    name: "Running",    icon: "🏃" },
  { id: "cycling",    name: "Cycling",    icon: "🚴" },
  { id: "swimming",   name: "Swimming",   icon: "🏊" },
  { id: "badminton",  name: "Badminton",  icon: "🏸" },
  { id: "padel",      name: "Padel",      icon: "🎱" },
  { id: "hiking",     name: "Hiking",     icon: "🥾" },
];

interface Props {
  userId: string;
  avatarUrl?: string | null;
  fullName: string;
}

export default function CreatePost({ userId, avatarUrl, fullName }: Props) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [sportName, setSportName] = useState("");
  const [posting, setPosting] = useState(false);
  const [showSports, setShowSports] = useState(false);

  const initials = fullName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const remaining = 500 - content.length;
  const selectedSport = SPORTS.find(s => s.name === sportName);

  async function post() {
    if (!content.trim() || posting) return;
    setPosting(true);
    const supabase = createClient();

    let sportId: string | null = null;
    if (sportName) {
      const { data } = await (supabase as any).from("sports").select("id").eq("name", sportName).single();
      sportId = (data as any)?.id ?? null;
    }

    const { error } = await (supabase as any).from("posts").insert({
      user_id: userId,
      content: content.trim(),
      sport_id: sportId,
    });

    if (error) { toast.error(error.message); setPosting(false); return; }

    setContent("");
    setSportName("");
    setPosting(false);
    router.refresh();
  }

  return (
    <div className="bg-white rounded-2xl border border-zinc-200 p-4 flex flex-col gap-3">
      <div className="flex gap-3">
        {avatarUrl ? (
          <img src={avatarUrl} alt={fullName} className="w-9 h-9 rounded-full object-cover shrink-0" />
        ) : (
          <div className="w-9 h-9 rounded-full bg-zinc-900 flex items-center justify-center text-white text-xs font-bold shrink-0">
            {initials}
          </div>
        )}
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Share a goal, achievement, or how today's game went…"
          rows={3}
          className="flex-1 text-sm text-zinc-800 placeholder:text-zinc-400 resize-none outline-none leading-relaxed"
          onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) post(); }}
        />
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-zinc-100">
        {/* Sport picker */}
        <div className="relative">
          <button
            onClick={() => setShowSports(s => !s)}
            className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-800 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-zinc-50"
          >
            {selectedSport?.icon && <span>{selectedSport.icon}</span>}
            <span>{sportName || "Add sport"}</span>
            <ChevronDown className="w-3 h-3" />
          </button>
          {showSports && (
            <div className="absolute bottom-full left-0 mb-1 bg-white border border-zinc-200 rounded-xl shadow-lg z-10 py-1 min-w-36">
              {SPORTS.map(s => (
                <button
                  key={s.name}
                  onClick={() => { setSportName(s.name); setShowSports(false); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors"
                >
                  {s.icon && <span>{s.icon}</span>}
                  <span>{s.name || "No tag"}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {content.length > 400 && (
            <span className={`text-xs ${remaining < 0 ? "text-red-500" : "text-zinc-400"}`}>{remaining}</span>
          )}
          <button
            onClick={post}
            disabled={!content.trim() || posting || remaining < 0}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 text-white text-sm font-semibold hover:bg-zinc-800 disabled:opacity-40 transition-colors"
          >
            {posting ? "Posting…" : <><Send className="w-3.5 h-3.5" /> Post</>}
          </button>
        </div>
      </div>
    </div>
  );
}
