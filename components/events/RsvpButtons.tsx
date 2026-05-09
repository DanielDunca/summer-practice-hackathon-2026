"use client";

import { useState } from "react";
import { rsvpToEvent } from "@/app/actions/events";
import { toast } from "sonner";
import { Check, X } from "lucide-react";

interface Props {
  eventId: string;
  initialResponse: "going" | "not_going" | null;
  going: number;
  notGoing: number;
}

export default function RsvpButtons({ eventId, initialResponse, going, notGoing }: Props) {
  const [response, setResponse] = useState(initialResponse);
  const [counts, setCounts] = useState({ going, notGoing });
  const [loading, setLoading] = useState(false);

  async function respond(r: "going" | "not_going") {
    if (loading) return;
    setLoading(true);

    const prev = response;
    const prevCounts = { ...counts };

    // Optimistic update
    setResponse(r);
    setCounts(c => {
      const next = { ...c };
      if (prev === "going") next.going = Math.max(0, next.going - 1);
      if (prev === "not_going") next.notGoing = Math.max(0, next.notGoing - 1);
      if (r === "going") next.going++;
      else next.notGoing++;
      return next;
    });

    const result = await rsvpToEvent(eventId, r);
    if (result?.error) {
      toast.error(result.error);
      setResponse(prev);
      setCounts(prevCounts);
    }
    setLoading(false);
  }

  return (
    <div className="flex items-center gap-2 mt-2">
      <button
        onClick={() => respond("going")}
        disabled={loading}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-50 ${
          response === "going"
            ? "bg-green-500 text-white border-green-500"
            : "bg-white text-zinc-600 border-zinc-200 hover:border-green-400 hover:text-green-600"
        }`}
      >
        <Check className="w-3 h-3" /> Going · {counts.going}
      </button>
      <button
        onClick={() => respond("not_going")}
        disabled={loading}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-50 ${
          response === "not_going"
            ? "bg-red-500 text-white border-red-500"
            : "bg-white text-zinc-600 border-zinc-200 hover:border-red-400 hover:text-red-500"
        }`}
      >
        <X className="w-3 h-3" /> Not going · {counts.notGoing}
      </button>
    </div>
  );
}
