"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Bell } from "lucide-react";
import { markNotificationsRead } from "@/app/actions/events";
import Link from "next/link";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
}

interface Props {
  initialUnread: number;
  userId: string;
}

export default function NotificationBell({ initialUnread, userId }: Props) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(initialUnread);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Realtime subscription for new notifications
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("notifications-bell")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${userId}`,
      }, payload => {
        setUnread(n => n + 1);
        setNotifications(prev => [payload.new as Notification, ...prev]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  async function openPanel() {
    if (!loaded) {
      const supabase = createClient();
      const { data } = await (supabase as any)
        .from("notifications")
        .select("id, type, title, body, link, read, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);
      setNotifications((data ?? []) as Notification[]);
      setLoaded(true);
    }
    setOpen(true);
    if (unread > 0) {
      setUnread(0);
      await markNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={open ? () => setOpen(false) : openPanel}
        className="relative flex items-center justify-center w-8 h-8 rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-orange-500 text-white text-[9px] font-bold flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute bottom-10 left-0 w-72 bg-white rounded-xl border border-zinc-200 shadow-lg z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-100">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Notifications</p>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-sm text-center text-zinc-400">No notifications yet</p>
            ) : (
              notifications.map(n => {
                const inner = (
                  <div className={`px-4 py-3 border-b border-zinc-50 hover:bg-zinc-50 transition-colors ${!n.read ? "bg-orange-50/40" : ""}`}>
                    <p className="text-sm font-medium text-zinc-900">{n.title}</p>
                    {n.body && <p className="text-xs text-zinc-500 mt-0.5">{n.body}</p>}
                    <p className="text-[10px] text-zinc-400 mt-1">
                      {new Date(n.created_at).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}
                    </p>
                  </div>
                );
                return n.link ? (
                  <Link key={n.id} href={n.link} onClick={() => setOpen(false)}>{inner}</Link>
                ) : (
                  <div key={n.id}>{inner}</div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
