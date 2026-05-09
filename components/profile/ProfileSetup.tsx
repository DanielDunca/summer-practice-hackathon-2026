"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { MapPin, ChevronRight, Check, Loader2, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import GeminiBioChat from "./GeminiBioChat";
import { suggestSportsFromBio } from "@/app/actions/suggest";

const syne = { fontFamily: "'Syne', sans-serif" };
const EASE: [number, number, number, number] = [0.23, 1, 0.32, 1];

const SPORTS = [
  { id: "football",   name: "Football",   emoji: "⚽", min: 10, max: 14 },
  { id: "basketball", name: "Basketball", emoji: "🏀", min: 6,  max: 10 },
  { id: "tennis",     name: "Tennis",     emoji: "🎾", min: 2,  max: 4  },
  { id: "volleyball", name: "Volleyball", emoji: "🏐", min: 6,  max: 12 },
  { id: "running",    name: "Running",    emoji: "🏃", min: 1,  max: 20 },
  { id: "cycling",    name: "Cycling",    emoji: "🚴", min: 1,  max: 20 },
  { id: "swimming",   name: "Swimming",   emoji: "🏊", min: 1,  max: 10 },
  { id: "badminton",  name: "Badminton",  emoji: "🏸", min: 2,  max: 4  },
  { id: "padel",      name: "Padel",      emoji: "🎱", min: 2,  max: 4  },
  { id: "hiking",     name: "Hiking",     emoji: "🥾", min: 2,  max: 20 },
];

const SKILL_LEVELS = [
  { value: "beginner",     label: "Beginner",     desc: "Just starting out" },
  { value: "intermediate", label: "Intermediate", desc: "Play regularly" },
  { value: "advanced",     label: "Advanced",     desc: "Compete seriously" },
];

const STEPS = ["About you", "Your sports", "Location"];

type MutationResult = Promise<{ error: { message: string } | null }>;

type ProfileTable = {
  upsert: (values: Record<string, unknown>, options?: Record<string, unknown>) => MutationResult;
};

type SportsLookupResult = Promise<{ data: { id: string; name: string }[] | null; error: { message: string } | null }>;

type SportsLookupTable = {
  select: (columns: string) => {
    in: (column: string, values: string[]) => SportsLookupResult;
  };
};

type UserSportsTable = {
  insert: (values: Record<string, unknown>[]) => MutationResult;
};

type ProfileSetupSupabaseTables = {
  from(table: "profiles"): ProfileTable;
  from(table: "sports"): SportsLookupTable;
  from(table: "user_sports"): UserSportsTable;
};

export default function ProfileSetup() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [suggestingSports, setSuggestingSports] = useState(false);

  // Step 0
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [skillLevel, setSkillLevel] = useState("");

  // Step 1
  const [selectedSports, setSelectedSports] = useState<string[]>([]);

  // Step 2
  const [locationName, setLocationName] = useState("");
  const [locationLat, setLocationLat] = useState<number | null>(null);
  const [locationLng, setLocationLng] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);

  function toggleSport(id: string) {
    setSelectedSports(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  }

  function detectLocation() {
    if (!navigator.geolocation) { toast.error("Geolocation not supported"); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords;
        setLocationLat(latitude);
        setLocationLng(longitude);
        fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`)
          .then(r => r.json())
          .then(data => {
            const city = data.address?.city || data.address?.town || data.address?.village || "Your city";
            setLocationName(city);
          })
          .catch(() => setLocationName("Location detected"))
          .finally(() => setLocating(false));
      },
      () => { toast.error("Couldn't get location"); setLocating(false); }
    );
  }

  async function suggestSports() {
    if (!bio.trim()) {
      toast.error("Write a short bio first so AI has something to analyze.");
      setStep(0);
      return;
    }

    setSuggestingSports(true);
    const suggestions = await suggestSportsFromBio(bio);
    const suggestedIds = suggestions
      .map(name => SPORTS.find(sport => sport.name === name)?.id)
      .filter(Boolean) as string[];

    if (suggestedIds.length === 0) {
      toast.info("AI did not find a clear sport in your bio. Pick manually.");
    } else {
      setSelectedSports(prev => [...new Set([...prev, ...suggestedIds])]);
      toast.success(`Suggested ${suggestedIds.length} sport${suggestedIds.length > 1 ? "s" : ""} from your bio.`);
    }
    setSuggestingSports(false);
  }

  async function handleFinish() {
    if (!fullName.trim()) { toast.error("Please enter your name"); setStep(0); return; }
    if (selectedSports.length === 0) { toast.error("Pick at least one sport"); setStep(1); return; }

    setLoading(true);
    const supabase = createClient();
    const db = supabase as unknown as ProfileSetupSupabaseTables;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const { error: profileError } = await db.from("profiles").upsert(
      {
        user_id: user.id,
        full_name: fullName.trim(),
        bio: bio.trim() || null,
        skill_level: skillLevel || null,
        location_name: locationName || null,
        location_lat: locationLat,
        location_lng: locationLng,
      },
      { onConflict: "user_id" }
    );

    if (profileError) { toast.error(profileError.message); setLoading(false); return; }

    // Resolve sport names → IDs from the sports lookup table
    const sportNames = selectedSports
      .map((s: string) => SPORTS.find(sp => sp.id === s)?.name)
      .filter(Boolean) as string[];

    const { data: sportsData, error: sportsLookupError } = await db
      .from("sports")
      .select("id, name")
      .in("name", sportNames);

    if (sportsLookupError) {
      toast.error("Sports lookup failed: " + sportsLookupError.message);
      setLoading(false);
      return;
    }

    if (!sportsData || sportsData.length === 0) {
      toast.error(`Sports table empty or names don't match. Looking for: ${sportNames.join(", ")}`);
      setLoading(false);
      return;
    }

    if (sportsData && sportsData.length > 0) {
      const { error: sportsInsertError } = await db.from("user_sports").insert(
        sportsData.map((sport: { id: string }) => ({
          user_id: user.id,
          sport_id: sport.id,
          skill_level: skillLevel || "beginner",
        }))
      );
      if (sportsInsertError) {
        toast.error("Couldn't save sports: " + sportsInsertError.message);
        setLoading(false);
        return;
      }
    }

    toast.success("Profile created! Welcome to ShowUp2Move 🎉");
    router.push("/home");
  }

  const canProceed = [
    fullName.trim().length > 0,
    selectedSports.length > 0,
    true,
  ][step];

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-10">
          <span style={syne} className="text-2xl font-extrabold text-zinc-900">ShowUp2Move</span>
          <p className="text-zinc-500 text-sm mt-1">Set up your profile — takes 60 seconds</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-10">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`flex items-center gap-2 text-sm font-medium transition-colors ${i === step ? "text-zinc-900" : i < step ? "text-orange-500" : "text-zinc-300"}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${i === step ? "bg-zinc-900 text-white" : i < step ? "bg-orange-500 text-white" : "bg-zinc-100 text-zinc-400"}`}>
                  {i < step ? <Check className="w-3 h-3" /> : i + 1}
                </div>
                <span className="hidden sm:inline">{s}</span>
              </div>
              {i < STEPS.length - 1 && <div className={`flex-1 h-px w-8 ${i < step ? "bg-orange-300" : "bg-zinc-200"}`} />}
            </div>
          ))}
        </div>

        {/* Steps */}
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div key="step0"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.35, ease: EASE }}
              className="flex flex-col gap-5">
              <div>
                <h2 style={syne} className="text-3xl font-extrabold text-zinc-900 mb-1">About you</h2>
                <p className="text-zinc-500 text-sm">Tell other players who they&apos;re playing with</p>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-sm font-medium text-zinc-700">Full name *</Label>
                <Input placeholder="Alex Popescu" value={fullName} onChange={e => setFullName(e.target.value)}
                  className="h-11 border-zinc-200" />
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-zinc-700">Short bio <span className="text-zinc-400 font-normal">(optional)</span></Label>
                  <GeminiBioChat onBioGenerated={(generated) => setBio(generated)} />
                </div>
                <Textarea placeholder="e.g. Amateur footballer, run 5k twice a week, love Sunday games..." value={bio}
                  onChange={e => setBio(e.target.value)} rows={3}
                  className="border-zinc-200 resize-none" />
              </div>

              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium text-zinc-700">Overall skill level <span className="text-zinc-400 font-normal">(optional)</span></Label>
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
            </motion.div>
          )}

          {step === 1 && (
            <motion.div key="step1"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.35, ease: EASE }}
              className="flex flex-col gap-5">
              <div>
                <h2 style={syne} className="text-3xl font-extrabold text-zinc-900 mb-1">Your sports</h2>
                <p className="text-zinc-500 text-sm">Pick everything you&apos;re up for playing</p>
              </div>

              <button
                type="button"
                onClick={suggestSports}
                disabled={suggestingSports}
                className="flex items-center justify-center gap-2 rounded-xl border-2 border-orange-100 bg-orange-50 px-4 py-2.5 text-sm font-semibold text-orange-700 hover:bg-orange-100 disabled:opacity-50 transition-colors"
              >
                {suggestingSports ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                {suggestingSports ? "Reading bio..." : "Suggest sports from bio"}
              </button>

              <div className="grid grid-cols-2 gap-2">
                {SPORTS.map(sport => {
                  const selected = selectedSports.includes(sport.id);
                  return (
                    <button key={sport.id} onClick={() => toggleSport(sport.id)}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${selected ? "border-zinc-900 bg-zinc-50" : "border-zinc-200 hover:border-zinc-300"}`}>
                      <span className="text-2xl">{sport.emoji}</span>
                      <div>
                        <p className="font-semibold text-zinc-900 text-sm">{sport.name}</p>
                        <p className="text-zinc-400 text-xs">{sport.min}–{sport.max} players</p>
                      </div>
                      {selected && <div className="ml-auto w-4 h-4 rounded-full bg-zinc-900 flex items-center justify-center"><Check className="w-2.5 h-2.5 text-white" /></div>}
                    </button>
                  );
                })}
              </div>

              {selectedSports.length > 0 && (
                <p className="text-sm text-zinc-500">{selectedSports.length} sport{selectedSports.length > 1 ? "s" : ""} selected</p>
              )}
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="step2"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.35, ease: EASE }}
              className="flex flex-col gap-5">
              <div>
                <h2 style={syne} className="text-3xl font-extrabold text-zinc-900 mb-1">Your location</h2>
                <p className="text-zinc-500 text-sm">Used to match you with nearby players</p>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-sm font-medium text-zinc-700">City</Label>
                <div className="flex gap-2">
                  <Input placeholder="Cluj-Napoca" value={locationName} onChange={e => setLocationName(e.target.value)}
                    className="h-11 border-zinc-200 flex-1" />
                  <button onClick={detectLocation} disabled={locating}
                    className="h-11 px-4 rounded-lg border-2 border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 transition-all flex items-center gap-2 text-sm font-medium disabled:opacity-50">
                    <MapPin className="w-4 h-4" />
                    {locating ? "Detecting…" : "Detect"}
                  </button>
                </div>
                <p className="text-xs text-zinc-400">Your exact location is never shared with other players</p>
                {locationLat !== null && locationLng !== null && (
                  <p className="text-xs text-green-600">Location coordinates saved for nearby matching.</p>
                )}
              </div>

              <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200">
                <p className="text-sm font-semibold text-zinc-900 mb-1">You&apos;re almost in!</p>
                <p className="text-sm text-zinc-500">After this you can say yes to today&apos;s games and start getting matched with players near you.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Nav buttons */}
        <div className="flex justify-between mt-8">
          {step > 0 ? (
            <button onClick={() => setStep(s => s - 1)}
              className="px-5 py-2.5 rounded-lg border-2 border-zinc-200 text-zinc-600 font-medium text-sm hover:bg-zinc-50 transition-colors">
              Back
            </button>
          ) : <div />}

          {step < STEPS.length - 1 ? (
            <button onClick={() => setStep(s => s + 1)} disabled={!canProceed}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-zinc-900 text-white font-semibold text-sm hover:bg-zinc-800 disabled:opacity-40 transition-colors">
              Next <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={handleFinish} disabled={loading}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-orange-500 text-white font-semibold text-sm hover:bg-orange-400 disabled:opacity-50 transition-colors">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              {loading ? "Saving…" : "Finish setup"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
