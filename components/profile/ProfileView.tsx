"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Pencil, MapPin, Check, X, Camera, Loader2, Sparkles } from "lucide-react";
import { suggestSportsFromBio, suggestSportsFromImage } from "@/app/actions/suggest";
import { ACHIEVEMENT_META } from "@/lib/achievements";
import GeminiBioChat from "./GeminiBioChat";

const SKILL_LEVELS = [
  { value: "beginner",     label: "Beginner",     desc: "Just starting out" },
  { value: "intermediate", label: "Intermediate", desc: "Play regularly" },
  { value: "advanced",     label: "Advanced",     desc: "Compete seriously" },
];

interface DBSport {
  id: string;
  name: string;
  icon: string;
  min_players: number;
  max_players: number;
}

type MutationResult = Promise<{ error: { message: string } | null }>;

type ProfileTable = {
  upsert: (values: Record<string, unknown>, options?: Record<string, unknown>) => MutationResult;
  update: (values: Record<string, unknown>) => {
    eq: (column: string, value: string) => MutationResult;
  };
};

type UserSportsDeleteBuilder = {
  eq: (column: string, value: string) => MutationResult;
};

type UserSportsTable = {
  delete: () => UserSportsDeleteBuilder;
  insert: (values: Record<string, unknown>[]) => MutationResult;
};

type ProfileSupabaseTables = {
  from(table: "profiles"): ProfileTable;
  from(table: "user_sports"): UserSportsTable;
};

function prepareImageForAi(file: File): Promise<{ dataUrl: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const maxSize = 768;
      const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Could not read image"));
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve({ dataUrl: canvas.toDataURL("image/jpeg", 0.78), mimeType: "image/jpeg" });
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not read image"));
    };

    image.src = objectUrl;
  });
}

interface Props {
  profile: {
    full_name: string;
    bio: string | null;
    skill_level: string | null;
    location_name: string | null;
    location_lat: number | null;
    location_lng: number | null;
    avatar_url: string | null;
  };
  allSports: DBSport[];
  userSportIds: string[];
  userId: string;
  followerCount?: number;
  followingCount?: number;
  achievements?: { type: string; awarded_at: string }[];
  children?: React.ReactNode;
}

export default function ProfileView({
  profile, allSports, userSportIds, userId, followerCount = 0, followingCount = 0, achievements = [], children,
}: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [suggestingFromBio, setSuggestingFromBio] = useState(false);
  const [detectingFromPhoto, setDetectingFromPhoto] = useState(false);

  const [fullName, setFullName] = useState(profile.full_name);
  const [bio, setBio] = useState(profile.bio ?? "");
  const [skillLevel, setSkillLevel] = useState(profile.skill_level ?? "");
  const [locationName, setLocationName] = useState(profile.location_name ?? "");
  const [locationLat, setLocationLat] = useState<number | null>(profile.location_lat);
  const [locationLng, setLocationLng] = useState<number | null>(profile.location_lng);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? "");
  const allSportIds = new Set(allSports.map(s => s.id));
  const initialSelectedSportIds = userSportIds.filter(id => allSportIds.has(id));

  const [selectedSportIds, setSelectedSportIds] = useState<string[]>(initialSelectedSportIds);

  function toggleSport(id: string) {
    setSelectedSportIds(prev => prev.includes(id) ? prev.filter(sportId => sportId !== id) : [...prev, id]);
  }

  function cancelEdit() {
    setFullName(profile.full_name);
    setBio(profile.bio ?? "");
    setSkillLevel(profile.skill_level ?? "");
    setLocationName(profile.location_name ?? "");
    setLocationLat(profile.location_lat);
    setLocationLng(profile.location_lng);
    setSelectedSportIds(initialSelectedSportIds);
    setEditing(false);
  }

  function detectLocation() {
    if (!navigator.geolocation) { toast.error("Geolocation not supported"); return; }
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords;
        setLocationLat(latitude);
        setLocationLng(longitude);
        fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`)
          .then(r => r.json())
          .then(data => {
            const city = data.address?.city || data.address?.town || data.address?.village || data.address?.county || "Detected location";
            setLocationName(city);
          })
          .catch(() => setLocationName("Detected location"));
        toast.success("Location detected for nearby matching.");
      },
      () => toast.error("Couldn't get location")
    );
  }

  function applySportNameSuggestions(sportNames: string[]) {
    const suggestedIds = sportNames
      .map(name => allSports.find(sport => sport.name === name)?.id)
      .filter(Boolean) as string[];

    if (suggestedIds.length === 0) return 0;
    setSelectedSportIds(prev => [...new Set([...prev, ...suggestedIds])]);
    return suggestedIds.length;
  }

  async function suggestSportsFromCurrentBio() {
    if (!bio.trim()) {
      toast.error("Add a bio first so AI has something to analyze.");
      return;
    }

    setSuggestingFromBio(true);
    const suggestions = await suggestSportsFromBio(bio);
    const count = applySportNameSuggestions(suggestions);
    if (count === 0) {
      toast.info("AI did not find a clear sport in your bio.");
    } else {
      toast.success(`Suggested ${count} sport${count > 1 ? "s" : ""} from your bio.`);
    }
    setSuggestingFromBio(false);
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Photo must be under 5 MB"); return; }

    setUploadingAvatar(true);
    setDetectingFromPhoto(true);
    const supabase = createClient();
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${userId}/avatar-${Date.now()}.${ext}`;
    const aiImage = await prepareImageForAi(file).catch(() => null);

    const { error: uploadError } = await supabase.storage
      .from("avatars").upload(path, file, { upsert: true });

    if (uploadError) {
      toast.error("Upload failed: " + uploadError.message);
      setUploadingAvatar(false);
      setDetectingFromPhoto(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
    const db = supabase as unknown as ProfileSupabaseTables;

    const { error: profileError } = await db
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("user_id", userId);

    if (profileError) { toast.error("Couldn't save photo: " + profileError.message); }
    else {
      setAvatarUrl(publicUrl);
      toast.success("Photo updated!");
      router.refresh();
    }

    if (aiImage) {
      const suggestions = await suggestSportsFromImage(aiImage.dataUrl, aiImage.mimeType);
      const count = applySportNameSuggestions(suggestions);
      if (count > 0) {
        setEditing(true);
        toast.success(`AI detected ${count} sport${count > 1 ? "s" : ""} from your photo. Review and save.`);
      } else {
        toast.info("AI did not detect a clear sport from this photo.");
      }
    }

    setUploadingAvatar(false);
    setDetectingFromPhoto(false);
  }

  async function save() {
    if (!fullName.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    const supabase = createClient();
    const db = supabase as unknown as ProfileSupabaseTables;

    // 1. Save profile
    const { error: profileError } = await db.from("profiles").upsert(
      {
        user_id: userId,
        full_name: fullName.trim(),
        bio: bio.trim() || null,
        skill_level: skillLevel || null,
        location_name: locationName || null,
        location_lat: locationLat,
        location_lng: locationLng,
      },
      { onConflict: "user_id" }
    );
    if (profileError) { toast.error(profileError.message); setSaving(false); return; }

    // 2. Delete existing user_sports
    const { error: deleteErr } = await db
      .from("user_sports").delete().eq("user_id", userId);
    if (deleteErr) { toast.error("Couldn't clear sports: " + deleteErr.message); setSaving(false); return; }

    // 3. Save selected sports using real DB UUIDs from the server-rendered lookup.
    if (selectedSportIds.length > 0 && allSports.length === 0) {
      toast.error("Sports are not readable by the app. Check the sports SELECT policy in Supabase.");
      setSaving(false);
      return;
    }

    if (selectedSportIds.length > 0) {
      const { error: insertErr } = await db.from("user_sports").insert(
        selectedSportIds.map(sportId => ({
          user_id: userId,
          sport_id: sportId,
          skill_level: skillLevel || "beginner",
        }))
      );
      if (insertErr) { toast.error("Couldn't save sports: " + insertErr.message); setSaving(false); return; }
    }

    toast.success("Profile updated!");
    setSaving(false);
    setEditing(false);
    router.refresh();
  }

  const initials = (fullName || profile.full_name).split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const skillLabel = SKILL_LEVELS.find(s => s.value === skillLevel)?.label;
  const viewSports = allSports.filter(s => selectedSportIds.includes(s.id));

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-5">
          <div className="relative group shrink-0">
            {avatarUrl ? (
              <img src={avatarUrl} alt={fullName} className="w-16 h-16 rounded-2xl object-cover" />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-zinc-900 flex items-center justify-center text-white text-xl font-bold">
                {initials || "?"}
              </div>
            )}
            <button onClick={() => fileInputRef.current?.click()} disabled={uploadingAvatar}
              className="absolute inset-0 rounded-2xl bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
              {uploadingAvatar ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <Camera className="w-5 h-5 text-white" />}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </div>

          <div>
            <h1 className="text-2xl font-bold text-zinc-900">{profile.full_name}</h1>
            {profile.location_name && (
              <p className="text-sm text-blue-500 flex items-center gap-1 mt-0.5">
                <MapPin className="w-3.5 h-3.5" /> {profile.location_name}
              </p>
            )}
            <div className="flex items-center gap-4 mt-1.5 text-sm text-zinc-500">
              <span><strong className="text-zinc-900">{followerCount}</strong> followers</span>
              <span><strong className="text-zinc-900">{followingCount}</strong> following</span>
            </div>
          </div>
        </div>

        {!editing && (
          <button onClick={() => setEditing(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-zinc-600 text-sm font-medium text-zinc-900 hover:border-zinc-300 hover:bg-zinc-50 transition-all">
            <Pencil className="w-4 h-4" /> Edit
          </button>
        )}
      </div>

      {editing ? (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-1.5">
            <Label className="text-sm font-medium text-zinc-700">Full name *</Label>
            <Input value={fullName} onChange={e => setFullName(e.target.value)} className="h-11 border-zinc-200" />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-3">
              <Label className="text-sm font-medium text-zinc-700">Bio <span className="text-zinc-400 font-normal">(optional)</span></Label>
              <GeminiBioChat onBioGenerated={(generated) => setBio(generated)} />
            </div>
            <Textarea value={bio} onChange={e => setBio(e.target.value)} rows={3}
              className="border-zinc-200 resize-none" placeholder="Tell other players a bit about yourself…" />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-sm font-medium text-zinc-700">City</Label>
            <div className="flex gap-2">
              <Input value={locationName} onChange={e => setLocationName(e.target.value)}
                className="h-11 border-zinc-200 flex-1" placeholder="Cluj-Napoca" />
              <button
                type="button"
                onClick={detectLocation}
                className="h-11 px-4 rounded-lg border-2 border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 transition-all flex items-center gap-2 text-sm font-medium"
              >
                <MapPin className="w-4 h-4" />
                Detect
              </button>
            </div>
            {locationLat !== null && locationLng !== null && (
              <p className="text-xs text-green-600">Coordinates saved for nearby matching.</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-sm font-medium text-zinc-700">Skill level</Label>
            <div className="grid grid-cols-3 gap-2">
              {SKILL_LEVELS.map(s => (
                <button key={s.value} onClick={() => setSkillLevel(s.value)}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${skillLevel === s.value ? "border-zinc-900 bg-zinc-50" : "border-zinc-200 hover:border-zinc-300"}`}>
                  <p className="font-semibold text-zinc-900 text-sm">{s.label}</p>
                  <p className="text-zinc-500 text-xs">{s.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <Label className="text-sm font-medium text-zinc-700">Sports</Label>
              <button
                type="button"
                onClick={suggestSportsFromCurrentBio}
                disabled={suggestingFromBio}
                className="flex items-center gap-1.5 text-sm font-medium text-orange-600 hover:text-orange-700 disabled:opacity-50 transition-colors"
              >
                {suggestingFromBio ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {suggestingFromBio ? "Reading..." : "Suggest from bio"}
              </button>
            </div>
            {detectingFromPhoto && (
              <p className="text-xs text-orange-600">AI is checking your photo for sports...</p>
            )}
            {allSports.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {allSports.map(sport => {
                  const selected = selectedSportIds.includes(sport.id);
                  return (
                    <button key={sport.id} onClick={() => toggleSport(sport.id)}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${selected ? "border-zinc-900 bg-zinc-50" : "border-zinc-200 hover:border-zinc-300"}`}>
                      <span className="text-xl">{sport.icon}</span>
                      <span className="font-medium text-zinc-900 text-sm">{sport.name}</span>
                      {selected && <Check className="ml-auto w-4 h-4 text-zinc-900" />}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-zinc-500">Sports are not readable by the app. Check the sports SELECT policy in Supabase.</p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={save} disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-zinc-900 text-white text-sm font-semibold hover:bg-zinc-800 disabled:opacity-50 transition-colors">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {saving ? "Saving…" : "Save changes"}
            </button>
            <button onClick={cancelEdit} disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg border-2 border-zinc-200 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors">
              <X className="w-4 h-4" /> Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {profile.bio && (
            <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200">
              <p className="text-sm text-zinc-700 leading-relaxed">{profile.bio}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-zinc-200">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1">Skill level</p>
              <p className="font-semibold text-zinc-900">{skillLabel ?? "—"}</p>
            </div>
            <div className="p-4 rounded-xl border border-zinc-200">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1">Location</p>
              <p className="font-semibold text-zinc-900">{profile.location_name ?? "—"}</p>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">Sports</p>
            {viewSports.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {viewSports.map(sport => (
                  <div key={sport.name} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-medium text-zinc-800">
                    <span>{sport.icon}</span> {sport.name}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-400">No sports added yet. Click Edit to add some.</p>
            )}
          </div>

          {achievements.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">Achievements</p>
              <div className="flex flex-wrap gap-2">
                {achievements.map(a => {
                  const meta = ACHIEVEMENT_META[a.type];
                  if (!meta) return null;
                  return (
                    <div
                      key={a.type}
                      title={new Date(a.awarded_at).toLocaleDateString("en-GB", { dateStyle: "medium" })}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-sm font-medium text-amber-800"
                    >
                      <span>{meta.icon}</span> {meta.label}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Children (composer + posts) — hidden while editing */}
      {!editing && children}
    </div>
  );
}
