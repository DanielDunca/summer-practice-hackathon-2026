import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Users, ChevronRight, CalendarDays } from "lucide-react";
import InviteActions from "@/components/groups/InviteActions";

export default async function GroupsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberships } = await (supabase as any)
    .from("group_members")
    .select("group_id, status, groups(id, status, event_date, sports(name, icon))")
    .eq("user_id", user.id)
    .neq("status", "declined");

  const { data: memberCounts } = await (supabase as any)
    .from("group_members")
    .select("group_id")
    .in("group_id", (memberships ?? []).map((m: any) => m.group_id))
    .neq("status", "declined");

  const countMap: Record<string, number> = {};
  for (const row of (memberCounts ?? []) as any[]) {
    countMap[row.group_id] = (countMap[row.group_id] ?? 0) + 1;
  }

  const groups = ((memberships ?? []) as any[])
    .filter(m => m.groups && m.groups.status !== "cancelled")
    .sort((a, b) => new Date(b.groups.event_date ?? 0).getTime() - new Date(a.groups.event_date ?? 0).getTime());

  const statusStyles: Record<string, string> = {
    pending:   "bg-orange-50 text-orange-700 border-orange-200",
    forming:   "bg-amber-50 text-amber-700 border-amber-200",
    confirmed: "bg-green-50 text-green-700 border-green-200",
    completed: "bg-zinc-100 text-zinc-500 border-zinc-200",
    cancelled: "bg-red-50 text-red-500 border-red-200",
  };

  return (
    <div className="max-w-2xl mx-auto w-full p-8 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">My Groups</h1>
        <p className="text-zinc-500 text-sm mt-1">Groups you&apos;ve been matched into</p>
      </div>

      {groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="w-14 h-14 rounded-2xl bg-zinc-100 flex items-center justify-center">
            <Users className="w-7 h-7 text-zinc-400" />
          </div>
          <div>
            <p className="font-semibold text-zinc-700">No groups yet</p>
            <p className="text-sm text-zinc-400 mt-1">Say yes to ShowUpToday and get matched with players near you.</p>
          </div>
          <Link href="/match"
            className="px-5 py-2.5 rounded-xl bg-zinc-900 text-white text-sm font-semibold hover:bg-zinc-800 transition-colors">
            Show up today →
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((m: any) => {
            const g = m.groups;
            const sport = g.sports;
            const count = countMap[g.id] ?? 0;
            const membershipStatus = m.status as string;
            const statusStyle = statusStyles[membershipStatus] ?? statusStyles[g.status] ?? statusStyles.forming;
            const groupSummary = (
              <>
                <div className="w-12 h-12 rounded-xl bg-zinc-50 border border-zinc-200 flex items-center justify-center text-2xl shrink-0">
                  {sport?.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-zinc-900">{sport?.name} group</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    {g.event_date && (
                      <span className="flex items-center gap-1 text-xs text-zinc-400">
                        <CalendarDays className="w-3 h-3" />
                        {new Date(g.event_date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-xs text-zinc-400">
                      <Users className="w-3 h-3" /> {count} player{count !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
              </>
            );

            return (
              <div key={g.id} className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-zinc-200 hover:border-zinc-300 hover:shadow-sm transition-all">
                <Link href={`/groups/${g.id}`} className="flex items-center gap-4 flex-1 min-w-0">{groupSummary}</Link>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full border capitalize ${statusStyle}`}>
                      {membershipStatus === "pending" ? "invite" : g.status}
                    </span>
                    {membershipStatus === "pending"
                      ? <InviteActions groupId={g.id} />
                      : <Link href={`/groups/${g.id}`}><ChevronRight className="w-4 h-4 text-zinc-300" /></Link>}
                  </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
