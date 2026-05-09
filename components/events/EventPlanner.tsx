"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { findRealVenues, type VenueResult } from "@/app/actions/suggest";
import { createEvent as createEventAction } from "@/app/actions/events";
import { CalendarPlus, Loader2, MapPin, Search } from "lucide-react";
import { toast } from "sonner";

const MapPicker = dynamic(() => import("./MapPicker"), {
  ssr: false,
  loading: () => <div className="h-52 rounded-xl border border-zinc-200 bg-zinc-100 animate-pulse" />,
});

type GroupOption = {
  id: string;
  event_date: string | null;
  sports: {
    name: string;
    icon: string;
    is_outdoor: boolean;
  } | null;
};

interface Props {
  groups: GroupOption[];
  userId: string;
  city: string;
}

type EventInsertResult = Promise<{ error: { message: string } | null }>;

type EventsTable = {
  insert: (values: Record<string, unknown>) => EventInsertResult;
};

type EventSupabaseTables = {
  from(table: "events"): EventsTable;
};

export default function EventPlanner({ groups, userId, city }: Props) {
  const router = useRouter();
  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [venueName, setVenueName] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [locationLat, setLocationLat] = useState<number | null>(null);
  const [locationLng, setLocationLng] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingVenues, setLoadingVenues] = useState(false);
  const [venues, setVenues] = useState<VenueResult[]>([]);

  const selectedGroup = groups.find(group => group.id === groupId) ?? groups[0];
  const selectedSport = selectedGroup?.sports;
  const suggestedTitle = selectedSport ? `${selectedSport.name} session` : "Group session";
  const priceHint = useMemo(() => {
    if (!selectedSport) return "Price depends on venue";
    if (selectedSport.is_outdoor) return "Likely free or low cost if using a public outdoor spot";
    return "Likely paid court/lane rental; confirm price before the game";
  }, [selectedSport]);

  async function loadVenues() {
    if (!selectedSport) return;
    if (!city.trim()) {
      toast.error("Add a city to your profile first so we can search nearby venues.");
      return;
    }
    setLoadingVenues(true);
    const suggestions = await findRealVenues(selectedSport.name, city);
    setVenues(suggestions);
    if (suggestions.length === 0) toast.info("No real venues found nearby. Try pinning a venue manually.");
    setLoadingVenues(false);
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      position => {
        setLocationLat(position.coords.latitude);
        setLocationLng(position.coords.longitude);
        toast.success("Map location set");
      },
      () => toast.error("Couldn't get your location")
    );
  }

  async function createEvent() {
    if (!groupId) { toast.error("Choose a group"); return; }
    if (!title.trim() && !selectedSport) { toast.error("Add an event title"); return; }

    setSaving(true);
    const result = await createEventAction({
      groupId,
      title: title.trim() || suggestedTitle,
      venueName: venueName.trim() || null,
      venueAddress: venueAddress.trim() || null,
      locationLat,
      locationLng,
      scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      notes: notes.trim() || null,
    });

    if (result.error) {
      toast.error(result.error);
      setSaving(false);
      return;
    }

    toast.success("Event created");
    setTitle("");
    setScheduledAt("");
    setVenueName("");
    setVenueAddress("");
    setLocationLat(null);
    setLocationLng(null);
    setNotes("");
    setVenues([]);
    setSaving(false);
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 flex flex-col gap-4 sticky top-6">
      <div>
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Create event</p>
        <h2 className="font-semibold text-zinc-900 mt-1">Coordinate the next game</h2>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-zinc-700">Group</label>
        <select
          value={groupId}
          onChange={event => {
            setGroupId(event.target.value);
            setVenues([]);
          }}
          className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
        >
          {groups.map(group => (
            <option key={group.id} value={group.id}>
              {group.sports?.icon} {group.sports?.name ?? "Group"} {group.event_date ? `· ${group.event_date}` : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-zinc-700">Title</label>
        <input
          value={title}
          onChange={event => setTitle(event.target.value)}
          placeholder={suggestedTitle}
          className="h-10 rounded-xl border border-zinc-200 px-3 text-sm outline-none focus:border-zinc-400"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-zinc-700">When</label>
        <input
          type="datetime-local"
          value={scheduledAt}
          onChange={event => setScheduledAt(event.target.value)}
          className="h-10 rounded-xl border border-zinc-200 px-3 text-sm outline-none focus:border-zinc-400"
        />
      </div>

      <div className="rounded-xl bg-zinc-50 border border-zinc-200 p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-zinc-400" />
            <p className="text-sm font-medium text-zinc-700">Venue</p>
          </div>
          <button
            type="button"
            onClick={loadVenues}
            disabled={loadingVenues}
            className="flex items-center gap-1.5 text-xs font-semibold text-orange-600 hover:text-orange-700 disabled:opacity-50"
          >
            {loadingVenues ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            Find real venues
          </button>
        </div>
        <input
          value={venueName}
          onChange={event => setVenueName(event.target.value)}
          placeholder="Venue name"
          className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
        />
        <input
          value={venueAddress}
          onChange={event => setVenueAddress(event.target.value)}
          placeholder="Address or meeting point"
          className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
        />
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-zinc-400">
            {locationLat !== null && locationLng !== null
              ? `Pinned ${locationLat.toFixed(4)}, ${locationLng.toFixed(4)}`
              : "Click the map or use your location to pin the venue"}
          </p>
          <button
            type="button"
            onClick={useCurrentLocation}
            className="text-xs font-semibold text-zinc-700 hover:text-zinc-900"
          >
            Use my location
          </button>
        </div>
        <MapPicker
          lat={locationLat}
          lng={locationLng}
          onChange={(lat, lng) => {
            setLocationLat(lat);
            setLocationLng(lng);
          }}
        />
        <p className="text-xs text-zinc-400">{priceHint}</p>
        {venues.length > 0 && (
          <div className="flex flex-col gap-2 pt-1">
            {venues.map(venue => (
              <button
                key={`${venue.name}-${venue.lat.toFixed(5)}-${venue.lng.toFixed(5)}`}
                type="button"
                onClick={() => {
                  setVenueName(venue.name);
                  setVenueAddress(venue.description);
                  setLocationLat(venue.lat);
                  setLocationLng(venue.lng);
                }}
                className="text-left rounded-xl border border-orange-100 bg-orange-50/60 p-3 hover:bg-orange-50 transition-colors"
              >
                <p className="text-sm font-semibold text-zinc-900">{venue.name}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{venue.description}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-zinc-700">Notes</label>
        <textarea
          value={notes}
          onChange={event => setNotes(event.target.value)}
          placeholder="Bring water, split court cost, meet near entrance..."
          rows={3}
          className="rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400 resize-none"
        />
      </div>

      <button
        onClick={createEvent}
        disabled={saving}
        className="flex items-center justify-center gap-2 h-11 rounded-xl bg-zinc-900 text-white text-sm font-semibold hover:bg-zinc-800 disabled:opacity-50 transition-colors"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarPlus className="w-4 h-4" />}
        {saving ? "Creating..." : "Create event"}
      </button>
    </div>
  );
}
