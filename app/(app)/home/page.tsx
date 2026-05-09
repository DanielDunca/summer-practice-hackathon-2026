import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Zap, CircleCheckBig } from "lucide-react";

type GroupSummary = {
  group_id: string;
  groups: {
    status: string | null;
    sports: {
      name: string | null;
      icon: string | null;
    } | null;
  } | null;
};

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profileData } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("user_id", user!.id)
    .single();

  const today = new Date().toISOString().split("T")[0];
  const { data: availabilityData } = await supabase
    .from("availability")
    .select("is_available")
    .eq("user_id", user!.id)
    .eq("date", today)
    .maybeSingle();

  const { data: groups } = await supabase
    .from("group_members")
    .select("group_id, groups(sport_id, status, sports(name, icon))")
    .eq("user_id", user!.id)
    .eq("status", "confirmed")
    .limit(6);

  const { count: daysActive } = await (supabase as any)
    .from("availability")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user!.id)
    .eq("is_available", true);

  const { count: groupsJoined } = await (supabase as any)
    .from("group_members")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user!.id)
    .eq("status", "confirmed");

  const name = (profileData as { full_name: string } | null)?.full_name?.split(" ")[0] ?? null;
  const showedUpToday = (availabilityData as { is_available: boolean } | null)?.is_available;
  const groupSummaries = ((groups ?? []) as unknown as GroupSummary[])
    .filter(gm => gm.groups?.status !== "cancelled")
    .slice(0, 3);

  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  const greeting = name
    ? `Good ${timeOfDay}, ${name}.`
    : `Good ${timeOfDay}.`;
  const sub = showedUpToday
    ? "You're in the pool for today — we'll let you know when your group is ready."
    : hour < 20
      ? "Are you up for a game today?"
      : "Nothing on tonight? Set your availability for tomorrow.";

  return (
    <div className="p-8 flex flex-col gap-6 max-w-4xl mx-auto w-full">
      <div>
        <h1 className="text-3xl font-bold text-zinc-900">{greeting}</h1>
        <p className="text-zinc-500 mt-1">{sub}</p>
      </div>

      {!showedUpToday && (
        <Card className="border-2 border-zinc-900 bg-zinc-900 text-white">
          <CardContent className="flex items-center justify-between py-5">
            <div className="flex items-center gap-3">
              <Zap className="w-5 h-5 text-orange-400 shrink-0" />
              <div>
                <p className="font-semibold text-lg">ShowUpToday?</p>
                <p className="text-zinc-300 text-sm mt-0.5">Tell us you&apos;re available and we&apos;ll find your crew</p>
              </div>
            </div>
            <Link href="/match" className={cn(buttonVariants({ variant: "secondary" }))}>I&apos;m in!</Link>
          </CardContent>
        </Card>
      )}

      {showedUpToday && (
        <Card className="border-2 border-green-500">
          <CardContent className="flex items-center gap-3 py-5">
            <CircleCheckBig className="w-6 h-6 text-green-500 shrink-0" />
            <div>
              <p className="font-semibold">You&apos;re in for today!</p>
              <p className="text-zinc-500 text-sm">We&apos;ll notify you when a group is ready</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-zinc-500">Active Groups</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{groupSummaries.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-zinc-500">Days Active</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{daysActive ?? 0}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-zinc-500">Groups Joined</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{groupsJoined ?? 0}</p></CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">My Groups</h2>
        {groupSummaries.length > 0 ? (
          <div className="flex flex-col gap-2">
            {groupSummaries.map((gm) => (
              <Link key={gm.group_id} href={`/groups/${gm.group_id}`}>
                <Card className="hover:border-zinc-400 transition-colors cursor-pointer">
                  <CardContent className="flex items-center gap-3 py-4">
                    <span className="text-2xl">{gm.groups?.sports?.icon}</span>
                    <div>
                      <p className="font-medium">{gm.groups?.sports?.name} group</p>
                      <p className="text-xs text-zinc-400 capitalize">{gm.groups?.status}</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-zinc-400">
              <p>No groups yet. Say yes to ShowUpToday! to get matched.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
