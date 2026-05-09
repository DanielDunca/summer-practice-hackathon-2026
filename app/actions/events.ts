"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { ACHIEVEMENT_META } from "@/lib/achievements";

// ─── CREATE EVENT ────────────────────────────────────────────────────────────

export async function createEvent(payload: {
  groupId: string;
  title: string;
  venueName: string | null;
  venueAddress: string | null;
  locationLat: number | null;
  locationLng: number | null;
  scheduledAt: string | null;
  notes: string | null;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();
  const { data: event, error } = await admin.from("events").insert({
    group_id: payload.groupId,
    created_by: user.id,
    title: payload.title,
    venue_name: payload.venueName,
    venue_address: payload.venueAddress,
    location_lat: payload.locationLat,
    location_lng: payload.locationLng,
    scheduled_at: payload.scheduledAt,
    status: "planning",
    notes: payload.notes,
  }).select("id").single();

  if (error) return { error: error.message };

  // Check & award achievements
  await checkAndAwardAchievements(user.id);

  // Notify group members
  const { data: members } = await admin
    .from("group_members")
    .select("user_id")
    .eq("group_id", payload.groupId)
    .eq("status", "confirmed")
    .neq("user_id", user.id);

  for (const m of (members ?? []) as any[]) {
    await sendNotification(m.user_id, "event_created", `New event: ${payload.title}`, payload.venueName ?? "", `/events`);
  }

  revalidatePath("/events");
  revalidatePath(`/groups/${payload.groupId}`);
  return { ok: true, eventId: (event as any).id };
}

// ─── RSVP ────────────────────────────────────────────────────────────────────

export async function rsvpToEvent(eventId: string, response: "going" | "not_going") {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await (supabase as any)
    .from("event_rsvp")
    .upsert({ event_id: eventId, user_id: user.id, response }, { onConflict: "event_id,user_id" });

  if (error) return { error: error.message };
  revalidatePath("/events");
  return { ok: true };
}

export async function getEventRsvps(eventIds: string[]) {
  if (eventIds.length === 0) return {};
  const admin = createAdminClient();
  const { data } = await admin.from("event_rsvp").select("event_id, user_id, response").in("event_id", eventIds);
  const map: Record<string, { going: number; notGoing: number }> = {};
  for (const row of (data ?? []) as any[]) {
    if (!map[row.event_id]) map[row.event_id] = { going: 0, notGoing: 0 };
    if (row.response === "going") map[row.event_id].going++;
    else map[row.event_id].notGoing++;
  }
  return map;
}

// ─── POLLS ───────────────────────────────────────────────────────────────────

export async function createPoll(groupId: string, question: string, options: string[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (options.length < 2) return { error: "Need at least 2 options" };

  const admin = createAdminClient();

  // Only confirmed group members can create polls
  const { data: membership } = await admin
    .from("group_members")
    .select("status")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .maybeSingle();

  if ((membership as any)?.status !== "confirmed") return { error: "Only confirmed members can create polls" };

  const { data: poll, error } = await admin
    .from("votes")
    .insert({ group_id: groupId, created_by: user.id, question, options })
    .select("id")
    .single();

  if (error) return { error: error.message };

  // Post system message linking to the poll
  await admin.from("messages").insert({
    group_id: groupId,
    user_id: user.id,
    content: `📊 New poll: "${question}"`,
    is_system: false,
  });

  revalidatePath(`/groups/${groupId}`);
  return { ok: true, pollId: (poll as any).id };
}

export async function castVote(voteId: string, choice: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await (supabase as any)
    .from("user_votes")
    .upsert({ vote_id: voteId, user_id: user.id, choice }, { onConflict: "vote_id,user_id" });

  if (error) return { error: error.message };
  return { ok: true };
}

// ─── NOTIFICATIONS ───────────────────────────────────────────────────────────

export async function markNotificationsRead() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await (supabase as any).from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
}

export async function sendNotification(
  userId: string,
  type: string,
  title: string,
  body: string,
  link: string
) {
  const admin = createAdminClient();
  await admin.from("notifications").insert({ user_id: userId, type, title, body, link });
}

// ─── ACHIEVEMENTS ────────────────────────────────────────────────────────────

export async function checkAndAwardAchievements(userId: string) {
  const admin = createAdminClient();

  // Get existing achievements to avoid duplicates
  const { data: existing } = await admin
    .from("achievements")
    .select("type")
    .eq("user_id", userId);
  const have = new Set(((existing ?? []) as any[]).map((a: any) => a.type));

  const toAward: string[] = [];

  // Count confirmed group memberships
  const { count: groupCount } = await admin
    .from("group_members")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "confirmed");

  const gc = groupCount ?? 0;
  if (gc >= 1 && !have.has("first_group")) toAward.push("first_group");
  if (gc >= 5 && !have.has("five_groups")) toAward.push("five_groups");
  if (gc >= 10 && !have.has("ten_groups")) toAward.push("ten_groups");

  // Captain check
  if (!have.has("first_captain")) {
    const { count: captainCount } = await admin
      .from("groups")
      .select("id", { count: "exact", head: true })
      .eq("captain_id", userId);
    if ((captainCount ?? 0) >= 1) toAward.push("first_captain");
  }

  // Events organised check
  if (!have.has("three_events")) {
    const { count: eventCount } = await admin
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("created_by", userId);
    if ((eventCount ?? 0) >= 3) toAward.push("three_events");
  }

  if (toAward.length === 0) return [];

  await admin.from("achievements").insert(toAward.map(type => ({ user_id: userId, type })));

  // Send notification for each new achievement
  for (const type of toAward) {
    const meta = ACHIEVEMENT_META[type];
    if (meta) {
      await admin.from("notifications").insert({
        user_id: userId,
        type: "achievement",
        title: `Achievement unlocked: ${meta.label} ${meta.icon}`,
        body: null,
        link: "/profile",
      });
    }
  }

  return toAward;
}
