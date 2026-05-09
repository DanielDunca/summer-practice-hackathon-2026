"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Heart } from "lucide-react";

interface Props {
  postId: string;
  initialCount: number;
  initialLiked: boolean;
  userId: string;
}

export default function LikeButton({ postId, initialCount, initialLiked, userId }: Props) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [pending, setPending] = useState(false);

  async function toggle() {
    if (pending) return;
    setPending(true);
    const supabase = createClient();

    if (liked) {
      setLiked(false);
      setCount(c => c - 1);
      await (supabase as any).from("post_likes").delete().eq("post_id", postId).eq("user_id", userId);
    } else {
      setLiked(true);
      setCount(c => c + 1);
      await (supabase as any).from("post_likes").insert({ post_id: postId, user_id: userId });
    }
    setPending(false);
  }

  return (
    <button
      onClick={toggle}
      className={`flex items-center gap-1.5 text-sm transition-colors ${liked ? "text-red-500" : "text-zinc-400 hover:text-red-400"}`}
    >
      <Heart className={`w-4 h-4 transition-all ${liked ? "fill-current scale-110" : ""}`} />
      <span className="font-medium">{count > 0 ? count : ""}</span>
    </button>
  );
}
