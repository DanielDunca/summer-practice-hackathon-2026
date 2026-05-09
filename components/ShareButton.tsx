"use client";

import { Share2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  path: string;
  label?: string;
}

export default function ShareButton({ path, label = "Share" }: Props) {
  async function share() {
    const url = window.location.origin + path;
    if (typeof navigator !== "undefined" && navigator.share) {
      await navigator.share({ url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied!");
    }
  }

  return (
    <button
      onClick={share}
      className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-700 transition-colors"
    >
      <Share2 className="w-3.5 h-3.5" /> {label}
    </button>
  );
}
