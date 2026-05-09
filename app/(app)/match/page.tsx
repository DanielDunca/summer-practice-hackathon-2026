import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ShowUpToday from "@/components/matching/ShowUpToday";

export default async function MatchPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const today = new Date().toISOString().split("T")[0];

  // Fetch user's sports with full details
  const { data: userSportsData } = await (supabase as any)
    .from("user_sports")
    .select("sports(id, name, icon, min_players, max_players)")
    .eq("user_id", user.id);

  const userSports = (userSportsData ?? [])
    .map((row: { sports: { id: string; name: string; icon: string; min_players: number; max_players: number } }) => row.sports)
    .filter(Boolean);

  // Check if user already submitted availability today
  const { data: existing } = await (supabase as any)
    .from("availability")
    .select("id, is_available, sport_ids")
    .eq("user_id", user.id)
    .eq("date", today)
    .maybeSingle();

  return (
    <div className="min-h-screen flex items-start justify-center pt-8">
      <ShowUpToday
        userSports={userSports}
        today={today}
        existing={existing}
      />
    </div>
  );
}
