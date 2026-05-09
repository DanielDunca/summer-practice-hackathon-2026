"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

const syne = { fontFamily: "'Syne', sans-serif" };

/* ── Google SVG ── */
const GoogleIcon = () => (
  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

/* ── Eye tracking helpers ── */
interface EyeBallProps {
  size?: number;
  pupilSize?: number;
  maxDistance?: number;
  eyeColor?: string;
  pupilColor?: string;
  isBlinking?: boolean;
  forceLookX?: number;
  forceLookY?: number;
}

const EyeBall = ({ size = 48, pupilSize = 16, maxDistance = 10, eyeColor = "white", pupilColor = "black", isBlinking = false, forceLookX, forceLookY }: EyeBallProps) => {
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => setMouse({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", h);
    return () => window.removeEventListener("mousemove", h);
  }, []);

  const pos = (() => {
    if (forceLookX !== undefined && forceLookY !== undefined) return { x: forceLookX, y: forceLookY };
    if (!ref.current) return { x: 0, y: 0 };
    const r = ref.current.getBoundingClientRect();
    const dx = mouse.x - (r.left + r.width / 2);
    const dy = mouse.y - (r.top + r.height / 2);
    const d = Math.min(Math.sqrt(dx ** 2 + dy ** 2), maxDistance);
    const a = Math.atan2(dy, dx);
    return { x: Math.cos(a) * d, y: Math.sin(a) * d };
  })();

  return (
    <div ref={ref} className="rounded-full flex items-center justify-center transition-all duration-150"
      style={{ width: size, height: isBlinking ? 2 : size, backgroundColor: eyeColor, overflow: "hidden" }}>
      {!isBlinking && (
        <div className="rounded-full"
          style={{ width: pupilSize, height: pupilSize, backgroundColor: pupilColor, transform: `translate(${pos.x}px,${pos.y}px)`, transition: "transform 0.1s ease-out" }} />
      )}
    </div>
  );
};

interface PupilProps { size?: number; maxDistance?: number; pupilColor?: string; forceLookX?: number; forceLookY?: number; }
const Pupil = ({ size = 12, maxDistance = 5, pupilColor = "black", forceLookX, forceLookY }: PupilProps) => {
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => setMouse({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", h);
    return () => window.removeEventListener("mousemove", h);
  }, []);

  const pos = (() => {
    if (forceLookX !== undefined && forceLookY !== undefined) return { x: forceLookX, y: forceLookY };
    if (!ref.current) return { x: 0, y: 0 };
    const r = ref.current.getBoundingClientRect();
    const dx = mouse.x - (r.left + r.width / 2);
    const dy = mouse.y - (r.top + r.height / 2);
    const d = Math.min(Math.sqrt(dx ** 2 + dy ** 2), maxDistance);
    const a = Math.atan2(dy, dx);
    return { x: Math.cos(a) * d, y: Math.sin(a) * d };
  })();

  return (
    <div ref={ref} className="rounded-full"
      style={{ width: size, height: size, backgroundColor: pupilColor, transform: `translate(${pos.x}px,${pos.y}px)`, transition: "transform 0.1s ease-out" }} />
  );
};

/* ── Characters scene ── */
function Characters({ isTyping, password, showPassword }: { isTyping: boolean; password: string; showPassword: boolean }) {
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [purpleBlink, setPurpleBlink] = useState(false);
  const [blackBlink, setBlackBlink] = useState(false);
  const [lookingAtEachOther, setLookingAtEachOther] = useState(false);
  const [purplePeeking, setPurplePeeking] = useState(false);
  const purpleRef = useRef<HTMLDivElement>(null);
  const blackRef = useRef<HTMLDivElement>(null);
  const yellowRef = useRef<HTMLDivElement>(null);
  const orangeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => setMouse({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", h);
    return () => window.removeEventListener("mousemove", h);
  }, []);

  const scheduleBlink = (setter: (v: boolean) => void) => {
    const t = setTimeout(() => {
      setter(true);
      setTimeout(() => { setter(false); scheduleBlink(setter); }, 150);
    }, Math.random() * 4000 + 3000);
    return t;
  };

  useEffect(() => { const t = scheduleBlink(setPurpleBlink); return () => clearTimeout(t); }, []);
  useEffect(() => { const t = scheduleBlink(setBlackBlink); return () => clearTimeout(t); }, []);

  useEffect(() => {
    if (isTyping) {
      setLookingAtEachOther(true);
      const t = setTimeout(() => setLookingAtEachOther(false), 800);
      return () => clearTimeout(t);
    }
  }, [isTyping]);

  useEffect(() => {
    if (password.length > 0 && showPassword) {
      const t = setTimeout(() => {
        setPurplePeeking(true);
        setTimeout(() => setPurplePeeking(false), 800);
      }, Math.random() * 3000 + 2000);
      return () => clearTimeout(t);
    }
  }, [password, showPassword, purplePeeking]);

  const calcPos = (ref: React.RefObject<HTMLDivElement | null>) => {
    if (!ref.current) return { faceX: 0, faceY: 0, bodySkew: 0 };
    const rect = ref.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 3;
    const dx = mouse.x - cx;
    const dy = mouse.y - cy;
    return {
      faceX: Math.max(-15, Math.min(15, dx / 20)),
      faceY: Math.max(-10, Math.min(10, dy / 30)),
      bodySkew: Math.max(-6, Math.min(6, -dx / 120)),
    };
  };

  const pp = calcPos(purpleRef);
  const bp = calcPos(blackRef);
  const yp = calcPos(yellowRef);
  const op = calcPos(orangeRef);
  const hidingPassword = isTyping || (password.length > 0 && !showPassword);

  return (
    <div className="relative flex items-end justify-center" style={{ width: 550, height: 400 }}>
      {/* Purple — back */}
      <div ref={purpleRef} className="absolute bottom-0 transition-all duration-700 ease-in-out"
        style={{
          left: 70, width: 180,
          height: hidingPassword ? 440 : 400,
          backgroundColor: "#E8631A",
          borderRadius: "10px 10px 0 0", zIndex: 1,
          transform: (password.length > 0 && showPassword)
            ? "skewX(0deg)"
            : hidingPassword
              ? `skewX(${(pp.bodySkew || 0) - 12}deg) translateX(40px)`
              : `skewX(${pp.bodySkew || 0}deg)`,
          transformOrigin: "bottom center",
        }}>
        <div className="absolute flex gap-8 transition-all duration-700 ease-in-out"
          style={{
            left: (password.length > 0 && showPassword) ? 20 : lookingAtEachOther ? 55 : 45 + pp.faceX,
            top: (password.length > 0 && showPassword) ? 35 : lookingAtEachOther ? 65 : 40 + pp.faceY,
          }}>
          <EyeBall size={18} pupilSize={7} maxDistance={5} eyeColor="white" pupilColor="#1a1a1a" isBlinking={purpleBlink}
            forceLookX={(password.length > 0 && showPassword) ? (purplePeeking ? 4 : -4) : lookingAtEachOther ? 3 : undefined}
            forceLookY={(password.length > 0 && showPassword) ? (purplePeeking ? 5 : -4) : lookingAtEachOther ? 4 : undefined} />
          <EyeBall size={18} pupilSize={7} maxDistance={5} eyeColor="white" pupilColor="#1a1a1a" isBlinking={purpleBlink}
            forceLookX={(password.length > 0 && showPassword) ? (purplePeeking ? 4 : -4) : lookingAtEachOther ? 3 : undefined}
            forceLookY={(password.length > 0 && showPassword) ? (purplePeeking ? 5 : -4) : lookingAtEachOther ? 4 : undefined} />
        </div>
      </div>

      {/* Black — middle */}
      <div ref={blackRef} className="absolute bottom-0 transition-all duration-700 ease-in-out"
        style={{
          left: 240, width: 120, height: 310,
          backgroundColor: "#1a1a1a",
          borderRadius: "8px 8px 0 0", zIndex: 2,
          transform: (password.length > 0 && showPassword)
            ? "skewX(0deg)"
            : lookingAtEachOther
              ? `skewX(${(bp.bodySkew || 0) * 1.5 + 10}deg) translateX(20px)`
              : hidingPassword
                ? `skewX(${(bp.bodySkew || 0) * 1.5}deg)`
                : `skewX(${bp.bodySkew || 0}deg)`,
          transformOrigin: "bottom center",
        }}>
        <div className="absolute flex gap-6 transition-all duration-700 ease-in-out"
          style={{
            left: (password.length > 0 && showPassword) ? 10 : lookingAtEachOther ? 32 : 26 + bp.faceX,
            top: (password.length > 0 && showPassword) ? 28 : lookingAtEachOther ? 12 : 32 + bp.faceY,
          }}>
          <EyeBall size={16} pupilSize={6} maxDistance={4} eyeColor="white" pupilColor="#1a1a1a" isBlinking={blackBlink}
            forceLookX={(password.length > 0 && showPassword) ? -4 : lookingAtEachOther ? 0 : undefined}
            forceLookY={(password.length > 0 && showPassword) ? -4 : lookingAtEachOther ? -4 : undefined} />
          <EyeBall size={16} pupilSize={6} maxDistance={4} eyeColor="white" pupilColor="#1a1a1a" isBlinking={blackBlink}
            forceLookX={(password.length > 0 && showPassword) ? -4 : lookingAtEachOther ? 0 : undefined}
            forceLookY={(password.length > 0 && showPassword) ? -4 : lookingAtEachOther ? -4 : undefined} />
        </div>
      </div>

      {/* Orange semi-circle — front left */}
      <div ref={orangeRef} className="absolute bottom-0 transition-all duration-700 ease-in-out"
        style={{
          left: 0, width: 240, height: 200,
          backgroundColor: "#2D2D2D",
          borderRadius: "120px 120px 0 0", zIndex: 3,
          transform: (password.length > 0 && showPassword) ? "skewX(0deg)" : `skewX(${op.bodySkew || 0}deg)`,
          transformOrigin: "bottom center",
        }}>
        <div className="absolute flex gap-8 transition-all duration-200 ease-out"
          style={{
            left: (password.length > 0 && showPassword) ? 50 : 82 + (op.faceX || 0),
            top: (password.length > 0 && showPassword) ? 85 : 90 + (op.faceY || 0),
          }}>
          <Pupil size={12} maxDistance={5} pupilColor="white"
            forceLookX={(password.length > 0 && showPassword) ? -5 : undefined}
            forceLookY={(password.length > 0 && showPassword) ? -4 : undefined} />
          <Pupil size={12} maxDistance={5} pupilColor="white"
            forceLookX={(password.length > 0 && showPassword) ? -5 : undefined}
            forceLookY={(password.length > 0 && showPassword) ? -4 : undefined} />
        </div>
      </div>

      {/* Yellow pill — front right */}
      <div ref={yellowRef} className="absolute bottom-0 transition-all duration-700 ease-in-out"
        style={{
          left: 310, width: 140, height: 230,
          backgroundColor: "#E8D754",
          borderRadius: "70px 70px 0 0", zIndex: 4,
          transform: (password.length > 0 && showPassword) ? "skewX(0deg)" : `skewX(${yp.bodySkew || 0}deg)`,
          transformOrigin: "bottom center",
        }}>
        <div className="absolute flex gap-6 transition-all duration-200 ease-out"
          style={{
            left: (password.length > 0 && showPassword) ? 20 : 52 + (yp.faceX || 0),
            top: (password.length > 0 && showPassword) ? 35 : 40 + (yp.faceY || 0),
          }}>
          <Pupil size={12} maxDistance={5} pupilColor="#2D2D2D"
            forceLookX={(password.length > 0 && showPassword) ? -5 : undefined}
            forceLookY={(password.length > 0 && showPassword) ? -4 : undefined} />
          <Pupil size={12} maxDistance={5} pupilColor="#2D2D2D"
            forceLookX={(password.length > 0 && showPassword) ? -5 : undefined}
            forceLookY={(password.length > 0 && showPassword) ? -4 : undefined} />
        </div>
        <div className="absolute w-20 h-1 bg-zinc-800 rounded-full transition-all duration-200 ease-out"
          style={{
            left: (password.length > 0 && showPassword) ? 10 : 40 + (yp.faceX || 0),
            top: (password.length > 0 && showPassword) ? 88 : 88 + (yp.faceY || 0),
          }} />
      </div>
    </div>
  );
}

/* ── Main exported component ── */
export interface AuthPageProps { mode: "login" | "register"; }

export function AuthPage({ mode }: AuthPageProps) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  const isLogin = mode === "login";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { toast.error(error.message); }
      else { router.push("/home"); router.refresh(); }
    } else {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { data: { full_name: fullName } },
      });
      if (error) { toast.error(error.message); }
      else { toast.success("Account created! Set up your profile."); router.push("/profile/setup"); router.refresh(); }
    }
    setLoading(false);
  }

  async function handleGoogle() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/api/auth/callback` },
    });
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* ── Left panel ── */}
      <div className="relative hidden lg:flex flex-col justify-between bg-zinc-950 p-12 text-white overflow-hidden">
        {/* brand */}
        <div className="relative z-20">
          <span style={syne} className="text-xl font-extrabold tracking-tight text-white">ShowUp2Move</span>
        </div>

        {/* characters */}
        <div className="relative z-20 flex items-end justify-center h-[500px]">
          <Characters isTyping={isTyping} password={password} showPassword={showPassword} />
        </div>

        {/* tagline */}
        <div className="relative z-20">
          <p style={syne} className="text-3xl font-extrabold leading-tight text-white mb-2">
            Find your crew.<br /><span className="text-orange-400">Show up. Move.</span>
          </p>
          <p className="text-zinc-500 text-sm">Sports matching for people who'd rather play than plan.</p>
        </div>

        {/* decorative blobs */}
        <div className="absolute top-1/4 right-0 w-64 h-64 bg-orange-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 left-0 w-96 h-96 bg-zinc-800/40 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* ── Right panel ── */}
      <div className="relative flex items-center justify-center p-8 bg-white">
        <Link
          href="/"
          className="absolute top-6 right-6 z-20 inline-flex rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 transition-colors"
        >
          Go Back
        </Link>

        <div className="w-full max-w-[420px]">
          {/* mobile brand */}
          <div className="lg:hidden flex justify-center mb-10">
            <span style={syne} className="text-xl font-extrabold text-zinc-900">ShowUp2Move</span>
          </div>

          <div className="mb-8">
            <h1 style={syne} className="text-3xl font-extrabold text-zinc-900 mb-1">
              {isLogin ? "Welcome back" : "Create account"}
            </h1>
            <p className="text-zinc-500 text-sm">
              {isLogin ? "Log in to find your crew" : "Join and start moving today"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-sm font-medium text-zinc-700">Full name</Label>
                <Input id="name" placeholder="Alex Popescu" value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  onFocus={() => setIsTyping(true)} onBlur={() => setIsTyping(false)}
                  required className="h-11 border-zinc-200 focus:border-zinc-400" />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium text-zinc-700">Email</Label>
              <Input id="email" type="email" placeholder="you@example.com" value={email}
                onChange={e => setEmail(e.target.value)}
                onFocus={() => setIsTyping(true)} onBlur={() => setIsTyping(false)}
                required className="h-11 border-zinc-200 focus:border-zinc-400" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium text-zinc-700">Password</Label>
              <div className="relative">
                <Input id="password" type={showPassword ? "text" : "password"}
                  placeholder="••••••••" value={password} minLength={isLogin ? undefined : 8}
                  onChange={e => setPassword(e.target.value)}
                  required className="h-11 pr-10 border-zinc-200 focus:border-zinc-400" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 transition-colors">
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {isLogin && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox id="remember" />
                  <Label htmlFor="remember" className="text-sm font-normal text-zinc-600 cursor-pointer">Remember me</Label>
                </div>
                <a href="#" className="text-sm text-zinc-700 hover:underline font-medium">Forgot password?</a>
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full h-11 rounded-lg bg-zinc-900 text-white font-semibold text-sm hover:bg-zinc-800 disabled:opacity-60 transition-colors mt-2">
              {loading ? (isLogin ? "Signing in…" : "Creating account…") : (isLogin ? "Log in" : "Create account")}
            </button>
          </form>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-zinc-200" /></div>
            <div className="relative flex justify-center">
              <span className="bg-white px-3 text-xs text-zinc-400 uppercase tracking-wide">or</span>
            </div>
          </div>
          <button onClick={handleGoogle} type="button"
            className="w-full h-11 rounded-lg border-2 border-zinc-200 bg-white text-zinc-700 font-semibold text-sm hover:border-zinc-300 hover:bg-zinc-50 transition-colors flex items-center justify-center gap-2">
            <GoogleIcon />
            Continue with Google
          </button>

          <p className="text-center text-sm text-zinc-500 mt-7">
            {isLogin ? (
              <>No account?{" "}<Link href="/register" className="text-zinc-900 font-semibold hover:underline">Sign up</Link></>
            ) : (
              <>Already have an account?{" "}<Link href="/login" className="text-zinc-900 font-semibold hover:underline">Log in</Link></>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
