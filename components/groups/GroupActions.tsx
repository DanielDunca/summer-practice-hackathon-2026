"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { leaveGroup, deleteGroup } from "@/app/actions/match";
import { toast } from "sonner";
import { LogOut, Trash2 } from "lucide-react";

interface Props {
  groupId: string;
  isCaptain: boolean;
}

export default function GroupActions({ groupId, isCaptain }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    const result = isCaptain ? await deleteGroup(groupId) : await leaveGroup(groupId);
    if (result?.error) {
      toast.error(result.error);
      setLoading(false);
      setConfirming(false);
      return;
    }
    toast.success(isCaptain ? "Group deleted" : "You left the group");
    router.push("/groups");
    router.refresh();
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-500">{isCaptain ? "Delete for everyone?" : "Leave group?"}</span>
        <button
          onClick={handleConfirm}
          disabled={loading}
          className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-semibold hover:bg-red-600 disabled:opacity-50 transition-colors"
        >
          {loading ? "…" : "Confirm"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          disabled={loading}
          className="px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-500 text-xs font-semibold hover:bg-zinc-100 disabled:opacity-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-500 text-xs font-semibold hover:border-red-200 hover:text-red-500 hover:bg-red-50 transition-colors"
    >
      {isCaptain ? <Trash2 className="w-3.5 h-3.5" /> : <LogOut className="w-3.5 h-3.5" />}
      {isCaptain ? "Delete group" : "Leave group"}
    </button>
  );
}
