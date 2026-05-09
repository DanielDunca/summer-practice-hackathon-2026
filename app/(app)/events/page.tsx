import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import EventPlanner from "@/components/events/EventPlanner";
import RsvpButtons from "@/components/events/RsvpButtons";
import IcsDownloadButton from "@/components/events/IcsDownloadButton";
import ShareButton from "@/components/ShareButton";
import { getEventRsvps } from "@/app/actions/events";
import { getEventWeather, type WeatherInfo } from "@/app/actions/weather";
import { CalendarDays } from "lucide-react";
import Link from "next/link";

type GroupOption = {
  id: string;
  event_date: string | null;
  sports: {
    name: string;
    icon: string;
    is_outdoor: boolean;
  } | null;
};

type PlannedEvent = {
  id: string;
  group_id: string;
  title: string;
  venue_name: string | null;
  venue_address: string | null;
  location_lat: number | null;
  location_lng: number | null;
  scheduled_at: string | null;
  status: string;
  notes: string | null;
  groups: {
    sports: {
      name: string;
      icon: string;
    } | null;
  } | null;
};

export default async function EventsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("location_name, location_lat, location_lng")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: memberships } = await supabase
    .from("group_members")
    .select("group_id, groups(id, event_date, sports(name, icon, is_outdoor))")
    .eq("user_id", user.id)
    .eq("status", "confirmed");

  const groups = ((memberships ?? []) as unknown as { groups: GroupOption | null }[])
    .map(row => row.groups)
    .filter((group): group is GroupOption => Boolean(group));

  const groupIds = groups.map(group => group.id);
  const { data: eventsData } = groupIds.length > 0
    ? await supabase
      .from("events")
      .select("id, group_id, title, venue_name, venue_address, location_lat, location_lng, scheduled_at, status, notes, groups(sports(name, icon))")
      .in("group_id", groupIds)
      .order("scheduled_at", { ascending: true, nullsFirst: false })
    : { data: [] };

  const events = (eventsData ?? []) as unknown as PlannedEvent[];
  const p = profile as { location_name: string | null; location_lat: number | null; location_lng: number | null } | null;
  const city = p?.location_name ?? "";
  const profileLat = p?.location_lat ?? null;
  const profileLng = p?.location_lng ?? null;

  const eventIds = events.map(e => e.id);
  const [rsvpCounts, myRsvpsResult] = await Promise.all([
    getEventRsvps(eventIds),
    eventIds.length > 0
      ? supabase.from("event_rsvp" as any).select("event_id, response").eq("user_id", user.id).in("event_id", eventIds)
      : Promise.resolve({ data: [] }),
  ]);
  const myRsvpMap: Record<string, "going" | "not_going"> = {};
  for (const r of ((myRsvpsResult as any).data ?? []) as any[]) myRsvpMap[r.event_id] = r.response;

  const now = new Date();
  const weatherMap: Record<string, WeatherInfo | null> = {};
  await Promise.all(
    events
      .filter(e => e.scheduled_at != null && new Date(e.scheduled_at!) > now)
      .map(async e => {
        const lat = e.location_lat ?? profileLat;
        const lng = e.location_lng ?? profileLng;
        if (lat == null || lng == null) return;
        weatherMap[e.id] = await getEventWeather(lat, lng, e.scheduled_at!);
      })
  );

  return (
    <div className="max-w-5xl mx-auto w-full px-6 py-8 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Events</h1>
        <p className="text-zinc-500 text-sm mt-1">Plan time, venue, and logistics for your matched groups.</p>
      </div>

      {groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="w-14 h-14 rounded-2xl bg-zinc-100 flex items-center justify-center">
            <CalendarDays className="w-7 h-7 text-zinc-400" />
          </div>
          <div>
            <p className="font-semibold text-zinc-700">No groups to plan for yet</p>
            <p className="text-sm text-zinc-400 mt-1">Say yes to ShowUpToday first, then create an event for your matched group.</p>
          </div>
          <Link href="/match" className="px-5 py-2.5 rounded-xl bg-zinc-900 text-white text-sm font-semibold hover:bg-zinc-800 transition-colors">
            Find a group
          </Link>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Planned events</p>
            {events.length === 0 ? (
              <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center text-zinc-400">
                <p className="font-medium text-zinc-600 mb-1">No events yet</p>
                <p className="text-sm">Create the first plan for one of your groups.</p>
              </div>
            ) : (
              events.map(event => (
                <div key={event.id} className="rounded-2xl border border-zinc-200 bg-white p-5 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-zinc-900">{event.title}</p>
                      <p className="text-sm text-zinc-500 mt-0.5">
                        {event.groups?.sports?.icon} {event.groups?.sports?.name}
                      </p>
                    </div>
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-green-50 text-green-700 border border-green-200 capitalize">
                      {event.status}
                    </span>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl bg-zinc-50 border border-zinc-200 p-3">
                      <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1">Time</p>
                      <p className="text-zinc-800">
                        {event.scheduled_at
                          ? new Date(event.scheduled_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })
                          : "To be confirmed"}
                      </p>
                    </div>
                    <div className="rounded-xl bg-zinc-50 border border-zinc-200 p-3">
                      <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1">Venue</p>
                      <p className="text-zinc-800">{event.venue_name ?? "To be confirmed"}</p>
                      {event.venue_address && <p className="text-xs text-zinc-400 mt-1">{event.venue_address}</p>}
                      {event.location_lat !== null && event.location_lng !== null && (
                        <a
                          href={`https://www.openstreetmap.org/?mlat=${event.location_lat}&mlon=${event.location_lng}#map=16/${event.location_lat}/${event.location_lng}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold text-zinc-700 underline underline-offset-2 mt-2 inline-block"
                        >
                          Open map
                        </a>
                      )}
                    </div>
                  </div>
                  {event.notes && <p className="text-sm text-zinc-600">{event.notes}</p>}
                  {weatherMap[event.id] && (
                    <div className={`flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg border ${weatherMap[event.id]!.isRainy ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-green-50 border-green-200 text-green-700"}`}>
                      {weatherMap[event.id]!.isRainy ? "🌧️" : "☀️"}
                      {weatherMap[event.id]!.description} · {weatherMap[event.id]!.temperature}°C
                      {weatherMap[event.id]!.isRainy && " — consider indoor backup"}
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-3 pt-1 border-t border-zinc-100">
                    <RsvpButtons
                      eventId={event.id}
                      initialResponse={myRsvpMap[event.id] ?? null}
                      going={rsvpCounts[event.id]?.going ?? 0}
                      notGoing={rsvpCounts[event.id]?.notGoing ?? 0}
                    />
                    <div className="flex items-center gap-3">
                      {event.scheduled_at && (
                        <IcsDownloadButton
                          title={event.title}
                          scheduledAt={event.scheduled_at}
                          venueName={event.venue_name}
                          venueAddress={event.venue_address}
                          notes={event.notes}
                        />
                      )}
                      <ShareButton path={`/events`} label="Share" />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <EventPlanner groups={groups} userId={user.id} city={city} />
        </div>
      )}
    </div>
  );
}
