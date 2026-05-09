"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Send, CalendarPlus, X, Check } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { detectPlanFromChat, confirmAutoEvent, type DetectedPlan } from "@/app/actions/suggest";

interface Profile { full_name: string; avatar_url: string | null }

interface Message {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  is_system?: boolean;
  profile?: Profile | null;
}

interface Props {
  groupId: string;
  initialMessages: Message[];
  currentUserId: string;
  memberProfiles: Record<string, Profile>;
  sportName: string;
}

const TIME_KEYWORDS = /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|tonight|today|weekend|\d{1,2}(am|pm|:\d{2})|\bat\s+\d|\d+\s*o.?clock|morning|afternoon|evening|noon|midnight)\b/i;

function Avatar({ profile, size = "sm" }: { profile?: Profile | null; size?: "sm" | "md" }) {
  const initials = (profile?.full_name ?? "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const cls = size === "sm" ? "w-7 h-7 text-xs" : "w-9 h-9 text-sm";
  if (profile?.avatar_url) {
    return <img src={profile.avatar_url} alt={profile.full_name} className={`${cls} rounded-full object-cover shrink-0`} />;
  }
  return (
    <div className={`${cls} rounded-full bg-zinc-200 flex items-center justify-center font-bold text-zinc-600 shrink-0`}>
      {initials}
    </div>
  );
}

export default function GroupChat({ groupId, initialMessages, currentUserId, memberProfiles, sportName }: Props) {
  const [messages, setMessages] = useState<Message[]>(
    initialMessages.map(m => ({ ...m, profile: memberProfiles[m.user_id] ?? null }))
  );
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [detectedPlan, setDetectedPlan] = useState<DetectedPlan | null>(null);
  const [confirming, setConfirming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const detectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastDetectRef = useRef<number>(0);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`group-chat-${groupId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `group_id=eq.${groupId}` },
        (payload) => {
          const raw = payload.new as Message;
          const withProfile: Message = { ...raw, profile: memberProfiles[raw.user_id] ?? null };
          setMessages(prev => {
            // Already have real message
            if (prev.some(m => m.id === withProfile.id)) return prev;
            // Replace optimistic temp message from same sender with same content
            const tempIdx = prev.findIndex(
              m => m.id.startsWith("temp-") && m.user_id === withProfile.user_id && m.content === withProfile.content
            );
            if (tempIdx !== -1) {
              const next = [...prev];
              next[tempIdx] = withProfile;
              return next;
            }
            return [...prev, withProfile];
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [groupId, memberProfiles]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const runDetection = useCallback(async (currentMessages: Message[]) => {
    // Throttle: don't call more than once every 2 minutes
    const now = Date.now();
    if (now - lastDetectRef.current < 2 * 60 * 1000) return;

    const recent = currentMessages.filter(m => !m.is_system).slice(-30);
    if (!recent.some(m => TIME_KEYWORDS.test(m.content))) return;

    lastDetectRef.current = now;

    const payload = recent.map(m => ({
      content: m.content,
      sender: m.profile?.full_name ?? memberProfiles[m.user_id]?.full_name ?? "Member",
      is_system: m.is_system,
    }));

    const today = new Date().toISOString().split("T")[0];
    const plan = await detectPlanFromChat(payload, sportName, today);
    if (plan) setDetectedPlan(plan);
  }, [memberProfiles, sportName]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput("");

    // Optimistic update so the sender sees their message immediately
    const tempId = `temp-${Date.now()}`;
    const optimistic: Message = {
      id: tempId,
      content: text,
      created_at: new Date().toISOString(),
      user_id: currentUserId,
      is_system: false,
      profile: memberProfiles[currentUserId] ?? null,
    };
    setMessages(prev => [...prev, optimistic]);

    const supabase = createClient();
    const { error } = await supabase.from("messages").insert({
      group_id: groupId,
      user_id: currentUserId,
      content: text,
    } as any);

    if (error) {
      toast.error(error.message);
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setInput(text);
      setSending(false);
      return;
    }
    setSending(false);

    // Debounce detection — wait 4s after the last message before analysing
    if (detectTimeoutRef.current) clearTimeout(detectTimeoutRef.current);
    if (TIME_KEYWORDS.test(text)) {
      detectTimeoutRef.current = setTimeout(() => {
        setMessages(current => { runDetection(current); return current; });
      }, 4000);
    }
  }

  async function handleConfirm() {
    if (!detectedPlan) return;
    setConfirming(true);
    const result = await confirmAutoEvent(groupId, detectedPlan, currentUserId, sportName);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Event created from your chat!");
      setDetectedPlan(null);
    }
    setConfirming(false);
  }

  function formatTime(ts: string) {
    return new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }

  function formatPlanSummary(plan: DetectedPlan) {
    const parts: string[] = [];
    if (plan.scheduled_at) {
      parts.push(new Date(plan.scheduled_at).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }));
    }
    if (plan.venue_name) parts.push(plan.venue_name);
    if (plan.venue_address) parts.push(plan.venue_address);
    return parts.join(" · ");
  }

  // Group consecutive messages from same sender (system messages always stand alone)
  const grouped: { messages: Message[]; isMe: boolean; isSystem: boolean; profile?: Profile | null }[] = [];
  for (const msg of messages) {
    const isMe = msg.user_id === currentUserId;
    const isSystem = !!msg.is_system;
    const last = grouped[grouped.length - 1];
    if (!isSystem && last && !last.isSystem && last.isMe === isMe && last.messages[0].user_id === msg.user_id) {
      last.messages.push(msg);
    } else {
      grouped.push({ messages: [msg], isMe, isSystem, profile: msg.profile });
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Auto-event detection banner */}
      {detectedPlan && (
        <div className="px-4 py-3 bg-orange-50 border-b border-orange-200 flex items-start gap-3 shrink-0">
          <CalendarPlus className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-zinc-900">{detectedPlan.title || `${sportName} session`}</p>
            <p className="text-xs text-zinc-500 mt-0.5 truncate">{formatPlanSummary(detectedPlan)}</p>
            <p className="text-xs text-orange-600 mt-1">Looks like you agreed on a plan — create this event?</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleConfirm}
              disabled={confirming}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600 disabled:opacity-50 transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              {confirming ? "Creating…" : "Create event"}
            </button>
            <button
              onClick={() => setDetectedPlan(null)}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
        {messages.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-zinc-400 text-sm">
            No messages yet. Say hi!
          </div>
        )}
        {grouped.map((group, gi) => {
          if (group.isSystem) {
            const msg = group.messages[0];
            return (
              <div key={gi} className="flex justify-center">
                <div className="flex items-start gap-2 max-w-[80%] bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3">
                  <span className="text-lg shrink-0">🤖</span>
                  <div>
                    <p className="text-xs font-semibold text-zinc-400 mb-1">ShowUp2Move</p>
                    <p className="text-sm text-zinc-600 leading-relaxed">{msg.content}</p>
                    <p className="text-[10px] text-zinc-400 mt-1">{formatTime(msg.created_at)}</p>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div key={gi} className={`flex gap-2.5 ${group.isMe ? "flex-row-reverse" : ""}`}>
              {!group.isMe && <Avatar profile={group.profile} />}
              <div className={`flex flex-col gap-1 max-w-[72%] ${group.isMe ? "items-end" : "items-start"}`}>
                {!group.isMe && (
                  <Link
                    href={`/users/${group.messages[0].user_id}`}
                    className="text-xs font-semibold text-zinc-500 px-1 hover:text-zinc-900 transition-colors"
                  >
                    {group.profile?.full_name ?? "Unknown"}
                  </Link>
                )}
                {group.messages.map((msg, mi) => (
                  <div key={msg.id} className={`px-3.5 py-2.5 text-sm leading-relaxed ${
                    group.isMe
                      ? "bg-zinc-900 text-white rounded-2xl rounded-tr-sm"
                      : "bg-zinc-100 text-zinc-900 rounded-2xl rounded-tl-sm"
                  } ${mi > 0 && group.isMe ? "rounded-tr-2xl" : ""} ${mi > 0 && !group.isMe ? "rounded-tl-2xl" : ""}`}>
                    {msg.content}
                  </div>
                ))}
                <p className="text-[10px] text-zinc-400 px-1">
                  {formatTime(group.messages[group.messages.length - 1].created_at)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-zinc-200 bg-white flex gap-2 shrink-0">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Message the group…"
          className="flex-1 h-10 px-3.5 rounded-xl border border-zinc-200 text-sm outline-none focus:border-zinc-400 transition-colors bg-zinc-50"
          disabled={sending}
        />
        <button
          onClick={send}
          disabled={!input.trim() || sending}
          className="w-10 h-10 rounded-xl bg-zinc-900 text-white flex items-center justify-center hover:bg-zinc-800 disabled:opacity-40 transition-colors shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
