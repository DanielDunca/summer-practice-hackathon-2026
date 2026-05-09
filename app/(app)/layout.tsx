import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("full_name, avatar_url")
    .eq("user_id", user.id)
    .maybeSingle();

  const { count: unreadCount } = await (supabase as any)
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("read", false);

  return (
    <div className="flex min-h-screen bg-zinc-50">
      <Sidebar profile={profile ?? null} userId={user.id} initialUnread={unreadCount ?? 0} />
      <main className="flex-1 flex flex-col overflow-auto">{children}</main>
    </div>
  );
}
