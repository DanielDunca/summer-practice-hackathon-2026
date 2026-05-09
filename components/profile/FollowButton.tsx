"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { UserPlus, UserCheck } from "lucide-react";
import { toast } from "sonner";

interface Props {
  targetUserId: string;
  currentUserId: string;
  initialFollowing: boolean;
}

export default function FollowButton({ targetUserId, currentUserId, initialFollowing }: Props) {
  const [following, setFollowing] = useState(initialFollowing);
  const [pending, setPending] = useState(false);

  async function toggle() {
    if (pending) return;
    setPending(true);
    const supabase = createClient();

    if (following) {
      setFollowing(false);
      await (supabase as any).from("follows").delete()
        .eq("follower_id", currentUserId).eq("following_id", targetUserId);
    } else {
      setFollowing(true);
      const { error } = await (supabase as any).from("follows").insert({
        follower_id: currentUserId,
        following_id: targetUserId,
      });
      if (error) { toast.error(error.message); setFollowing(false); }
    }
    setPending(false);
  }

  return (
    <button
      onClick={toggle}
      disabled={pending}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 ${
        following
          ? "border-2 border-zinc-200 text-zinc-600 hover:border-red-200 hover:text-red-500 hover:bg-red-50"
          : "bg-zinc-900 text-white hover:bg-zinc-800"
      }`}
    >
      {following
        ? <><UserCheck className="w-4 h-4" /> Following</>
        : <><UserPlus className="w-4 h-4" /> Follow</>}
    </button>
  );
}
