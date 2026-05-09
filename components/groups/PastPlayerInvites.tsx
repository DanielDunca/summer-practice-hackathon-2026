"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { invitePlayerToGroup } from "@/app/actions/match";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

interface InviteCandidate {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface Props {
  groupId: string;
  candidates: InviteCandidate[];
  disabled?: boolean;
}

export default function PastPlayerInvites({ groupId, candidates, disabled = false }: Props) {
  const router = useRouter();
  const [inviting, setInviting] = useState<string | null>(null);

  async function invite(userId: string) {
    setInviting(userId);
    const result = await invitePlayerToGroup(groupId, userId);
    if (result?.error) {
      toast.error(result.error);
      setInviting(null);
      return;
    }

    toast.success("Invite sent");
    router.refresh();
    setInviting(null);
  }

  if (candidates.length === 0) {
    return (
      <div className="px-4 py-3 text-xs text-zinc-400">
        Previous teammates will appear here after you play in more groups.
      </div>
    );
  }

  return (
    <div className="py-2">
      {candidates.map(candidate => {
        const name = candidate.full_name ?? "Player";
        const initials = name.split(" ").map(word => word[0]).join("").slice(0, 2).toUpperCase();
        const isInviting = inviting === candidate.user_id;

        return (
          <div key={candidate.user_id} className="flex items-center gap-2.5 px-4 py-2.5">
            {candidate.avatar_url ? (
              <img src={candidate.avatar_url} alt={name} className="w-7 h-7 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-white border border-zinc-200 flex items-center justify-center text-xs font-bold text-zinc-600 shrink-0">
                {initials}
              </div>
            )}
            <p className="flex-1 min-w-0 text-sm font-medium text-zinc-800 truncate">{name}</p>
            <button
              onClick={() => invite(candidate.user_id)}
              disabled={disabled || inviting !== null}
              className="w-7 h-7 rounded-lg border border-zinc-200 bg-white text-zinc-500 flex items-center justify-center hover:border-zinc-400 hover:text-zinc-900 disabled:opacity-40"
              title={disabled ? "Group is full" : `Invite ${name}`}
            >
              {isInviting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            </button>
          </div>
        );
      })}
    </div>
  );
}
