"use client";

import { motion } from "framer-motion";
import { MapPin, Zap, Users, CircleCheckBig } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
const syne = { fontFamily: "'Syne', sans-serif" };
const dm = { fontFamily: "'DM Sans', sans-serif" };

const sports = [
  { emoji: "⚽", name: "Football",   players: "2–14" },
  { emoji: "🏀", name: "Basketball", players: "2–10" },
  { emoji: "🎾", name: "Tennis",     players: "2–4" },
  { emoji: "🏐", name: "Volleyball", players: "2–12" },
  { emoji: "🏃", name: "Running",    players: "2–20" },
  { emoji: "🚴", name: "Cycling",    players: "2–20" },
  { emoji: "🏊", name: "Swimming",   players: "2–10" },
  { emoji: "🏸", name: "Badminton",  players: "2–4" },
  { emoji: "🎱", name: "Padel",      players: "2–4" },
  { emoji: "🥾", name: "Hiking",     players: "2–20" },
];

const features = [
  {
    icon: <Zap className="w-5 h-5" />,
    title: "Zero planning",
    desc: "No back-and-forth messages. No \"who's free?\" Just say yes — we handle the rest.",
  },
  {
    icon: <Users className="w-5 h-5" />,
    title: "Instant groups",
    desc: "Groups form automatically when enough players say yes. Football needs 10? We wait for 10.",
  },
  {
    icon: <MapPin className="w-5 h-5" />,
    title: "Always nearby",
    desc: "Matched only with players in your area so showing up is actually realistic.",
  },
];

const steps = [
  {
    n: "01",
    title: "Say yes to today",
    desc: "We ask once a day: ShowUpToday? One tap, pick your sport, you're in the pool.",
  },
  {
    n: "02",
    title: "Get auto-matched",
    desc: "Our algorithm groups you with nearby players at the right skill level automatically.",
  },
  {
    n: "03",
    title: "Show up & play",
    desc: "Get notified when your group is ready. Confirm the venue, then just show up.",
  },
];

const EASE: [number, number, number, number] = [0.23, 1, 0.32, 1];

function fadeUp(delay = 0) {
  return {
    initial: { opacity: 0, y: 28 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-80px" },
    transition: { delay, duration: 0.65, ease: EASE },
  };
}

export default function LandingPage() {
  return (
    <div style={dm} className="min-h-screen bg-white text-zinc-900 overflow-x-hidden">

      {/* ── Navbar ── */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 bg-white/90 backdrop-blur-md border-b border-zinc-200">
        <span style={syne} className="text-lg font-extrabold tracking-tight text-zinc-900">
          ShowUp2Move
        </span>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
          >
            Log in
          </Link>
          <Link
            href="/register"
                className="px-4 py-2 rounded-lg bg-zinc-900 text-white text-sm font-semibold hover:bg-zinc-800 transition-colors shadow-sm"
          >
            Get started
          </Link>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="min-h-screen flex flex-col items-center justify-center text-center px-6 pt-28 pb-20 max-w-4xl mx-auto">
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.75, ease: [0.23, 1, 0.32, 1] }}
            style={syne}
            className="text-7xl sm:text-8xl lg:text-9xl font-extrabold leading-none tracking-tight text-zinc-900 mb-8"
          >
            FIND YOUR<br />
            <span className="text-orange-500">CREW.</span><br />
            SHOW UP.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="text-zinc-600 text-xl leading-relaxed max-w-xl mb-10"
          >
            Say yes to playing today. Get instantly matched with nearby players who share your sport.
            No planning, no friction — just show up and move.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55, duration: 0.5 }}
            className="flex flex-col sm:flex-row gap-3 justify-center"
          >
            <Link
              href="/register"
              className="px-8 py-4 rounded-xl bg-zinc-900 text-white font-semibold text-sm text-center hover:bg-zinc-800 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-zinc-900/10"
            >
              Get started — it's free
            </Link>
            <Link
              href="/login"
              className="px-8 py-4 rounded-xl border-2 border-zinc-300 text-zinc-700 font-semibold text-sm text-center hover:border-zinc-400 hover:bg-zinc-50 transition-all"
            >
              Log in
            </Link>
          </motion.div>
      </section>

      {/* ── How it works ── */}
      <section className="py-28  px-6 bg-zinc-950 text-white">
        <div className="max-w-5xl mx-auto">
          <motion.div {...fadeUp()}>
            <span className="text-[11px] font-semibold tracking-widest uppercase text-zinc-500 mb-4 block">
              How it works
            </span>
            <h2 style={syne} className="text-4xl sm:text-5xl font-extrabold text-white mb-16 leading-none">
              Three steps.<br />That's it.
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {steps.map((s, i) => (
              <motion.div key={s.n} {...fadeUp(i * 0.1)} className="flex flex-col gap-5">
                <div
                  style={syne}
                  className="text-5xl font-extrabold text-orange-500 leading-none"
                >
                  {s.n}
                </div>
                <h3 style={syne} className="text-xl font-bold text-white">{s.title}</h3>
                <p className="text-zinc-400 leading-relaxed">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Sports grid ── */}
      <section className="py-28 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div {...fadeUp()} className="mb-14">
            <span className="text-[11px] font-semibold tracking-widest uppercase text-zinc-500 mb-4 block">
              Supported sports
            </span>
            <h2 style={syne} className="text-5xl font-extrabold text-zinc-900 leading-none">
              Any sport.<br />Any skill.
            </h2>
          </motion.div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {sports.map((sport, i) => (
              <motion.div
                key={sport.name}
                initial={{ opacity: 0, scale: 0.88 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.045, duration: 0.4 }}
                whileHover={{ y: -5, transition: { duration: 0.18 } }}
                className="flex flex-col items-center gap-2 p-5 rounded-2xl border border-zinc-200 hover:border-orange-200 hover:shadow-md transition-all cursor-default"
              >
                <span className="text-3xl">{sport.emoji}</span>
                <span className="font-semibold text-zinc-900 text-sm">{sport.name}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-28 px-6 bg-zinc-50">
        <div className="max-w-5xl mx-auto">
          <motion.div {...fadeUp()} className="mb-14">
            <span className="text-[11px] font-semibold tracking-widest uppercase text-zinc-500 mb-4 block">
              Why ShowUp2Move
            </span>
            <h2 style={syne} className="text-5xl font-extrabold text-zinc-900 leading-none">
              Built for<br />busy people.
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                {...fadeUp(i * 0.1)}
                className="p-8 rounded-2xl bg-white border border-zinc-200 hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
              >
                <div className="w-11 h-11 rounded-xl bg-zinc-900 flex items-center justify-center text-white mb-6">
                  {f.icon}
                </div>
                <h3 style={syne} className="text-xl font-bold text-zinc-900 mb-3">{f.title}</h3>
                <p className="text-zinc-600 leading-relaxed text-sm">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-36 px-6 bg-zinc-950 text-white text-center">
        <motion.div
          {...fadeUp()}
          className="max-w-2xl mx-auto flex flex-col items-center gap-8"
        >
          <Zap className="w-14 h-14 text-orange-500" strokeWidth={1.5} />
          <h2
            style={syne}
            className="text-6xl sm:text-7xl font-extrabold leading-none tracking-tight"
          >
            STOP PLANNING.<br />
            <span className="text-orange-500">START MOVING.</span>
          </h2>
          <p className="text-zinc-400 text-lg max-w-md leading-relaxed">
            Join ShowUp2Move and turn any free hour into a game with real people nearby.
          </p>
          <Link
            href="/register"
            className="px-10 py-5 rounded-xl bg-orange-500 text-white font-bold text-base hover:bg-orange-400 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-orange-500/20"
          >
            Create your free account →
          </Link>
        </motion.div>
      </section>
    </div>
  );
}
