"use client";

import { CalendarPlus } from "lucide-react";

interface Props {
  title: string;
  scheduledAt: string;
  venueName: string | null;
  venueAddress: string | null;
  notes: string | null;
}

function pad(n: number) { return String(n).padStart(2, "0"); }

function toIcsDate(iso: string) {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

export default function IcsDownloadButton({ title, scheduledAt, venueName, venueAddress, notes }: Props) {
  function download() {
    const start = toIcsDate(scheduledAt);
    const end = toIcsDate(new Date(new Date(scheduledAt).getTime() + 2 * 3_600_000).toISOString());
    const location = [venueName, venueAddress].filter(Boolean).join(", ");
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//ShowUp2Move//EN",
      "BEGIN:VEVENT",
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:${title}`,
      location ? `LOCATION:${location}` : null,
      notes ? `DESCRIPTION:${notes.replace(/\n/g, "\\n")}` : null,
      "END:VEVENT",
      "END:VCALENDAR",
    ].filter(Boolean).join("\r\n");

    const blob = new Blob([lines], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/\s+/g, "-")}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      onClick={download}
      className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-700 transition-colors"
    >
      <CalendarPlus className="w-3.5 h-3.5" /> Add to calendar
    </button>
  );
}
