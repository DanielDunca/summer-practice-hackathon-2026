"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateText } from "@/lib/gemini";
import { revalidatePath } from "next/cache";
import { checkAndAwardAchievements, sendNotification } from "@/app/actions/events";

export interface MatchResult {
  previewId: string;
  groupId?: string;
  sport: string;
  sportId: string;
  sportIcon: string;
  memberCount: number;
  captainName: string;
  currentUserStatus: "pending" | "confirmed";
  members: Array<{
    userId: string;
    fullName: string;
    avatarUrl: string | null;
    isCurrentUser: boolean;
    status: "pending" | "confirmed" | "declined";
  }>;
}

type MatchProfile = {
  user_id: string;
  full_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  skill_level: string | null;
  location_lat: number | null;
  location_lng: number | null;
};

type GroupMemberRow = {
  user_id: string;
  status: "pending" | "confirmed" | "declined";
};

type PreviewMember = MatchResult["members"][number];

function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const toRad = (value: number) => value * Math.PI / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(h));
}

function captainScore(profile: MatchProfile) {
  const skillScore: Record<string, number> = {
    advanced: 30,
    intermediate: 20,
    beginner: 10,
  };

  return (skillScore[profile.skill_level ?? ""] ?? 0)
    + (profile.bio ? 6 : 0)
    + (profile.avatar_url ? 4 : 0)
    + (profile.location_lat !== null && profile.location_lng !== null ? 5 : 0)
    + (profile.full_name ? 2 : 0);
}

function selectCaptain(players: MatchProfile[]) {
  return [...players].sort((a, b) => {
    const scoreDiff = captainScore(b) - captainScore(a);
    if (scoreDiff !== 0) return scoreDiff;
    return a.user_id.localeCompare(b.user_id);
  })[0] ?? players[0];
}

function normalizeLocation(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function levenshtein(a: string, b: string) {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0));
  for (let i = 0; i < rows; i++) matrix[i][0] = i;
  for (let j = 0; j < cols; j++) matrix[0][j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[rows - 1][cols - 1];
}

function locationsMatch(a: string | null | undefined, b: string | null | undefined) {
  const left = normalizeLocation(a);
  const right = normalizeLocation(b);
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.includes(right) || right.includes(left)) return true;

  const maxLen = Math.max(left.length, right.length);
  const distance = levenshtein(left, right);
  return distance <= 2 || distance <= Math.ceil(maxLen * 0.2);
}

async function loadMemberPreview(admin: ReturnType<typeof createAdminClient>, groupId: string, currentUserId: string) {
  const { data: members } = await admin
    .from("group_members")
    .select("user_id, status")
    .eq("group_id", groupId)
    .neq("status", "declined");

  const memberRows = (members ?? []) as GroupMemberRow[];
  const memberIds = memberRows.map(member => member.user_id);
  const { data: profiles } = memberIds.length > 0
    ? await admin
      .from("profiles")
      .select("user_id, full_name, avatar_url")
      .in("user_id", memberIds)
    : { data: [] };

  const profileMap = new Map<string, { full_name: string; avatar_url: string | null }>(
    ((profiles ?? []) as any[]).map(profile => [profile.user_id, { full_name: profile.full_name, avatar_url: profile.avatar_url }])
  );

  return memberRows.map(member => {
    const profile = profileMap.get(member.user_id);
    return {
      userId: member.user_id,
      fullName: profile?.full_name ?? "Player",
      avatarUrl: profile?.avatar_url ?? null,
      isCurrentUser: member.user_id === currentUserId,
      status: member.status,
    };
  });
}

async function getNearbyUserIds(admin: ReturnType<typeof createAdminClient>, myLat: number | null, myLng: number | null, myCity: string | null) {
  if (myLat !== null && myLng !== null) {
    const { data } = await (admin as any).rpc("nearby_users", { lat: myLat, lng: myLng, radius_km: 25 });
    return ((data ?? []) as any[]).map(row => row.user_id as string);
  }

  const { data: profiles } = await admin
    .from("profiles")
    .select("user_id, location_name");

  return ((profiles ?? []) as any[])
    .filter(profile => locationsMatch(profile.location_name ?? null, myCity))
    .map(profile => profile.user_id as string);
}

async function buildMemberPreview(admin: ReturnType<typeof createAdminClient>, groupId: string, currentUserId: string) {
  const { data: groupMembers } = await admin
    .from("group_members")
    .select("user_id, status")
    .eq("group_id", groupId)
    .neq("status", "declined");

  const memberRows = (groupMembers ?? []) as GroupMemberRow[];
  const memberIds = memberRows.map(member => member.user_id);
  const { data: profiles } = memberIds.length > 0
    ? await admin
      .from("profiles")
      .select("user_id, full_name, avatar_url")
      .in("user_id", memberIds)
    : { data: [] };

  const profileMap = new Map<string, { full_name: string; avatar_url: string | null }>(
    ((profiles ?? []) as any[]).map(profile => [profile.user_id, { full_name: profile.full_name, avatar_url: profile.avatar_url }])
  );

  return memberRows.map(member => {
    const profile = profileMap.get(member.user_id);
    const preview: PreviewMember = {
      userId: member.user_id,
      fullName: profile?.full_name ?? "Player",
      avatarUrl: profile?.avatar_url ?? null,
      isCurrentUser: member.user_id === currentUserId,
      status: member.status,
    };
    return preview;
  });
}

export async function createGroupFromPreview(sportId: string, memberIds: string[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();
  const today = new Date().toISOString().split("T")[0];

  return createGroupFromPreviewInternal(admin, sportId, memberIds, user.id, today);
}

async function createGroupFromPreviewInternal(admin: ReturnType<typeof createAdminClient>, sportId: string, memberIds: string[], currentUserId: string, today: string) {
  const { data: sport } = await admin
    .from("sports")
    .select("id, name, icon, min_players, max_players")
    .eq("id", sportId)
    .single();

  if (!sport) return { error: "Sport not found" };

  const { data: profiles } = await admin
    .from("profiles")
    .select("user_id, full_name, bio, avatar_url, skill_level, location_lat, location_lng")
    .in("user_id", memberIds);

  const sorted = (profiles ?? []) as MatchProfile[];
  if (sorted.length === 0) return { error: "No members available" };

  const captain = selectCaptain(sorted);
  const { data: group, error: groupError } = await admin
    .from("groups")
    .insert({
      sport_id: (sport as any).id,
      captain_id: captain.user_id,
      status: "forming",
      event_date: today,
    })
    .select("id")
    .single();

  if (groupError || !group) return { error: groupError?.message ?? "Could not create group" };

  const { error: memberInsertError } = await admin.from("group_members").insert(
    memberIds.map(userId => ({
      group_id: (group as any).id,
      user_id: userId,
      status: userId === currentUserId ? "confirmed" : "pending",
    }))
  );

  if (memberInsertError) {
    await admin.from("groups").delete().eq("id", (group as any).id);
    return { error: memberInsertError.message };
  }

  const memberNames = sorted.map(p => (p.full_name ?? "Player").split(" ")[0]).join(", ");
  const welcomeMsg = await generateText(
    `You are a friendly coordinator for ShowUp2Move, a sports matching app. A new ${(sport as any).name} group just formed with ${sorted.length} players: ${memberNames}. Write a short, energetic welcome message (2 sentences max) to kick off their group chat. Be warm and enthusiastic. No hashtags, no emoji spam — just natural energy.`
  ) ?? `Welcome to the ${(sport as any).name} group, ${memberNames}. Use this chat to confirm time, place, and anything you need before you play.`;

  await admin.from("messages").insert({
    group_id: (group as any).id,
    user_id: currentUserId,
    content: welcomeMsg,
  });

  for (const memberId of memberIds) {
    await sendNotification(
      memberId,
      "matched",
      `You're in a ${(sport as any).name} group!`,
      "Open the group to review the members and confirm your spot.",
      `/groups/${(group as any).id}`
    );
  }

  await checkAndAwardAchievements(captain.user_id);

  return { groupId: (group as any).id, sportName: (sport as any).name, sportIcon: (sport as any).icon };
}

async function getMatchableUserIds(admin: ReturnType<typeof createAdminClient>, myLat: number | null, myLng: number | null, myCity: string | null) {
  return getNearbyUserIds(admin, myLat, myLng, myCity);
}

export async function runMatching(sportIds: string[]): Promise<{ matched: MatchResult[]; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { matched: [], error: "Not authenticated" };

  const admin = createAdminClient();
  const today = new Date().toISOString().split("T")[0];

  // Get current user's location
  const { data: myProfile } = await admin
    .from("profiles")
    .select("location_name, location_lat, location_lng, full_name")
    .eq("user_id", user.id)
    .single();

  const locationName = (myProfile as any)?.location_name ?? null;
  const myLat = (myProfile as any)?.location_lat ?? null;
  const myLng = (myProfile as any)?.location_lng ?? null;
  const myCity = normalizeLocation(locationName) || null;

  // Refuse to match without any location data at all
  if (myLat === null && myCity === null) {
    return { matched: [], error: "Set your city in your profile before matching." };
  }

  function sameCity(otherLocationName: string | null): boolean {
    return locationsMatch(otherLocationName, locationName);
  }

  function nearEnough(otherLat: number | null, otherLng: number | null, otherLocationName: string | null): boolean {
    if (myLat !== null && myLng !== null && otherLat !== null && otherLng !== null) {
      return distanceKm(myLat, myLng, otherLat, otherLng) <= 25;
    }
    // Fallback: city name match when coordinates are missing on either side
    return sameCity(otherLocationName);
  }

  const results: MatchResult[] = [];

  for (const sportId of sportIds) {
    // Get sport details
    const { data: sport } = await admin
      .from("sports")
      .select("id, name, icon, min_players, max_players")
      .eq("id", sportId)
      .single();

    if (!sport) continue;

    const minPlayers = (sport as any).min_players as number;
    const maxPlayers = (sport as any).max_players as number;

    // If this user is already attached to a group, return it so the UI can
    // still link them to the chat after a refresh or repeated check.
    const { data: existingMemberships } = await admin
      .from("group_members")
      .select("group_id, status, groups!inner(id, captain_id, sport_id, event_date, status)")
      .eq("user_id", user.id)
      .filter("groups.sport_id", "eq", sportId)
      .filter("groups.event_date", "eq", today)
      .neq("groups.status", "cancelled");

    const existingConfirmed = ((existingMemberships ?? []) as any[])
      .find(membership => membership.status === "confirmed");

    const existingPending = ((existingMemberships ?? []) as any[])
      .find(membership => membership.status === "pending");

    const existingAny = existingConfirmed ?? existingPending;

    if (existingAny) {
      const { data: activeMembers } = await admin
        .from("group_members")
        .select("user_id, status")
        .eq("group_id", existingAny.group_id)
        .neq("status", "declined");

      const { data: captainProfile } = await admin
        .from("profiles")
        .select("full_name")
        .eq("user_id", (existingAny.groups as any).captain_id)
        .maybeSingle();

      const members = await buildMemberPreview(admin, existingAny.group_id, user.id);

      results.push({
        previewId: crypto.randomUUID(),
        groupId: existingAny.group_id,
        sportId: sportId,
        sport: (sport as any).name,
        sportIcon: (sport as any).icon,
        memberCount: (activeMembers ?? []).length,
        captainName: (captainProfile as any)?.full_name ?? "Captain",
        currentUserStatus: existingConfirmed ? "confirmed" : "pending",
        members,
      });
      continue;
    }

    // Preview existing open groups near the user, but do not create membership
    // here. Joining happens only when the user explicitly accepts.
    const nearbyIdsForJoin = await getMatchableUserIds(admin, myLat, myLng, myCity);
    if (!nearbyIdsForJoin.includes(user.id)) nearbyIdsForJoin.push(user.id);

    const { data: openGroups } = nearbyIdsForJoin.length > 0
      ? await admin
          .from("groups")
          .select("id, captain_id, status")
          .eq("sport_id", sportId)
          .eq("event_date", today)
          .neq("status", "cancelled")
          .in("captain_id", nearbyIdsForJoin)
      : { data: [] };

    let joinedExistingGroup = false;
    for (const openGroup of ((openGroups ?? []) as any[])) {
      const { data: existingMembers } = await admin
        .from("group_members")
        .select("user_id, status")
        .eq("group_id", openGroup.id)
        .neq("status", "declined");

      const activeMembers = (existingMembers ?? []) as GroupMemberRow[];
      if (activeMembers.some(member => member.user_id === user.id)) {
        joinedExistingGroup = true;
        break;
      }
      if (activeMembers.length >= maxPlayers) continue;

      const { data: captainProfile } = await admin
        .from("profiles")
        .select("full_name, location_lat, location_lng, location_name")
        .eq("user_id", openGroup.captain_id)
        .maybeSingle();

      const captainLat = (captainProfile as any)?.location_lat ?? null;
      const captainLng = (captainProfile as any)?.location_lng ?? null;
      const captainCity = (captainProfile as any)?.location_name ?? null;
      if (!nearEnough(captainLat, captainLng, captainCity)) continue;

      results.push({
        previewId: crypto.randomUUID(),
        groupId: openGroup.id,
        sportId: sportId,
        sport: (sport as any).name,
        sportIcon: (sport as any).icon,
        memberCount: activeMembers.length + 1,
        captainName: (captainProfile as any)?.full_name ?? "Captain",
        currentUserStatus: "pending",
        members: await buildMemberPreview(admin, openGroup.id, user.id),
      });
      joinedExistingGroup = true;
      break;
    }

    if (joinedExistingGroup) continue;

    // ── Step 1: build the allowed user ID set at DB level ──────────────────
    // This prevents any application-level edge-case from leaking cross-city
    // users into the pool. Use PostGIS when coords are available; fall back
    // to an exact case-insensitive city name query otherwise.
    const nearbyIds = await getMatchableUserIds(admin, myLat, myLng, myCity);

    // Always include the current user in the pool
    if (!nearbyIds.includes(user.id)) nearbyIds.push(user.id);

    if (nearbyIds.length < minPlayers) continue;

    // ── Step 2: availability filtered to nearby users only ─────────────────
    const { data: available } = await admin
      .from("availability")
      .select("user_id")
      .eq("date", today)
      .eq("is_available", true)
      .contains("sport_ids", [sportId])
      .in("user_id", nearbyIds);

    if (!available || available.length < minPlayers) continue;

    const userIds = (available as any[]).map(a => a.user_id);

    const { data: profiles } = await admin
      .from("profiles")
      .select("user_id, full_name, bio, avatar_url, skill_level, location_lat, location_lng, location_name")
      .in("user_id", userIds);

    if (!profiles || profiles.length < minPlayers) continue;

    // Secondary JS-level check as a safety net (should never remove anyone
    // that the DB query didn't already exclude, but keeps logic consistent)
    const locationFiltered = (profiles as MatchProfile[]).filter(profile => {
      if (profile.user_id === user.id) return true;
      return nearEnough(profile.location_lat, profile.location_lng, (profile as any).location_name ?? null);
    });

    if (locationFiltered.length < minPlayers) continue;

    // Exclude users already in an active group for this sport today
    // (must also exclude declined memberships so they can be re-matched)
    const { data: alreadyGrouped } = await admin
      .from("group_members")
      .select("user_id, groups!inner(sport_id, event_date, status)")
      .in("user_id", locationFiltered.map(p => p.user_id))
      .neq("status", "declined")
      .filter("groups.sport_id", "eq", sportId)
      .filter("groups.event_date", "eq", today)
      .filter("groups.status", "neq", "cancelled");

    const groupedIds = new Set(((alreadyGrouped ?? []) as any[]).map(g => g.user_id));
    const eligible = locationFiltered.filter(p => !groupedIds.has(p.user_id));

    if (eligible.length < minPlayers) continue;

    // Sort: prioritize current user first, then fill up to max_players
    const sorted = [
      ...eligible.filter(p => p.user_id === user.id),
      ...eligible.filter(p => p.user_id !== user.id),
    ].slice(0, maxPlayers);
    const captain = selectCaptain(sorted);
    const confirmedCount = sorted.filter(player => player.user_id === user.id).length;

    // Create the group
    results.push({
      previewId: crypto.randomUUID(),
      sportId: sportId,
      sport: (sport as any).name,
      sportIcon: (sport as any).icon,
      memberCount: sorted.length,
      captainName: captain.full_name ?? "Captain",
      currentUserStatus: "pending",
      members: sorted.map((p: MatchProfile) => ({
        userId: p.user_id,
        fullName: p.full_name ?? "Player",
        avatarUrl: p.avatar_url,
        isCurrentUser: p.user_id === user.id,
        status: "pending" as const,
      })),
    });
  }

  revalidatePath("/groups");
  revalidatePath("/match");
  return { matched: results };
}

export async function respondToGroupInvite(groupId: string, response: "confirmed" | "declined") {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await (supabase as any)
    .from("group_members")
    .update({ status: response })
    .eq("group_id", groupId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  if (response === "confirmed") {
    const admin = createAdminClient();
    const { data: group } = await admin
      .from("groups")
      .select("id, sports(min_players)")
      .eq("id", groupId)
      .single();

    const { data: confirmedMembers } = await admin
      .from("group_members")
      .select("id")
      .eq("group_id", groupId)
      .eq("status", "confirmed");

    const minPlayers = ((group as any)?.sports?.min_players ?? 2) as number;
    if ((confirmedMembers ?? []).length >= minPlayers) {
      await admin.from("groups").update({ status: "confirmed" }).eq("id", groupId);
    }
  }

  // Award achievements + send notification for confirmation
  await checkAndAwardAchievements(user.id);
  if (response === "confirmed") {
    await sendNotification(user.id, "matched", "You joined a group!", "Head to the chat to coordinate.", `/groups/${groupId}`);
  }

  revalidatePath("/groups");
  revalidatePath(`/groups/${groupId}`);
  revalidatePath("/home");
  return { ok: true };
}

export async function joinExistingGroup(groupId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();
  const { data: group } = await admin
    .from("groups")
    .select("id, status, event_date, sports(min_players, max_players)")
    .eq("id", groupId)
    .maybeSingle();

  if (!group) return { error: "Group not found" };

  const { data: existing } = await admin
    .from("group_members")
    .select("status")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing?.status === "confirmed") {
    revalidatePath("/groups");
    revalidatePath(`/groups/${groupId}`);
    return { ok: true, groupId };
  }

  const { data: members } = await admin
    .from("group_members")
    .select("id, status")
    .eq("group_id", groupId)
    .neq("status", "declined");

  const currentMembers = (members ?? []) as { id: string; status: string }[];
  const maxPlayers = ((group as any).sports?.max_players ?? 20) as number;
  if (currentMembers.length >= maxPlayers) return { error: "This group is already full" };

  const insert = existing
    ? await admin.from("group_members").update({ status: "confirmed" }).eq("group_id", groupId).eq("user_id", user.id)
    : await admin.from("group_members").insert({ group_id: groupId, user_id: user.id, status: "confirmed" });

  if (insert.error) return { error: insert.error.message };

  const confirmedCount = currentMembers.filter(member => member.status === "confirmed").length + (existing?.status === "pending" ? 0 : 1);
  if (confirmedCount >= (((group as any).sports?.min_players ?? 2) as number)) {
    await admin.from("groups").update({ status: "confirmed" }).eq("id", groupId);
  }

  revalidatePath("/groups");
  revalidatePath(`/groups/${groupId}`);
  revalidatePath("/home");
  return { ok: true, groupId };
}

export async function invitePlayerToGroup(groupId: string, targetUserId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (user.id === targetUserId) return { error: "You are already in this group" };

  const admin = createAdminClient();

  const { data: myMembership } = await admin
    .from("group_members")
    .select("id")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .eq("status", "confirmed")
    .maybeSingle();

  if (!myMembership) return { error: "Only confirmed group members can invite players" };

  const { data: group } = await admin
    .from("groups")
    .select("id, sports(max_players)")
    .eq("id", groupId)
    .single();

  if (!group) return { error: "Group not found" };

  const { data: activeMembers } = await admin
    .from("group_members")
    .select("user_id, status")
    .eq("group_id", groupId)
    .neq("status", "declined");

  const members = (activeMembers ?? []) as GroupMemberRow[];
  if (members.some(member => member.user_id === targetUserId)) {
    return { error: "That player is already invited or in the group" };
  }

  const maxPlayers = ((group as any).sports?.max_players ?? 20) as number;
  if (members.length >= maxPlayers) {
    return { error: "This group is already full" };
  }

  const { error } = await admin
    .from("group_members")
    .upsert(
      { group_id: groupId, user_id: targetUserId, status: "pending" },
      { onConflict: "group_id,user_id" }
    );

  if (error) return { error: error.message };

  const { data: profiles } = await admin
    .from("profiles")
    .select("user_id, full_name")
    .in("user_id", [user.id, targetUserId]);

  const names = new Map(((profiles ?? []) as any[]).map(profile => [profile.user_id, profile.full_name ?? "Player"]));
  await admin.from("messages").insert({
    group_id: groupId,
    user_id: user.id,
    content: `${names.get(user.id) ?? "A player"} invited ${names.get(targetUserId) ?? "a teammate"} to the group.`,
  });

  revalidatePath("/groups");
  revalidatePath(`/groups/${groupId}`);
  return { ok: true };
}

export async function leaveGroup(groupId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();

  const { data: group } = await admin
    .from("groups")
    .select("captain_id")
    .eq("id", groupId)
    .single();

  if (!group) return { error: "Group not found" };
  if ((group as any).captain_id === user.id) return { error: "Captain cannot leave — delete the group instead" };

  const { error } = await admin
    .from("group_members")
    .update({ status: "declined" })
    .eq("group_id", groupId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/groups");
  revalidatePath(`/groups/${groupId}`);
  return { ok: true };
}

export async function deleteGroup(groupId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();

  const { data: group } = await admin
    .from("groups")
    .select("captain_id")
    .eq("id", groupId)
    .single();

  if (!group) return { error: "Group not found" };
  if ((group as any).captain_id !== user.id) return { error: "Only the captain can delete the group" };

  const { error } = await admin
    .from("groups")
    .update({ status: "cancelled" })
    .eq("id", groupId);

  if (error) return { error: error.message };

  revalidatePath("/groups");
  revalidatePath(`/groups/${groupId}`);
  return { ok: true };
}
