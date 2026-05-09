"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { respondToGroupInvite } from "@/app/actions/match";
import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";

interface Props {
  groupId: string;
}

export default function InviteActions({ groupId }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState<"confirmed" | "declined" | null>(null);

  async function respond(response: "confirmed" | "declined") {
    setPending(response);
    const result = await respondToGroupInvite(groupId, response);
    if (result?.error) {
      toast.error(result.error);
      setPending(null);
      return;
    }
    toast.success(response === "confirmed" ? "Group accepted" : "Group declined");
    router.refresh();
    setPending(null);
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => respond("confirmed")}
        disabled={pending !== null}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800 disabled:opacity-50"
      >
        {pending === "confirmed" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
        Accept
      </button>
      <button
        onClick={() => respond("declined")}
        disabled={pending !== null}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-500 text-xs font-semibold hover:bg-zinc-50 hover:text-red-500 disabled:opacity-50"
      >
        {pending === "declined" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
        Decline
      </button>
    </div>
  );
}
