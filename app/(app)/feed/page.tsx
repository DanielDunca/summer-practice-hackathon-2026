import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import CreatePost from "@/components/feed/CreatePost";
import FeedPost from "@/components/feed/FeedPost";
import Link from "next/link";
import { Users } from "lucide-react";

export default async function FeedPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Own profile
  const { data: myProfile } = await (supabase as any)
    .from("profiles")
    .select("full_name, avatar_url")
    .eq("user_id", user.id)
    .single();

  // Who I follow
  const { data: followingData } = await (supabase as any)
    .from("follows")
    .select("following_id")
    .eq("follower_id", user.id);
  const followedIds = ((followingData ?? []) as any[]).map(f => f.following_id);

  // Who I've been matched with
  const { data: myGroupsData } = await (supabase as any)
    .from("group_members")
    .select("group_id")
    .eq("user_id", user.id);
  const myGroupIds = ((myGroupsData ?? []) as any[]).map(g => g.group_id);

  let matchedIds: string[] = [];
  if (myGroupIds.length > 0) {
    const { data: gmData } = await (supabase as any)
      .from("group_members")
      .select("user_id")
      .in("group_id", myGroupIds)
      .neq("user_id", user.id);
    matchedIds = [...new Set(((gmData ?? []) as any[]).map(g => g.user_id))];
  }

  const feedUserIds = [...new Set([user.id, ...followedIds, ...matchedIds])];

  // Fetch posts
  const { data: postsData } = await (supabase as any)
    .from("posts")
    .select("id, content, created_at, user_id, sport_id")
    .in("user_id", feedUserIds)
    .order("created_at", { ascending: false })
    .limit(40);

  const posts = (postsData ?? []) as any[];

  // Fetch profiles for all post authors
  const authorIds = [...new Set(posts.map((p: any) => p.user_id))];
  const { data: profilesData } = authorIds.length > 0
    ? await (supabase as any).from("profiles").select("user_id, full_name, avatar_url").in("user_id", authorIds)
    : { data: [] };

  const profileMap: Record<string, { full_name: string; avatar_url: string | null }> = {};
  for (const p of (profilesData ?? []) as any[]) profileMap[p.user_id] = p;

  // Fetch sports for tags
  const sportIds = [...new Set(posts.map((p: any) => p.sport_id).filter(Boolean))];
  const { data: sportsData } = sportIds.length > 0
    ? await (supabase as any).from("sports").select("id, name, icon").in("id", sportIds)
    : { data: [] };
  const sportMap: Record<string, { name: string; icon: string }> = {};
  for (const s of (sportsData ?? []) as any[]) sportMap[s.id] = s;

  // Fetch like counts + my likes
  const postIds = posts.map((p: any) => p.id);
  const { data: likesData } = postIds.length > 0
    ? await (supabase as any).from("post_likes").select("post_id, user_id").in("post_id", postIds)
    : { data: [] };

  const likeCountMap: Record<string, number> = {};
  const myLikeSet = new Set<string>();
  for (const l of (likesData ?? []) as any[]) {
    likeCountMap[l.post_id] = (likeCountMap[l.post_id] ?? 0) + 1;
    if (l.user_id === user.id) myLikeSet.add(l.post_id);
  }

  // Who to follow suggestions (matched but not yet followed)
  const notFollowed = matchedIds.filter(id => !followedIds.includes(id)).slice(0, 3);
  const { data: suggestData } = notFollowed.length > 0
    ? await (supabase as any).from("profiles").select("user_id, full_name, avatar_url").in("user_id", notFollowed)
    : { data: [] };

  const enrichedPosts = posts.map((p: any) => ({
    ...p,
    profile: profileMap[p.user_id] ?? { full_name: "Unknown", avatar_url: null },
    sport: p.sport_id ? sportMap[p.sport_id] ?? null : null,
    likeCount: likeCountMap[p.id] ?? 0,
    likedByMe: myLikeSet.has(p.id),
  }));

  return (
    <div className="max-w-5xl mx-auto w-full px-6 py-8 flex gap-8">
      {/* Main feed */}
      <div className="flex-1 min-w-0 flex flex-col gap-4">
        <CreatePost
          userId={user.id}
          avatarUrl={(myProfile as any)?.avatar_url}
          fullName={(myProfile as any)?.full_name ?? ""}
        />

        {enrichedPosts.length === 0 ? (
          <div className="py-16 text-center text-zinc-400">
            <p className="font-medium text-zinc-600 mb-1">Nothing here yet</p>
            <p className="text-sm">Follow players or get matched to see their posts.</p>
          </div>
        ) : (
          enrichedPosts.map((post: any) => (
            <FeedPost key={post.id} post={post} currentUserId={user.id} />
          ))
        )}
      </div>

      {/* Right sidebar */}
      <div className="w-64 shrink-0 hidden lg:flex flex-col gap-4">
        {(suggestData ?? []).length > 0 && (
          <div className="bg-white rounded-2xl border border-zinc-200 p-4">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">People you played with</p>
            <div className="flex flex-col gap-3">
              {((suggestData ?? []) as any[]).map(p => {
                const initials = p.full_name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
                return (
                  <div key={p.user_id} className="flex items-center gap-2.5">
                    <Link href={`/users/${p.user_id}`}>
                      {p.avatar_url
                        ? <img src={p.avatar_url} alt={p.full_name} className="w-8 h-8 rounded-full object-cover" />
                        : <div className="w-8 h-8 rounded-full bg-zinc-200 flex items-center justify-center text-xs font-bold text-zinc-600">{initials}</div>}
                    </Link>
                    <div className="flex-1 min-w-0">
                      <Link href={`/users/${p.user_id}`} className="text-sm font-medium text-zinc-800 hover:underline truncate block">
                        {p.full_name}
                      </Link>
                    </div>
                    <Link href={`/users/${p.user_id}`}
                      className="text-xs font-semibold text-zinc-900 hover:underline shrink-0">
                      View
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="bg-zinc-50 rounded-2xl border border-zinc-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-zinc-400" />
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Your network</p>
          </div>
          <p className="text-sm text-zinc-600">
            Following <span className="font-bold text-zinc-900">{followedIds.length}</span> ·{" "}
            Played with <span className="font-bold text-zinc-900">{matchedIds.length}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
