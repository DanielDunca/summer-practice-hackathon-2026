"use client";

import { useState } from "react";
import { createPoll, castVote } from "@/app/actions/events";
import { toast } from "sonner";
import { BarChart2, Plus, X } from "lucide-react";

interface PollOption {
  label: string;
  votes: number;
}

interface Poll {
  id: string;
  question: string;
  options: string[];
  myChoice: string | null;
  voteCounts: Record<string, number>;
  totalVotes: number;
}

interface Props {
  groupId: string;
  isCaptain: boolean;
  initialPolls: Poll[];
}

export default function PollSection({ groupId, isCaptain, initialPolls }: Props) {
  const [polls, setPolls] = useState<Poll[]>(initialPolls);
  const [creating, setCreating] = useState(false);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [saving, setSaving] = useState(false);
  const [voting, setVoting] = useState<string | null>(null);

  function addOption() {
    if (options.length < 4) setOptions(o => [...o, ""]);
  }

  function removeOption(i: number) {
    if (options.length <= 2) return;
    setOptions(o => o.filter((_, idx) => idx !== i));
  }

  async function submitPoll() {
    if (!question.trim()) { toast.error("Enter a question"); return; }
    const filled = options.filter(o => o.trim());
    if (filled.length < 2) { toast.error("Add at least 2 options"); return; }
    setSaving(true);
    const result = await createPoll(groupId, question.trim(), filled);
    if (result?.error) {
      toast.error(result.error);
    } else {
      toast.success("Poll created!");
      setPolls(prev => [{
        id: result.pollId,
        question: question.trim(),
        options: filled,
        myChoice: null,
        voteCounts: {},
        totalVotes: 0,
      }, ...prev]);
      setQuestion("");
      setOptions(["", ""]);
      setCreating(false);
    }
    setSaving(false);
  }

  async function vote(pollId: string, choice: string) {
    setVoting(pollId);
    const result = await castVote(pollId, choice);
    if (result?.error) {
      toast.error(result.error);
    } else {
      setPolls(prev => prev.map(p => {
        if (p.id !== pollId) return p;
        const prev_counts = { ...p.voteCounts };
        if (p.myChoice) prev_counts[p.myChoice] = Math.max(0, (prev_counts[p.myChoice] ?? 1) - 1);
        prev_counts[choice] = (prev_counts[choice] ?? 0) + 1;
        return {
          ...p,
          myChoice: choice,
          voteCounts: prev_counts,
          totalVotes: p.totalVotes + (p.myChoice ? 0 : 1),
        };
      }));
    }
    setVoting(null);
  }

  return (
    <div className="border-t border-zinc-200 pt-4 flex flex-col gap-4">
      <div className="flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-zinc-400" />
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Polls</p>
        </div>
        {isCaptain && !creating && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1 text-xs font-semibold text-orange-600 hover:text-orange-700"
          >
            <Plus className="w-3.5 h-3.5" /> New poll
          </button>
        )}
      </div>

      {creating && (
        <div className="mx-4 rounded-xl border border-zinc-200 bg-white p-4 flex flex-col gap-3">
          <input
            value={question}
            onChange={e => setQuestion(e.target.value)}
            placeholder="Ask the group something..."
            className="w-full h-9 rounded-lg border border-zinc-200 px-3 text-sm outline-none focus:border-zinc-400"
          />
          {options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={opt}
                onChange={e => setOptions(o => o.map((v, idx) => idx === i ? e.target.value : v))}
                placeholder={`Option ${i + 1}`}
                className="flex-1 h-9 rounded-lg border border-zinc-200 px-3 text-sm outline-none focus:border-zinc-400"
              />
              {options.length > 2 && (
                <button onClick={() => removeOption(i)} className="text-zinc-400 hover:text-zinc-600">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
          {options.length < 4 && (
            <button onClick={addOption} className="text-xs font-semibold text-zinc-500 hover:text-zinc-700 text-left">
              + Add option
            </button>
          )}
          <div className="flex gap-2 pt-1">
            <button
              onClick={submitPoll}
              disabled={saving}
              className="flex-1 h-9 rounded-lg bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800 disabled:opacity-50 transition-colors"
            >
              {saving ? "Creating..." : "Create poll"}
            </button>
            <button
              onClick={() => setCreating(false)}
              className="h-9 px-4 rounded-lg border border-zinc-200 text-xs font-semibold text-zinc-600 hover:bg-zinc-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {polls.length === 0 && !creating && (
        <p className="px-4 text-xs text-zinc-400">No polls yet{isCaptain ? " — create one to get a vote going." : "."}</p>
      )}

      {polls.map(poll => {
        const max = Math.max(...poll.options.map(o => poll.voteCounts[o] ?? 0), 1);
        return (
          <div key={poll.id} className="mx-4 rounded-xl border border-zinc-200 bg-white p-4 flex flex-col gap-2">
            <p className="text-sm font-semibold text-zinc-900">{poll.question}</p>
            {poll.options.map(opt => {
              const count = poll.voteCounts[opt] ?? 0;
              const pct = poll.totalVotes > 0 ? Math.round((count / poll.totalVotes) * 100) : 0;
              const chosen = poll.myChoice === opt;
              return (
                <button
                  key={opt}
                  onClick={() => vote(poll.id, opt)}
                  disabled={voting === poll.id}
                  className={`relative w-full text-left rounded-lg border px-3 py-2 text-sm overflow-hidden transition-colors disabled:opacity-60 ${chosen ? "border-zinc-800 bg-zinc-50" : "border-zinc-200 hover:border-zinc-300"}`}
                >
                  {poll.totalVotes > 0 && (
                    <span
                      className="absolute inset-y-0 left-0 rounded-lg bg-zinc-100 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  )}
                  <span className="relative flex items-center justify-between">
                    <span className={chosen ? "font-semibold text-zinc-900" : "text-zinc-700"}>{opt}</span>
                    {poll.totalVotes > 0 && (
                      <span className="text-xs text-zinc-400">{pct}%</span>
                    )}
                  </span>
                </button>
              );
            })}
            <p className="text-[10px] text-zinc-400">{poll.totalVotes} vote{poll.totalVotes !== 1 ? "s" : ""}</p>
          </div>
        );
      })}
    </div>
  );
}
