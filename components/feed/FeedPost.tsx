import Link from "next/link";
import LikeButton from "./LikeButton";
import { timeAgo } from "@/lib/timeAgo";

interface Post {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  sport?: { name: string; icon: string } | null;
  profile: { full_name: string; avatar_url: string | null };
  likeCount: number;
  likedByMe: boolean;
}

interface Props {
  post: Post;
  currentUserId: string;
}

export default function FeedPost({ post, currentUserId }: Props) {
  const initials = post.profile.full_name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <article className="bg-white rounded-2xl border border-zinc-200 p-5 flex flex-col gap-3 hover:border-zinc-300 transition-colors">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={post.user_id === currentUserId ? "/profile" : `/users/${post.user_id}`}>
          {post.profile.avatar_url ? (
            <img src={post.profile.avatar_url} alt={post.profile.full_name}
              className="w-9 h-9 rounded-full object-cover shrink-0 hover:opacity-90 transition-opacity" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-zinc-900 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {initials}
            </div>
          )}
        </Link>
        <div className="flex-1 min-w-0">
          <Link href={post.user_id === currentUserId ? "/profile" : `/users/${post.user_id}`}
            className="font-semibold text-zinc-900 text-sm hover:underline underline-offset-2">
            {post.profile.full_name}
          </Link>
          <p className="text-xs text-zinc-400">{timeAgo(post.created_at)}</p>
        </div>
        {post.sport && (
          <span className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-zinc-50 border border-zinc-200 text-zinc-600 shrink-0">
            {post.sport.icon} {post.sport.name}
          </span>
        )}
      </div>

      {/* Content */}
      <p className="text-zinc-800 text-sm leading-relaxed whitespace-pre-wrap">{post.content}</p>

      {/* Footer */}
      <div className="flex items-center gap-4 pt-1">
        <LikeButton
          postId={post.id}
          initialCount={post.likeCount}
          initialLiked={post.likedByMe}
          userId={currentUserId}
        />
      </div>
    </article>
  );
}
