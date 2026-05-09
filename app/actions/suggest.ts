"use server";

import { generateText, generateVisionText } from "@/lib/gemini";

const ALL_SPORTS = ["Football", "Basketball", "Tennis", "Volleyball", "Running", "Cycling", "Swimming", "Badminton", "Padel", "Hiking"];

function parseJsonArray(text: string): string[] {
  try {
    const match = text.match(/\[[\s\S]*?\]/);
    if (match) return JSON.parse(match[0]);
  } catch {}
  return [];
}

export async function suggestSportsFromBio(bio: string): Promise<string[]> {
  if (!bio.trim()) return [];
  const text = await generateText(
    `A user wrote this sports profile bio: "${bio}". Which sports from this list would they likely enjoy? List: ${ALL_SPORTS.join(", ")}. Return ONLY a JSON array of up to 3 sport names from the list, no explanation. Example: ["Running", "Hiking"]`
  );
  return parseJsonArray(text).filter(s => ALL_SPORTS.includes(s));
}

export async function suggestSportsFromImage(base64DataUrl: string, mimeType = "image/jpeg"): Promise<string[]> {
  if (!base64DataUrl.trim()) return [];

  const base64Data = base64DataUrl.includes(",")
    ? base64DataUrl.split(",").pop() ?? ""
    : base64DataUrl;

  if (!base64Data) return [];

  const text = await generateVisionText(
    `Look at this user's profile photo for a sports matching app. Identify sports or active interests visible or strongly implied by the image. Only choose from this list: ${ALL_SPORTS.join(", ")}. Return ONLY a JSON array of up to 3 sport names from the list, no explanation. If no sport is visible, return [].`,
    mimeType,
    base64Data
  );

  return parseJsonArray(text).filter(s => ALL_SPORTS.includes(s));
}

type NominatimResult = {
  lat: string;
  lon: string;
};

type OverpassElement = {
  id: number;
  type: string;
  lat?: number;
  lon?: number;
  center?: {
    lat: number;
    lon: number;
  };
  tags?: Record<string, string>;
};

export type VenueResult = {
  name: string;
  description: string;
  lat: number;
  lng: number;
};

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("format", "json");
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lng));
    url.searchParams.set("zoom", "17");
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": "ShowUp2Move hackathon venue search" },
    });
    const data = await res.json() as { address?: Record<string, string>; display_name?: string };
    const addr = data.address ?? {};
    const parts = [
      addr.road,
      addr.house_number,
      addr.suburb ?? addr.neighbourhood ?? addr.quarter ?? addr.city_district,
    ].filter(Boolean);
    if (parts.length > 0) return parts.join(", ");
    return data.display_name?.split(",").slice(0, 2).join(",").trim() ?? "";
  } catch {
    return "";
  }
}

const SPORT_TAGS: Record<string, string[]> = {
  Football: ['["sport"="soccer"]', '["leisure"="pitch"]'],
  Basketball: ['["sport"="basketball"]'],
  Tennis: ['["sport"="tennis"]'],
  Volleyball: ['["sport"="volleyball"]'],
  Running: ['["leisure"="track"]', '["sport"="running"]'],
  Cycling: ['["sport"="cycling"]', '["highway"="cycleway"]'],
  Swimming: ['["sport"="swimming"]', '["leisure"="swimming_pool"]'],
  Badminton: ['["sport"="badminton"]'],
  Padel: ['["sport"="padel"]', '["sport"="tennis"]'],
  Hiking: ['["route"="hiking"]', '["highway"="path"]'],
};

export async function findRealVenues(sport: string, city: string): Promise<VenueResult[]> {
  if (!sport.trim() || !city.trim()) return [];

  try {
    const geocodeUrl = new URL("https://nominatim.openstreetmap.org/search");
    geocodeUrl.searchParams.set("format", "json");
    geocodeUrl.searchParams.set("limit", "1");
    geocodeUrl.searchParams.set("q", `${city}, Romania`);

    const geocodeRes = await fetch(geocodeUrl, {
      headers: { "User-Agent": "ShowUp2Move hackathon venue search" },
      next: { revalidate: 60 * 60 * 24 },
    });
    const geocode = await geocodeRes.json() as NominatimResult[];
    const first = geocode[0];
    if (!first) return [];

    const lat = Number(first.lat);
    const lng = Number(first.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];

    const tags = SPORT_TAGS[sport] ?? ['["leisure"="sports_centre"]', '["leisure"="pitch"]'];
    const radius = 12000;
    const selectors = tags.flatMap(tag => [
      `node${tag}(around:${radius},${lat},${lng});`,
      `way${tag}(around:${radius},${lat},${lng});`,
      `relation${tag}(around:${radius},${lat},${lng});`,
    ]).join("\n");

    const query = `[out:json][timeout:15];
(
${selectors}
);
out center tags 20;`;

    const overpassRes = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "ShowUp2Move hackathon venue search",
      },
      body: new URLSearchParams({ data: query }),
      next: { revalidate: 60 * 60 },
    });
    if (!overpassRes.ok) return [];
    const overpass = await overpassRes.json() as { elements?: OverpassElement[] };

    const seen = new Set<string>();
    const raw = (overpass.elements ?? [])
      .map(element => {
        const elementLat = element.lat ?? element.center?.lat;
        const elementLng = element.lon ?? element.center?.lon;
        if (elementLat === undefined || elementLng === undefined) return null;
        const name = element.tags?.name || `${sport} court`;
        return { name, lat: elementLat, lng: elementLng, tags: element.tags ?? {} };
      })
      .filter((v): v is { name: string; lat: number; lng: number; tags: Record<string, string> } => Boolean(v))
      .filter(v => {
        const key = `${v.lat.toFixed(4)}-${v.lng.toFixed(4)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 5);

    const withAddresses = await Promise.all(
      raw.map(async v => {
        const address = await reverseGeocode(v.lat, v.lng);
        const description = address || [v.tags.leisure, v.tags.sport, v.tags.amenity].filter(Boolean).join(" · ") || "OpenStreetMap venue";
        return { name: v.name, description, lat: v.lat, lng: v.lng };
      })
    );

    return withAddresses;
  } catch {
    return [];
  }
}

export async function suggestVenues(sport: string, city: string): Promise<VenueResult[]> {
  return findRealVenues(sport, city);
}

// Keywords that suggest a time/date plan is being discussed
const TIME_KEYWORDS = /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|tonight|today|weekend|\d{1,2}(am|pm|:\d{2})|\bat\s+\d|\d+\s*o.?clock|morning|afternoon|evening|noon|midnight)\b/i;

export interface DetectedPlan {
  title: string | null;
  venue_name: string | null;
  venue_address: string | null;
  scheduled_at: string | null; // ISO string or null
  notes: string | null;
}

export async function detectPlanFromChat(
  messages: { content: string; sender: string; is_system?: boolean }[],
  sportName: string,
  today: string
): Promise<DetectedPlan | null> {
  // Only proceed if at least one recent non-system message contains time/date keywords
  const recent = messages.filter(m => !m.is_system).slice(-30);
  const hasKeyword = recent.some(m => TIME_KEYWORDS.test(m.content));
  if (!hasKeyword) return null;

  const transcript = recent
    .map(m => `${m.sender}: ${m.content}`)
    .join("\n");

  const prompt = `Today is ${today}. This is a group chat for a ${sportName} session.

Transcript:
${transcript}

Have the participants clearly agreed on a specific time and/or venue for their session? Look for consensus — at least two people agreeing, or one person confirming a suggestion.

If yes, extract: title (short, e.g. "Basketball at Central Park"), venue_name, venue_address (if mentioned), scheduled_at (ISO 8601 datetime, infer year ${today.slice(0, 4)} if not stated), notes (any extra details like "bring water").

If no clear agreement exists, return null.

Respond with ONLY valid JSON in this exact shape or the word null:
{"title":"...","venue_name":"...","venue_address":"...","scheduled_at":"...","notes":"..."}`;

  const raw = await generateText(prompt);
  if (!raw || raw.trim().toLowerCase() === "null") return null;

  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as DetectedPlan;
    // Must have at least a time or a venue to be useful
    if (!parsed.scheduled_at && !parsed.venue_name) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function confirmAutoEvent(
  groupId: string,
  plan: DetectedPlan,
  userId: string,
  sportName: string
): Promise<{ ok?: boolean; error?: string }> {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();

  const { error } = await admin.from("events").insert({
    group_id: groupId,
    created_by: userId,
    title: plan.title || `${sportName} session`,
    venue_name: plan.venue_name || null,
    venue_address: plan.venue_address || null,
    location_lat: null,
    location_lng: null,
    scheduled_at: plan.scheduled_at || null,
    status: "planning",
    notes: plan.notes || null,
  });

  if (error) return { error: error.message };

  await admin.from("messages").insert({
    group_id: groupId,
    user_id: userId,
    content: `📅 Event created from your chat: "${plan.title || `${sportName} session`}"${plan.scheduled_at ? ` · ${new Date(plan.scheduled_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}` : ""}${plan.venue_name ? ` · ${plan.venue_name}` : ""}`,
    is_system: true,
  });

  const { revalidatePath } = await import("next/cache");
  revalidatePath("/events");
  revalidatePath(`/groups/${groupId}`);
  return { ok: true };
}
