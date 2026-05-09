"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { House, Zap, Users, CalendarDays, LogOut, Newspaper } from "lucide-react";
import NotificationBell from "./NotificationBell";

const nav = [
  { href: "/home",   label: "Home",           icon: House },
  { href: "/feed",   label: "Feed",            icon: Newspaper },
  { href: "/match",  label: "Show Up Today?", icon: Zap },
  { href: "/groups", label: "My Groups",       icon: Users },
  { href: "/events", label: "Events",          icon: CalendarDays },
];

interface Profile { full_name: string | null; avatar_url: string | null }

export default function Sidebar({ profile, userId, initialUnread }: { profile: Profile | null; userId: string; initialUnread: number }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const initials = (profile?.full_name ?? "?")
    .split(" ")
    .map(w => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <aside className="w-60 shrink-0 flex flex-col border-r border-zinc-200 bg-white min-h-screen">
      <div className="px-6 py-5 border-b border-zinc-100">
        <span className="font-bold text-lg tracking-tight">ShowUp2Move</span>
      </div>
      <nav className="flex flex-col gap-1 p-3 flex-1">
        {nav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              pathname === href
                ? "bg-zinc-900 text-white"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
            )}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="p-3 border-t border-zinc-100 flex flex-col gap-1">
        {userId && (
          <div className="flex items-center justify-end px-3 pb-1">
            <NotificationBell initialUnread={initialUnread} userId={userId} />
          </div>
        )}
        <Link
          href="/profile"
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group",
            pathname === "/profile"
              ? "bg-zinc-900"
              : "hover:bg-zinc-100"
          )}
        >
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.full_name ?? "Profile"}
              className="w-7 h-7 rounded-full object-cover shrink-0"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-zinc-200 flex items-center justify-center text-xs font-bold text-zinc-600 shrink-0">
              {initials}
            </div>
          )}
          <span className={cn(
            "text-sm font-medium truncate",
            pathname === "/profile" ? "text-white" : "text-zinc-700 group-hover:text-zinc-900"
          )}>
            {profile?.full_name ?? "My Profile"}
          </span>
        </Link>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 w-full transition-colors"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
