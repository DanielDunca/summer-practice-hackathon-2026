"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createGroupFromPreview, joinExistingGroup, runMatching, type MatchResult } from "@/app/actions/match";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, CircleCheckBig, X, ArrowRight, Users, Clock, Loader2, ChevronRight, UserCircle2 } from "lucide-react";
import Link from "next/link";

const EASE: [number, number, number, number] = [0.23, 1, 0.32, 1];

interface Sport {
  id: string;
  name: string;
  icon: string;
  min_players: number;
  max_players: number;
}

interface Props {
  userSports: Sport[];
  today: string;
  existing: { id: string; is_available: boolean; sport_ids: string[] } | null;
}

export default function ShowUpToday({ userSports, today, existing }: Props) {
  const router = useRouter();
  const alreadyIn = existing?.is_available === true;

  const [selected, setSelected] = useState<string[]>(alreadyIn ? (existing?.sport_ids ?? []) : []);
  const [submitting, setSubmitting] = useState(false);
  const [matching, setMatching] = useState(false);
  const [done, setDone] = useState(alreadyIn);
  const [matchedGroups, setMatchedGroups] = useState<MatchResult[]>([]);
  const autoChecked = useRef(false);

  useEffect(() => {
    if (alreadyIn && !autoChecked.current) {
      autoChecked.current = true;
      runMatchCheck(existing?.sport_ids ?? []);
    }
  }, []);

  function toggle(id: string) {
    setSelected(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  }

  async function runMatchCheck(sportIds = selected) {
    setMatching(true);
    const { matched, error } = await runMatching(sportIds);
    if (error) {
      toast.error(error);
      setMatching(false);
      return;
    }

    if (matched.length === 0) {
      toast.info("You are in the pool. We will form a nearby group when enough players join.");
    } else {
      toast.success(`Group${matched.length > 1 ? "s" : ""} formed!`);
    }

    setMatchedGroups(matched);
    setMatching(false);
    router.refresh();
  }

  async function handleSubmit() {
    if (selected.length === 0) { toast.error("Pick at least one sport"); return; }
    setSubmitting(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await (supabase as any).from("availability").upsert(
      { user_id: user!.id, date: today, is_available: true, sport_ids: selected },
      { onConflict: "user_id,date" }
    );

    if (error) { toast.error(error.message); setSubmitting(false); return; }

    setDone(true);
    setSubmitting(false);
    await runMatchCheck(selected);
  }

  async function handleFindMatches() {
    await runMatchCheck();
  }

  async function handleJoinPreview(group: MatchResult) {
    if (group.groupId && group.currentUserStatus === "confirmed") {
      router.push(`/groups/${group.groupId}`);
      return;
    }

    if (group.groupId) {
      const result = await joinExistingGroup(group.groupId);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("You joined the group");
      router.push(`/groups/${group.groupId}`);
      router.refresh();
      return;
    }

    const memberIds = group.members.map(member => member.userId);
    const result = await createGroupFromPreview(group.sportId, memberIds);
    if (result?.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Group created");
    if ("groupId" in result && result.groupId) {
      router.push(`/groups/${result.groupId}`);
      router.refresh();
    }
  }

  async function handleDeclinePreview(previewId: string) {
    setMatchedGroups(prev => prev.filter(group => group.previewId !== previewId));
    toast.success("Preview dismissed");
  }

  async function handleWithdraw() {
    setSubmitting(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await (supabase as any).from("availability").upsert(
      { user_id: user!.id, date: today, is_available: false, sport_ids: [] },
      { onConflict: "user_id,date" }
    );

    if (error) { toast.error(error.message); setSubmitting(false); return; }

    setDone(false);
    setSelected([]);
    setMatchedGroups([]);
    setSubmitting(false);
    router.refresh();
  }

  const selectedSports = userSports.filter(s => selected.includes(s.id));

  return (
    <div className="max-w-lg mx-auto w-full px-4 py-12 flex flex-col items-center">
      <AnimatePresence mode="wait">

        {done ? (
          <motion.div
            key="confirmed"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="w-full flex flex-col items-center gap-6"
          >
            {/* Icon */}
            <div className="w-20 h-20 rounded-3xl bg-green-500 flex items-center justify-center">
              <CircleCheckBig className="w-10 h-10 text-white" strokeWidth={1.5} />
            </div>

            <div className="text-center">
              <h1 className="text-3xl font-extrabold text-zinc-900 mb-2">You&apos;re in the pool!</h1>
              <p className="text-zinc-500 text-sm">We&apos;ll match you when enough players show up for your sport.</p>
            </div>

            {/* Sports playing today */}
            <div className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl p-5 flex flex-col gap-3">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Playing today</p>
              <div className="flex flex-wrap gap-2">
                {selectedSports.map(s => (
                  <div key={s.id} className="flex items-center gap-2 px-3 py-2 bg-white border border-zinc-200 rounded-xl text-sm font-medium text-zinc-800">
                    <span>{s.icon}</span> {s.name}
                    <span className="text-zinc-400 text-xs">{s.min_players}–{s.max_players}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Status tiles */}
            <div className="w-full grid grid-cols-2 gap-3">
              <div className="flex items-center gap-3 p-4 rounded-xl border border-zinc-200 bg-white">
                <Users className="w-5 h-5 text-zinc-400 shrink-0" />
                <div>
                  <p className="text-xs text-zinc-400">Status</p>
                  <p className="text-sm font-semibold text-zinc-900">
                    {matching ? "Checking now…" : matchedGroups.length > 0 ? "Matched!" : "Waiting for players"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-xl border border-zinc-200 bg-white">
                <Clock className="w-5 h-5 text-zinc-400 shrink-0" />
                <div>
                  <p className="text-xs text-zinc-400">Valid until</p>
                  <p className="text-sm font-semibold text-zinc-900">Midnight</p>
                </div>
              </div>
            </div>

            {/* Matched groups */}
            {matchedGroups.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full flex flex-col gap-2"
              >
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Your groups</p>
                {matchedGroups.map(g => (
                  <div key={g.previewId} className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
                    <div className="flex items-center gap-4 p-4 border-b border-zinc-100">
                      <span className="text-2xl">{g.sportIcon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-zinc-900">{g.sport} group</p>
                        <p className="text-xs text-zinc-400">{g.memberCount} players matched · Captain: {g.captainName}</p>
                      </div>
                      <span className="text-xs font-medium px-2.5 py-1 rounded-full border border-zinc-200 text-zinc-500">
                        {g.currentUserStatus === "confirmed" ? "ready" : "invite"}
                      </span>
                    </div>

                    <div className="p-4 border-b border-zinc-100">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Members</p>
                        <Link href={`/groups/${g.groupId}`} className="text-xs font-medium text-zinc-500 hover:text-zinc-900">
                          Open group
                        </Link>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {g.members.map(member => (
                          <Link
                            key={member.userId}
                            href={`/users/${member.userId}`}
                            className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 hover:border-zinc-400 hover:bg-white transition-colors"
                          >
                            {member.avatarUrl ? (
                              <img src={member.avatarUrl} alt={member.fullName} className="w-8 h-8 rounded-full object-cover shrink-0" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-zinc-200 flex items-center justify-center text-zinc-500 shrink-0">
                                <UserCircle2 className="w-4 h-4" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-zinc-900 truncate">
                                {member.fullName}{member.isCurrentUser ? " (you)" : ""}
                              </p>
                              <p className="text-[10px] uppercase tracking-wide text-zinc-400">{member.status}</p>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>

                    <div className="p-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleJoinPreview(g)}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 text-white text-sm font-semibold hover:bg-zinc-800 transition-colors"
                        >
                          <ChevronRight className="w-4 h-4" />
                          {g.groupId ? (g.currentUserStatus === "confirmed" ? "Enter group" : "Join group") : "Create group"}
                        </button>
                        <button
                          onClick={() => handleDeclinePreview(g.previewId)}
                          className="px-4 py-2 rounded-xl border border-zinc-200 text-zinc-500 text-sm font-semibold hover:bg-zinc-50 hover:text-zinc-900 transition-colors"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}

            {/* Match trigger */}
            <button
              onClick={handleFindMatches}
              disabled={matching || submitting}
              className="flex items-center gap-2 w-full py-3.5 rounded-2xl border border-zinc-200 bg-white text-zinc-700 font-semibold text-sm justify-center hover:bg-zinc-50 disabled:opacity-50 transition-all"
            >
              {matching
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Checking pool…</>
                : <><Zap className="w-4 h-4" /> Check for updates</>}
            </button>

            <button
              onClick={handleWithdraw}
              disabled={submitting || matching}
              className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-600 transition-colors disabled:opacity-50"
            >
              <X className="w-4 h-4" /> I can&apos;t make it today
            </button>
          </motion.div>

        ) : (
          <motion.div
            key="picker"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="w-full flex flex-col gap-8"
          >
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-zinc-900 mb-5">
                <Zap className="w-7 h-7 text-orange-400" />
              </div>
              <h1 className="text-3xl font-extrabold text-zinc-900 mb-2">ShowUpToday?</h1>
              <p className="text-zinc-500">Pick what you&apos;re up for and we&apos;ll find your crew.</p>
            </div>

            {userSports.length === 0 ? (
              <div className="text-center py-10 text-zinc-400">
                <p className="text-sm">No sports on your profile yet.</p>
                <Link href="/profile" className="text-sm text-zinc-900 font-medium underline underline-offset-2 mt-1 inline-block">Add some sports →</Link>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {userSports.map((sport, i) => {
                  const isSelected = selected.includes(sport.id);
                  return (
                    <motion.button
                      key={sport.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.06, duration: 0.35, ease: EASE }}
                      onClick={() => toggle(sport.id)}
                      className={`flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all ${
                        isSelected ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white hover:border-zinc-300"
                      }`}
                    >
                      <span className="text-3xl">{sport.icon}</span>
                      <div className="flex-1">
                        <p className={`font-semibold ${isSelected ? "text-white" : "text-zinc-900"}`}>{sport.name}</p>
                        <p className={`text-xs ${isSelected ? "text-zinc-300" : "text-zinc-400"}`}>
                          {sport.min_players}–{sport.max_players} players
                        </p>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                        isSelected ? "border-white bg-white" : "border-zinc-300"
                      }`}>
                        {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-zinc-900" />}
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            )}

            <motion.button
              onClick={handleSubmit}
              disabled={submitting || selected.length === 0}
              whileTap={{ scale: 0.98 }}
              className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl bg-orange-500 text-white font-bold text-base hover:bg-orange-400 disabled:opacity-40 transition-all"
            >
              {submitting
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Getting you in…</>
                : <>I&apos;m in{selected.length > 0 && ` for ${selected.length} sport${selected.length > 1 ? "s" : ""}`} <ArrowRight className="w-4 h-4" /></>}
            </motion.button>

            {userSports.length > 0 && (
              <p className="text-center text-xs text-zinc-400">
                Only sports from your profile are shown. <Link href="/profile" className="text-zinc-600 underline underline-offset-2">Edit profile</Link>
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
