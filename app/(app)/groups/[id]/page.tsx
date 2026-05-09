import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import GroupChat from "@/components/groups/GroupChat";
import PastPlayerInvites from "@/components/groups/PastPlayerInvites";
import InviteActions from "@/components/groups/InviteActions";
import GroupActions from "@/components/groups/GroupActions";
import PollSection from "@/components/groups/PollSection";
import ShareButton from "@/components/ShareButton";
import { CalendarDays, Users, Crown } from "lucide-react";

export default async function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: groupId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const admin = createAdminClient();

  // Fetch group
  const { data: group } = await admin
    .from("groups")
    .select("id, status, event_date, captain_id, sports(name, icon, min_players, max_players)")
    .eq("id", groupId)
    .maybeSingle();

  if (!group) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="max-w-sm text-center">
          <h1 className="text-xl font-bold text-zinc-900 mb-2">Group not found</h1>
          <p className="text-sm text-zinc-500 mb-5">This group may have been cancelled or removed.</p>
          <Link href="/groups" className="inline-flex px-4 py-2 rounded-xl bg-zinc-900 text-white text-sm font-semibold">
            Back to groups
          </Link>
        </div>
      </div>
    );
  }

  // Fetch members
  const { data: members } = await admin
    .from("group_members")
    .select("user_id, status")
    .eq("group_id", groupId);

  const allMembers = (members ?? []) as any[];
  const currentMembership = allMembers.find(m => m.user_id === user.id);
  const memberIds = allMembers.filter(m => m.status === "confirmed").map(m => m.user_id);
  const pendingMemberIds = allMembers.filter(m => m.status === "pending").map(m => m.user_id);
  const activeMemberIds = allMembers.filter(m => m.status !== "declined").map(m => m.user_id);
  const allMemberIds = new Set(allMembers.filter(m => m.status !== "declined").map(m => m.user_id));
  const isConfirmed = currentMembership?.status === "confirmed";
  const isPending = currentMembership?.status === "pending";

  // Verify current user is a member or invitee
  if (!currentMembership || currentMembership.status === "declined") {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="max-w-sm text-center">
          <h1 className="text-xl font-bold text-zinc-900 mb-2">No access to this group</h1>
          <p className="text-sm text-zinc-500 mb-5">You need to be matched or invited before you can view this group chat.</p>
          <Link href="/groups" className="inline-flex px-4 py-2 rounded-xl bg-zinc-900 text-white text-sm font-semibold">
            Back to groups
          </Link>
        </div>
      </div>
    );
  }

  // Fetch profiles for all active members, including pending invitees.
  const { data: profilesData } = activeMemberIds.length > 0
    ? await admin
      .from("profiles")
      .select("user_id, full_name, avatar_url")
      .in("user_id", activeMemberIds)
    : { data: [] };

  const memberProfiles: Record<string, { full_name: string; avatar_url: string | null }> = {};
  for (const p of (profilesData ?? []) as any[]) {
    memberProfiles[p.user_id] = { full_name: p.full_name, avatar_url: p.avatar_url };
  }

  const { data: previousMemberships } = await admin
    .from("group_members")
    .select("group_id")
    .eq("user_id", user.id)
    .eq("status", "confirmed")
    .neq("group_id", groupId);

  const previousGroupIds = [...new Set(((previousMemberships ?? []) as any[]).map(row => row.group_id))];
  const { data: previousTeammates } = previousGroupIds.length > 0
    ? await admin
      .from("group_members")
      .select("user_id")
      .in("group_id", previousGroupIds)
      .eq("status", "confirmed")
      .neq("user_id", user.id)
    : { data: [] };

  const inviteCandidateIds = [...new Set(((previousTeammates ?? []) as any[])
    .map(row => row.user_id)
    .filter(id => !allMemberIds.has(id)))];

  const { data: inviteProfiles } = inviteCandidateIds.length > 0
    ? await admin
      .from("profiles")
      .select("user_id, full_name, avatar_url")
      .in("user_id", inviteCandidateIds)
      .limit(8)
    : { data: [] };

  // Fetch polls for this group
  const { data: pollsData } = await admin
    .from("votes")
    .select("id, question, options")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false })
    .limit(10);

  const pollIds = ((pollsData ?? []) as any[]).map(p => p.id);
  const { data: userVotesData } = pollIds.length > 0
    ? await admin.from("user_votes").select("vote_id, user_id, choice").in("vote_id", pollIds)
    : { data: [] };

  const initialPolls = ((pollsData ?? []) as any[]).map(p => {
    const allVotes = ((userVotesData ?? []) as any[]).filter((v: any) => v.vote_id === p.id);
    const voteCounts: Record<string, number> = {};
    for (const v of allVotes) voteCounts[v.choice] = (voteCounts[v.choice] ?? 0) + 1;
    const myChoice = allVotes.find((v: any) => v.user_id === user.id)?.choice ?? null;
    return { id: p.id, question: p.question, options: p.options as string[], myChoice, voteCounts, totalVotes: allVotes.length };
  });

  // Fetch initial messages
  const { data: messagesData } = await admin
    .from("messages")
    .select("id, content, created_at, user_id, is_system")
    .eq("group_id", groupId)
    .order("created_at", { ascending: true })
    .limit(100);

  const sport = (group as any).sports;
  const activeMemberCount = allMembers.filter(member => member.status !== "declined").length;
  const groupIsFull = activeMemberCount >= (sport?.max_players ?? 20);

  const statusStyles: Record<string, string> = {
    forming:   "bg-amber-50 text-amber-700 border border-amber-200",
    confirmed: "bg-green-50 text-green-700 border border-green-200",
    completed: "bg-zinc-100 text-zinc-500 border border-zinc-200",
    cancelled: "bg-red-50 text-red-500 border border-red-200",
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="px-6 py-5 border-b border-zinc-200 bg-white flex items-center gap-4 shrink-0">
        <div className="w-10 h-10 rounded-xl bg-zinc-50 border border-zinc-200 flex items-center justify-center text-xl shrink-0">
          {sport?.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-zinc-900">{sport?.name} group</h1>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${statusStyles[(group as any).status] ?? statusStyles.forming}`}>
              {(group as any).status}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            {(group as any).event_date && (
              <span className="flex items-center gap-1 text-xs text-zinc-400">
                <CalendarDays className="w-3 h-3" />
                {new Date((group as any).event_date).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
              </span>
            )}
            <span className="flex items-center gap-1 text-xs text-zinc-400">
              <Users className="w-3 h-3" /> {memberIds.length} / {sport?.max_players} players
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ShareButton path={`/groups/${groupId}`} label="Share" />
          <GroupActions groupId={groupId} isCaptain={user.id === (group as any).captain_id} />
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Members sidebar */}
        <div className="w-56 border-r border-zinc-200 bg-zinc-50 flex flex-col shrink-0">
          <div className="px-4 py-3 border-b border-zinc-200">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Members</p>
          </div>
          <div className="flex-1 overflow-y-auto py-2">
            {memberIds.map(uid => {
              const profile = memberProfiles[uid];
              const initials = (profile?.full_name ?? "?").split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
              const isCaptain = uid === (group as any).captain_id;
              const isMe = uid === user.id;
              const href = isMe ? "/profile" : `/users/${uid}`;

              return (
                <Link key={uid} href={href} className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-zinc-100 transition-colors">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt={profile.full_name} className="w-7 h-7 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-zinc-200 flex items-center justify-center text-xs font-bold text-zinc-600 shrink-0">
                      {initials}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-900 truncate">
                      {profile?.full_name ?? "Unknown"}{isMe ? " (you)" : ""}
                    </p>
                  </div>
                  {isCaptain && <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                </Link>
              );
            })}
            {pendingMemberIds.length > 0 && (
              <div className="mt-2 border-t border-zinc-200 pt-2">
                <p className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Invited</p>
                {pendingMemberIds.map(uid => {
                  const profile = memberProfiles[uid];
                  const initials = (profile?.full_name ?? "?").split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
                  const isMe = uid === user.id;
                  const href = isMe ? "/profile" : `/users/${uid}`;

                  return (
                    <Link key={uid} href={href} className="flex items-center gap-2.5 px-4 py-2.5 opacity-70 hover:bg-zinc-100 transition-colors">
                      {profile?.avatar_url ? (
                        <img src={profile.avatar_url} alt={profile.full_name} className="w-7 h-7 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-zinc-200 flex items-center justify-center text-xs font-bold text-zinc-600 shrink-0">
                          {initials}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-900 truncate">{profile?.full_name ?? "Unknown"}</p>
                      </div>
                      <span className="text-[10px] font-medium text-amber-600">pending</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
          <div className="border-t border-zinc-200">
            <div className="px-4 py-3 border-b border-zinc-200">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Invite teammates</p>
            </div>
            <PastPlayerInvites
              groupId={groupId}
              candidates={(inviteProfiles ?? []) as any[]}
              disabled={groupIsFull || !isConfirmed}
            />
          </div>
          {isConfirmed && (
            <PollSection
              groupId={groupId}
              isCaptain={user.id === (group as any).captain_id}
              initialPolls={initialPolls}
            />
          )}
        </div>

        {isPending ? (
          <div className="flex-1 min-h-0 bg-white flex items-center justify-center p-6">
            <div className="max-w-md w-full rounded-2xl border border-zinc-200 bg-zinc-50 p-6 text-center">
              <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-white border border-zinc-200 flex items-center justify-center text-3xl">
                {sport?.icon}
              </div>
              <h2 className="text-xl font-bold text-zinc-900 mb-2">Join this {sport?.name} group?</h2>
              <p className="text-sm text-zinc-500 mb-5">
                You were matched with this group. Accept to enter the chat and coordinate with the confirmed players.
              </p>
              <div className="flex justify-center">
                <InviteActions groupId={groupId} />
              </div>
            </div>
          </div>
        ) : (
          <GroupChat
            groupId={groupId}
            initialMessages={(messagesData ?? []) as any[]}
            currentUserId={user.id}
            memberProfiles={memberProfiles}
            sportName={sport?.name ?? "Sport"}
          />
        )}
      </div>
    </div>
  );
}
