import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import FollowButton from "@/components/profile/FollowButton";
import FeedPost from "@/components/feed/FeedPost";
import { MapPin } from "lucide-react";

const SPORTS = [
  { id: "football", name: "Football", emoji: "⚽" }, { id: "basketball", name: "Basketball", emoji: "🏀" },
  { id: "tennis", name: "Tennis", emoji: "🎾" }, { id: "volleyball", name: "Volleyball", emoji: "🏐" },
  { id: "running", name: "Running", emoji: "🏃" }, { id: "cycling", name: "Cycling", emoji: "🚴" },
  { id: "swimming", name: "Swimming", emoji: "🏊" }, { id: "badminton", name: "Badminton", emoji: "🏸" },
  { id: "padel", name: "Padel", emoji: "🎱" }, { id: "hiking", name: "Hiking", emoji: "🥾" },
];

export default async function UserProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (id === user.id) redirect("/profile");

  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("user_id, full_name, bio, avatar_url, skill_level, location_name")
    .eq("user_id", id)
    .single();

  if (!profile) notFound();

  // Sports
  const { data: userSportsData } = await (supabase as any)
    .from("user_sports")
    .select("sports(name)")
    .eq("user_id", id);
  const userSportNames: string[] = ((userSportsData ?? []) as any[]).map(r => r.sports?.name).filter(Boolean);

  // Follower/following counts
  const { data: followerData } = await (supabase as any)
    .from("follows").select("follower_id").eq("following_id", id);
  const { data: followingData } = await (supabase as any)
    .from("follows").select("following_id").eq("follower_id", id);
  const { data: isFollowingData } = await (supabase as any)
    .from("follows").select("id").eq("follower_id", user.id).eq("following_id", id).maybeSingle();

  const followerCount = (followerData ?? []).length;
  const followingCount = (followingData ?? []).length;
  const isFollowing = !!isFollowingData;

  // Posts
  const { data: postsData } = await (supabase as any)
    .from("posts")
    .select("id, content, created_at, user_id, sport_id")
    .eq("user_id", id)
    .order("created_at", { ascending: false })
    .limit(20);

  const posts = (postsData ?? []) as any[];
  const sportIds = [...new Set(posts.map((p: any) => p.sport_id).filter(Boolean))];
  const { data: sportsData } = sportIds.length > 0
    ? await (supabase as any).from("sports").select("id, name, icon").in("id", sportIds)
    : { data: [] };
  const sportMap: Record<string, { name: string; icon: string }> = {};
  for (const s of (sportsData ?? []) as any[]) sportMap[s.id] = s;

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

  const enrichedPosts = posts.map((p: any) => ({
    ...p,
    profile: { full_name: (profile as any).full_name, avatar_url: (profile as any).avatar_url },
    sport: p.sport_id ? sportMap[p.sport_id] ?? null : null,
    likeCount: likeCountMap[p.id] ?? 0,
    likedByMe: myLikeSet.has(p.id),
  }));

  const p = profile as any;
  const initials = p.full_name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
  const SKILL_LABEL: Record<string, string> = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" };

  return (
    <div className="max-w-2xl mx-auto w-full p-8 flex flex-col gap-6">
      {/* Profile header */}
      <div className="flex items-start gap-5">
        {p.avatar_url
          ? <img src={p.avatar_url} alt={p.full_name} className="w-16 h-16 rounded-2xl object-cover shrink-0" />
          : <div className="w-16 h-16 rounded-2xl bg-zinc-900 flex items-center justify-center text-white text-xl font-bold shrink-0">{initials}</div>}
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-zinc-900">{p.full_name}</h1>
          {p.location_name && (
            <p className="text-sm text-zinc-500 flex items-center gap-1 mt-0.5">
              <MapPin className="w-3.5 h-3.5" /> {p.location_name}
            </p>
          )}
          <div className="flex items-center gap-4 mt-2 text-sm text-zinc-500">
            <span><strong className="text-zinc-900">{followerCount}</strong> followers</span>
            <span><strong className="text-zinc-900">{followingCount}</strong> following</span>
          </div>
        </div>
        <FollowButton targetUserId={id} currentUserId={user.id} initialFollowing={isFollowing} />
      </div>

      {p.bio && (
        <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200">
          <p className="text-sm text-zinc-700 leading-relaxed">{p.bio}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {p.skill_level && (
          <div className="p-3 rounded-xl border border-zinc-200">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1">Skill level</p>
            <p className="font-semibold text-zinc-900">{SKILL_LABEL[p.skill_level] ?? p.skill_level}</p>
          </div>
        )}
        {userSportNames.length > 0 && (
          <div className="p-3 rounded-xl border border-zinc-200 col-span-2">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">Sports</p>
            <div className="flex flex-wrap gap-2">
              {SPORTS.filter(s => userSportNames.includes(s.name)).map(s => (
                <span key={s.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-medium text-zinc-800">
                  {s.emoji} {s.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Posts */}
      <div>
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">Posts</p>
        {enrichedPosts.length === 0
          ? <p className="text-sm text-zinc-400">No posts yet.</p>
          : <div className="flex flex-col gap-3">
              {enrichedPosts.map((post: any) => (
                <FeedPost key={post.id} post={post} currentUserId={user.id} />
              ))}
            </div>}
      </div>
    </div>
  );
}
