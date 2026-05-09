import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ProfileView from "@/components/profile/ProfileView";
import FeedPost from "@/components/feed/FeedPost";
import CreatePost from "@/components/feed/CreatePost";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("full_name, bio, skill_level, location_name, location_lat, location_lng, avatar_url")
    .eq("user_id", user.id)
    .single();

  if (!profile) redirect("/profile/setup");

  // All available sports (real DB rows with UUIDs)
  const { data: allSports, error: sportsError } = await (supabase as any)
    .from("sports")
    .select("id, name, icon, min_players, max_players")
    .order("name");
  if (sportsError) console.error("[profile] sports fetch error:", sportsError.message, sportsError.code);

  // User's current sport UUIDs
  const { data: userSportsData } = await (supabase as any)
    .from("user_sports")
    .select("sport_id")
    .eq("user_id", user.id);
  const userSportIds: string[] = ((userSportsData ?? []) as any[]).map(r => r.sport_id);

  // Achievements
  const { data: achievementsData } = await (supabase as any)
    .from("achievements")
    .select("type, awarded_at")
    .eq("user_id", user.id);
  const achievements = (achievementsData ?? []) as { type: string; awarded_at: string }[];

  // Follower / following counts
  const { data: followerData } = await (supabase as any)
    .from("follows").select("follower_id").eq("following_id", user.id);
  const { data: followingData } = await (supabase as any)
    .from("follows").select("following_id").eq("follower_id", user.id);

  // Own posts
  const { data: postsData } = await (supabase as any)
    .from("posts").select("id, content, created_at, user_id, sport_id")
    .eq("user_id", user.id).order("created_at", { ascending: false }).limit(20);

  const posts = (postsData ?? []) as any[];
  const postSportIds = [...new Set(posts.map((p: any) => p.sport_id).filter(Boolean))];
  const { data: postSportsData } = postSportIds.length > 0
    ? await (supabase as any).from("sports").select("id, name, icon").in("id", postSportIds)
    : { data: [] };
  const sportMap: Record<string, { name: string; icon: string }> = {};
  for (const s of (postSportsData ?? []) as any[]) sportMap[s.id] = s;

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

  const p = profile as any;
  const enrichedPosts = posts.map((post: any) => ({
    ...post,
    profile: { full_name: p.full_name, avatar_url: p.avatar_url },
    sport: post.sport_id ? sportMap[post.sport_id] ?? null : null,
    likeCount: likeCountMap[post.id] ?? 0,
    likedByMe: myLikeSet.has(post.id),
  }));

  return (
    <div className="max-w-2xl mx-auto w-full p-8 flex flex-col gap-6">
      <ProfileView
        profile={profile}
        allSports={(allSports ?? []) as any[]}
        userSportIds={userSportIds}
        userId={user.id}
        followerCount={(followerData ?? []).length}
        followingCount={(followingData ?? []).length}
        achievements={achievements}
      >
        <div className="flex flex-col gap-6">
          <div>
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">Share something</p>
            <CreatePost userId={user.id} avatarUrl={p.avatar_url} fullName={p.full_name ?? ""} />
          </div>

          {enrichedPosts.length > 0 && (
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Your posts</p>
              {enrichedPosts.map((post: any) => (
                <FeedPost key={post.id} post={post} currentUserId={user.id} />
              ))}
            </div>
          )}
        </div>
      </ProfileView>
    </div>
  );
}
