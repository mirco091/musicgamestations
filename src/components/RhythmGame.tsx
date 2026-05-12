import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, X, Trophy, RotateCcw, Pause } from 'lucide-react';

// ─── TYPES ───────────────────────────────────────────────────────────────────
type NoteType = 'tap' | 'hold' | 'flick';
type JudgeType = 'PERFECT' | 'GREAT' | 'GOOD' | 'MISS';
type GamePhase = 'idle' | 'countdown' | 'playing' | 'paused' | 'result';
type Difficulty = 'easy' | 'normal' | 'hard';

interface BeatNote {
  id: number; lane: number; time: number; // ms at hit zone
  type: NoteType; holdEnd?: number; flickDir?: 'left' | 'right';
}
interface LiveNote extends BeatNote {
  hit: boolean; missed: boolean;
  holdActive: boolean; holdComplete: boolean;
}
interface Particle {
  x: number; y: number; vx: number; vy: number;
  r: number; color: string; alpha: number; life: number;
}
interface TextFx { text: string; x: number; y: number; color: string; alpha: number; vy: number; size: number; }
interface RingFx { x: number; y: number; r: number; maxR: number; alpha: number; color: string; }
interface LaneFx { lane: number; alpha: number; color: string; }
interface RankEntry { name: string; score: number; acc: number; combo: number; grade: string; date: string; }

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const LANES = 4;
const LANE_KEYS = ['D', 'F', 'J', 'K'];
const KEY_MAP: Record<string, number> = { d: 0, f: 1, j: 2, k: 3 };
const FOV = 480;
const SPAWN_DEPTH = 850;
const FALL_MS_BASE = 1500;
const VP_Y_RATIO = 0.27;
const HIT_Y_RATIO = 0.80;
const LANE_W_RATIO = 0.68;
const NOTE_R_BASE = 42;
const HOLD_WIDTH = 38;
const TIMING = { PERFECT: 52, GREAT: 105, GOOD: 160 };
const SCORE_TABLE = { PERFECT: 1000, GREAT: 700, GOOD: 400, MISS: 0 };
const HP_MAX = 100;
const HP_MISS = 16;
const HP_HEAL_PERFECT = 1.2;
const HP_HEAL_GREAT = 0.6;
const FEVER_AT = 35;
const FEVER_MULTI = 2.0;

// ─── COLORS ──────────────────────────────────────────────────────────────────
const LANE_COLORS = ['#a855f7', '#ec4899', '#ec4899', '#a855f7'];
const NOTE_COLORS: Record<string, { ring: string; fill: string; glow: string }> = {
  tap:   { ring: '#c084fc', fill: '#f0abfc', glow: 'rgba(192,132,252,0.7)' },
  hold:  { ring: '#f472b6', fill: '#fda4af', glow: 'rgba(244,114,182,0.7)' },
  flick: { ring: '#fcd34d', fill: '#fef08a', glow: 'rgba(252,211,77,0.8)' },
};
const JUDGE_COLORS: Record<JudgeType, string> = {
  PERFECT: '#fcd34d', GREAT: '#86efac', GOOD: '#93c5fd', MISS: '#fca5a5'
};

// ─── BEATMAP ─────────────────────────────────────────────────────────────────
function buildBeatmap(diff: Difficulty): BeatNote[] {
  const bpm = 128;
  const b = 60000 / bpm;
  const h = b / 2; const q = b / 4;
  const notes: BeatNote[] = [];
  let id = 0;

  const tap = (t: number, l: number): BeatNote => ({ id: id++, lane: l, time: t, type: 'tap' });
  const hold = (t: number, l: number, dur: number): BeatNote =>
    ({ id: id++, lane: l, time: t, type: 'hold', holdEnd: t + dur });
  const flick = (t: number, l: number): BeatNote =>
    ({ id: id++, lane: l, time: t, type: 'flick', flickDir: l < 2 ? 'right' : 'left' });

  // Intro 3–9s
  let t = 3000;
  [0,2,1,3,0,2,1,3].forEach((l,i) => notes.push(tap(t+i*b, l)));
  if (diff !== 'easy') {
    notes.push(hold(t + 2*b, 1, b*2));
    notes.push(hold(t + 3*b, 2, b*2));
  }

  // Verse 1: 9–25s
  t = 9000;
  const v1 = [0,2,1,3,0,3,2,1,1,2,0,3,2,0,3,1,0,1,2,3,2,1,0,1,3,2,1,0,1,2,3,2];
  v1.forEach((l, i) => {
    if (diff === 'easy' && i % 2 !== 0) return;
    const isFlick = (i % 8 === 7);
    notes.push(isFlick ? flick(t + i*h, l) : tap(t + i*h, l));
  });
  if (diff !== 'easy') {
    notes.push(hold(t+8*h, 0, b)); notes.push(hold(t+14*h, 3, b));
  }
  if (diff === 'hard') {
    [4,12,20,28].forEach(i => { notes.push(tap(t+i*h, (v1[i]+2)%4)); });
  }

  // Pre-chorus: 25–33s
  t = 25000;
  const pc = [0,1,2,3,3,2,1,0,0,2,1,3,2,0,3,1];
  pc.forEach((l,i) => { if (diff === 'easy' && i%2!==0) return; notes.push(tap(t+i*h, l)); });
  notes.push(hold(t+6*h, 1, h)); notes.push(hold(t+10*h, 2, h));
  notes.push(tap(t+12*h, 0)); notes.push(tap(t+12*h, 3)); // chord

  // Chorus 1: 33–57s
  t = 33000;
  const c1a = [0,2,1,3,2,0,3,1,1,3,0,2,3,1,2,0,0,1,2,3,3,2,1,0,0,2,3,1,1,3,0,2,
               2,0,1,3,3,1,2,0,0,3,1,2,2,1,3,0,0,1,2,3,0,1,2,3,3,2,1,0,3,2,1,0,
               0,2,1,3,2,0,3,1,1,3,0,2,3,1,2,0,0,1,2,3,3,2,1,0,0,2,3,1,1,3,0,2];
  const step = diff === 'hard' ? q : (diff === 'normal' ? h : b);
  c1a.forEach((l, i) => {
    const tNote = t + i * step;
    if (tNote >= 57000) return;
    const isFlick = diff !== 'easy' && (i % 16 === 15);
    notes.push(isFlick ? flick(tNote, l) : tap(tNote, l));
  });
  // Holds in chorus
  if (diff !== 'easy') {
    [[2,0,b],[6,3,b],[12,1,b],[18,0,b],[22,3,b],[28,2,b]].forEach(([beats,l,dur]) =>
      notes.push(hold(t+beats*b, l, dur)));
  }

  // Bridge: 57–69s
  t = 57000;
  const brdg: [number,number][] = [[0,0],[b,2],[b*2,1],[b*3,3],[b*4,2],[b*4.5,0],[b*5,3],[b*6,1]];
  brdg.forEach(([dt,l]) => notes.push(tap(t+dt, l)));
  notes.push(hold(t, 1, b*3)); notes.push(hold(t+b*4, 2, b*3));
  [0,1,2,3].forEach((l,i) => notes.push(flick(t+(7+i*0.5)*b, l)));

  // Chorus 2: 69–93s (most intense)
  t = 69000;
  const c2 = [1,0,3,2,0,3,2,1,2,1,0,3,3,2,1,0,0,2,3,1,1,3,0,2,2,0,1,3,3,1,2,0,
              0,1,2,3,3,2,1,0,1,2,3,0,2,3,0,1,0,1,2,3,0,1,2,3,3,2,1,0,3,2,1,0,
              1,0,3,2,0,3,2,1,2,1,0,3,3,2,1,0,0,2,3,1,1,3,0,2,2,0,1,3,3,1,2,0];
  const step2 = diff === 'hard' ? q : (diff === 'normal' ? h : b);
  c2.forEach((l, i) => {
    const tNote = t + i * step2;
    if (tNote >= 93000) return;
    const isFlick = diff !== 'easy' && (i % 14 === 13);
    notes.push(isFlick ? flick(tNote, l) : tap(tNote, l));
  });
  if (diff !== 'easy') {
    [0,6,12,18,24,30].forEach(i => notes.push(hold(t+i*b, i%4<2?0:3, h)));
  }
  if (diff === 'hard') {
    [3,9,15,21,27,33].forEach(i => { notes.push(tap(t+i*b, 1)); notes.push(tap(t+i*b, 2)); });
  }

  // Outro: 93–end
  t = 93000;
  for (let i = 0; i < 12; i++) {
    notes.push(tap(t + i*b, i%4));
    if (i < 8 && diff !== 'easy') notes.push(tap(t + i*b + h, (i+2)%4));
  }
  [0,1,2,3].forEach((l,i) => notes.push(tap(t+12*b+i*q, l)));
  if (diff !== 'easy') [0,1,2,3].forEach(l => notes.push(tap(t+12*b+4*q, l)));

  return notes.sort((a, c) => a.time - c.time);
}

// ─── STORAGE ─────────────────────────────────────────────────────────────────
const RANK_KEY = 'mirco-ranking-v2';
const getRanking = (): RankEntry[] => { try { return JSON.parse(localStorage.getItem(RANK_KEY)||'[]'); } catch { return []; } };
const saveRanking = (e: RankEntry[]) => localStorage.setItem(RANK_KEY, JSON.stringify([...e].sort((a,b)=>b.score-a.score).slice(0,20)));
function getGrade(acc: number, noMiss: boolean): string {
  if (noMiss && acc === 100) return 'AP'; if (noMiss) return 'FC';
  if (acc >= 97) return 'S+'; if (acc >= 93) return 'S';
  if (acc >= 85) return 'A'; if (acc >= 70) return 'B';
  if (acc >= 50) return 'C'; return 'D';
}

// ─── PROJECTION ──────────────────────────────────────────────────────────────
function project(laneIdx: number, depth: number, W: number, H: number) {
  const vpX = W / 2; const vpY = H * VP_Y_RATIO; const hitY = H * HIT_Y_RATIO;
  const laneW = W * LANE_W_RATIO; const laneSpacing = laneW / LANES;
  const laneHitX = (laneIdx - (LANES-1)/2) * laneSpacing;
  const scale = FOV / (FOV + Math.max(0, depth));
  return {
    x: vpX + laneHitX * scale,
    y: vpY + (hitY - vpY) * scale,
    r: NOTE_R_BASE * scale,
    holdW: HOLD_WIDTH * scale,
    alpha: Math.min(1, (1 - depth / SPAWN_DEPTH) * 3),
    scale,
  };
}

function getLaneHitCenter(laneIdx: number, W: number): number {
  const laneW = W * LANE_W_RATIO; const laneSpacing = laneW / LANES;
  return W/2 + (laneIdx - (LANES-1)/2) * laneSpacing;
}

// ─── PARTICLES ───────────────────────────────────────────────────────────────
function spawnHitParticles(x: number, y: number, color: string, count: number): Particle[] {
  return Array.from({ length: count }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 6;
    return { x, y, vx: Math.cos(angle)*speed, vy: Math.sin(angle)*speed - 2,
      r: 3 + Math.random()*5, color, alpha: 1, life: 30 + Math.random()*30 };
  });
}

function spawnStarParticles(x: number, y: number): Particle[] {
  return Array.from({ length: 20 }, (_, i) => {
    const angle = (i / 20) * Math.PI * 2;
    const speed = 3 + Math.random() * 7;
    const colors = ['#fcd34d','#f0abfc','#a5f3fc','#ffffff'];
    return { x, y, vx: Math.cos(angle)*speed, vy: Math.sin(angle)*speed,
      r: 2 + Math.random()*4, color: colors[Math.floor(Math.random()*colors.length)],
      alpha: 1, life: 40 + Math.random()*40 };
  });
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function RhythmGame({ onClose }: { onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const animRef = useRef<number>(0);
  const phaseRef = useRef<GamePhase>('idle');
  const [phase, setPhase] = useState<GamePhase>('idle');
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [ranking, setRanking] = useState<RankEntry[]>(getRanking());
  const [nameInput, setNameInput] = useState('');
  const [saved, setSaved] = useState(false);
  const [resultData, setResultData] = useState({
    score: 0, acc: 0, maxCombo: 0, perfect: 0, great: 0, good: 0, miss: 0,
    grade: 'C', noMiss: false
  });
  const [countdown, setCountdown] = useState(3);
  const [isPaused, setIsPaused] = useState(false);

  // All mutable game state in refs (no re-renders during gameplay)
  const notesRef = useRef<LiveNote[]>([]);
  const nextIdxRef = useRef(0);
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const maxComboRef = useRef(0);
  const hpRef = useRef(HP_MAX);
  const perfectRef = useRef(0); const greatRef = useRef(0);
  const goodRef = useRef(0); const missRef = useRef(0);
  const feverRef = useRef(false);
  const particlesRef = useRef<Particle[]>([]);
  const textFxRef = useRef<TextFx[]>([]);
  const ringFxRef = useRef<RingFx[]>([]);
  const laneFxRef = useRef<LaneFx[]>([]);
  const bgStarsRef = useRef<Particle[]>([]);
  const pressedRef = useRef<boolean[]>([false,false,false,false]);
  const beatmapRef = useRef<BeatNote[]>([]);
  const diffRef = useRef<Difficulty>('normal');
  const fallMsRef = useRef(FALL_MS_BASE);
  const feverFlashRef = useRef(0);
  const prevTimeRef = useRef(0);

  // Init background stars
  useEffect(() => {
    bgStarsRef.current = Array.from({ length: 120 }, () => ({
      x: Math.random(), y: Math.random(),
      vx: (Math.random()-0.5)*0.0001, vy: Math.random()*0.0003+0.00005,
      r: Math.random()*1.5+0.3, color: '#ffffff',
      alpha: Math.random()*0.6+0.2, life: Infinity,
    }));
  }, []);

  // ── CANVAS DRAW ─────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const audio = audioRef.current;
    if (!canvas || !audio) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width; const H = canvas.height;
    const now = audio.currentTime * 1000;
    const vpX = W/2; const vpY = H*VP_Y_RATIO; const hitY = H*HIT_Y_RATIO;
    const laneW = W*LANE_W_RATIO; const laneSpacing = laneW/LANES;
    const isFever = feverRef.current;

    // ── Background ──
    const bgGrad = ctx.createLinearGradient(0,0,0,H);
    if (isFever) {
      bgGrad.addColorStop(0,'#1a0033'); bgGrad.addColorStop(0.5,'#0d0020'); bgGrad.addColorStop(1,'#000010');
    } else {
      bgGrad.addColorStop(0,'#0a0015'); bgGrad.addColorStop(0.5,'#050010'); bgGrad.addColorStop(1,'#00000a');
    }
    ctx.fillStyle = bgGrad; ctx.fillRect(0,0,W,H);

    // Stars
    ctx.save();
    bgStarsRef.current.forEach(s => {
      s.x += s.vx; s.y += s.vy;
      if (s.y > 1) { s.y = 0; s.x = Math.random(); }
      if (s.x < 0 || s.x > 1) { s.x = Math.random(); }
      ctx.globalAlpha = s.alpha * (isFever ? 1.5 : 1);
      ctx.fillStyle = isFever ? '#d8b4fe' : '#ffffff';
      ctx.beginPath(); ctx.arc(s.x*W, s.y*H, s.r, 0, Math.PI*2); ctx.fill();
    });
    ctx.restore();

    // Fever flash
    if (feverFlashRef.current > 0) {
      ctx.save();
      ctx.globalAlpha = feverFlashRef.current * 0.15;
      ctx.fillStyle = '#a855f7';
      ctx.fillRect(0,0,W,H);
      feverFlashRef.current = Math.max(0, feverFlashRef.current - 0.05);
      ctx.restore();
    }

    // ── Lane Grid (perspective) ──
    ctx.save();
    // Outer glow on lane edges
    for (let li = 0; li <= LANES; li++) {
      const laneHitX = vpX + (li - LANES/2) * laneSpacing;
      const vpScale = FOV / (FOV + SPAWN_DEPTH);
      const laneVpX = vpX + (li - LANES/2) * laneSpacing * vpScale;
      const grad = ctx.createLinearGradient(laneVpX, vpY, laneHitX, hitY);
      const col = isFever ? 'rgba(216,180,254,' : 'rgba(168,85,247,';
      grad.addColorStop(0, col+'0)'); grad.addColorStop(0.7, col+'0.15)'); grad.addColorStop(1, col+'0.5)');
      ctx.beginPath();
      ctx.moveTo(laneVpX, vpY); ctx.lineTo(laneHitX, hitY);
      ctx.strokeStyle = grad; ctx.lineWidth = li===0||li===LANES ? 2 : 1;
      ctx.stroke();
    }
    // Horizontal speed lines
    const numLines = 12;
    for (let li = 0; li < numLines; li++) {
      const frac = ((now * 0.001 * 0.4 + li/numLines) % 1);
      const depth = SPAWN_DEPTH * (1-frac);
      const scale = FOV/(FOV+depth);
      const lineY = vpY + (hitY-vpY) * scale;
      const x1 = vpX + (-laneW/2) * scale;
      const x2 = vpX + (laneW/2) * scale;
      const lineAlpha = frac * (1-frac) * 4 * (isFever ? 0.35 : 0.18);
      const col2 = isFever ? `rgba(216,180,254,${lineAlpha})` : `rgba(168,85,247,${lineAlpha})`;
      ctx.strokeStyle = col2; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x1,lineY); ctx.lineTo(x2,lineY); ctx.stroke();
    }
    ctx.restore();

    // ── Spawn / look-ahead notes ──
    const lookAhead = now + fallMsRef.current + 200;

    // Spawn new notes
    while (nextIdxRef.current < beatmapRef.current.length) {
      const bm = beatmapRef.current[nextIdxRef.current];
      if (bm.time - fallMsRef.current > now + 200) break;
      notesRef.current.push({ ...bm, hit: false, missed: false, holdActive: false, holdComplete: false });
      nextIdxRef.current++;
    }

    // Mark missed notes
    notesRef.current.forEach(n => {
      if (n.hit || n.missed) return;
      if (now > n.time + TIMING.GOOD + 60) {
        n.missed = true;
        missRef.current++;
        comboRef.current = 0; feverRef.current = false;
        hpRef.current = Math.max(0, hpRef.current - HP_MISS);
        // Miss text
        const hx = getLaneHitCenter(n.lane, W);
        textFxRef.current.push({ text:'MISS', x:hx, y:hitY-20, color:JUDGE_COLORS.MISS, alpha:1, vy:-1.2, size:22 });
      }
    });
    // Prune old notes
    notesRef.current = notesRef.current.filter(n => {
      if (n.hit || n.missed) {
        if (n.type==='hold' && n.holdEnd) return now < n.holdEnd + 300;
        return false;
      }
      return true;
    });

    // ── Draw hold note bodies ──
    ctx.save();
    notesRef.current.forEach(n => {
      if (n.type !== 'hold' || !n.holdEnd) return;
      const headDepth = (n.time - now) * SPAWN_DEPTH / fallMsRef.current;
      const tailDepth = (n.holdEnd - now) * SPAWN_DEPTH / fallMsRef.current;
      if (headDepth > SPAWN_DEPTH + 200) return;
      const h1 = project(n.lane, Math.max(0, headDepth), W, H);
      const h2 = project(n.lane, Math.max(0, tailDepth), W, H);
      const col = NOTE_COLORS.hold;
      const grad = ctx.createLinearGradient(h2.x, h2.y, h1.x, h1.y);
      grad.addColorStop(0, 'rgba(244,114,182,0)');
      grad.addColorStop(0.3, 'rgba(244,114,182,0.4)');
      grad.addColorStop(1, 'rgba(244,114,182,0.9)');
      ctx.beginPath();
      ctx.moveTo(h2.x-h2.holdW/2, h2.y); ctx.lineTo(h2.x+h2.holdW/2, h2.y);
      ctx.lineTo(h1.x+h1.holdW/2, h1.y); ctx.lineTo(h1.x-h1.holdW/2, h1.y);
      ctx.closePath();
      ctx.fillStyle = grad; ctx.fill();
      // Hold glow
      ctx.shadowBlur = 20; ctx.shadowColor = col.glow;
      ctx.strokeStyle = 'rgba(244,114,182,0.6)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.shadowBlur = 0;
    });
    ctx.restore();

    // ── Draw notes ──
    ctx.save();
    const drawNote = (n: LiveNote) => {
      if (n.missed) return;
      const depth = (n.time - now) * SPAWN_DEPTH / fallMsRef.current;
      if (depth > SPAWN_DEPTH + 50 || depth < (n.hit ? -60 : -20)) return;
      const p = project(n.lane, Math.max(depth, n.hit ? depth : 0), W, H);
      const col = NOTE_COLORS[n.type];
      const a = Math.min(1, p.alpha) * (n.hit ? Math.max(0, 1-(now-n.time)/200) : 1);
      if (a <= 0) return;
      ctx.globalAlpha = a;

      if (n.type === 'tap' || n.type === 'hold') {
        // Approach ring
        const approachFrac = Math.max(0, Math.min(1, 1-depth/SPAWN_DEPTH));
        const ringR = p.r + (1-approachFrac) * p.r * 1.8;
        ctx.beginPath(); ctx.arc(p.x, p.y, ringR, 0, Math.PI*2);
        ctx.strokeStyle = col.ring; ctx.lineWidth = 2.5*p.scale;
        ctx.globalAlpha = a * Math.min(1, approachFrac*3);
        ctx.stroke();

        // Glow
        ctx.shadowBlur = 30*p.scale; ctx.shadowColor = col.glow;
        // Outer circle
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
        ctx.strokeStyle = col.ring; ctx.lineWidth = 3*p.scale; ctx.globalAlpha = a; ctx.stroke();
        // Inner fill
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        grad.addColorStop(0, 'rgba(255,255,255,0.9)');
        grad.addColorStop(0.3, col.fill+'dd');
        grad.addColorStop(1, col.ring+'88');
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r-2, 0, Math.PI*2);
        ctx.fillStyle = grad; ctx.fill();
        // Center shine
        ctx.beginPath(); ctx.arc(p.x-p.r*0.28, p.y-p.r*0.3, p.r*0.28, 0, Math.PI*2);
        ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fill();
        ctx.shadowBlur = 0;
      } else if (n.type === 'flick') {
        // Flick note — diamond + arrow
        ctx.shadowBlur = 25*p.scale; ctx.shadowColor = col.glow;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y-p.r); ctx.lineTo(p.x+p.r, p.y);
        ctx.lineTo(p.x, p.y+p.r); ctx.lineTo(p.x-p.r, p.y); ctx.closePath();
        const dGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        dGrad.addColorStop(0, 'rgba(255,255,255,0.95)');
        dGrad.addColorStop(0.4, '#fef08a'); dGrad.addColorStop(1, '#fbbf24');
        ctx.fillStyle = dGrad; ctx.fill();
        ctx.strokeStyle = '#fcd34d'; ctx.lineWidth = 2.5*p.scale; ctx.stroke();
        // Arrows
        const dir = n.flickDir === 'right' ? 1 : -1;
        const aw = p.r*0.7; const ah = p.r*0.4;
        ctx.beginPath();
        ctx.moveTo(p.x + dir*p.r*0.35, p.y - ah);
        ctx.lineTo(p.x + dir*(p.r*0.35+aw), p.y);
        ctx.lineTo(p.x + dir*p.r*0.35, p.y + ah);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2*p.scale; ctx.lineJoin = 'round'; ctx.stroke();
        ctx.shadowBlur = 0;
      }
      ctx.globalAlpha = 1;
    };
    notesRef.current.forEach(drawNote);
    ctx.restore();

    // ── Hit zone ──
    ctx.save();
    const hitLineLeft = vpX - laneW/2;
    const hitLineRight = vpX + laneW/2;
    // Glow line
    const lineGrad = ctx.createLinearGradient(hitLineLeft, 0, hitLineRight, 0);
    lineGrad.addColorStop(0,'rgba(168,85,247,0)');
    lineGrad.addColorStop(0.2,'rgba(168,85,247,0.8)'); lineGrad.addColorStop(0.5,'rgba(255,255,255,1)');
    lineGrad.addColorStop(0.8,'rgba(236,72,153,0.8)'); lineGrad.addColorStop(1,'rgba(236,72,153,0)');
    ctx.beginPath(); ctx.moveTo(hitLineLeft, hitY); ctx.lineTo(hitLineRight, hitY);
    ctx.strokeStyle = lineGrad; ctx.lineWidth = 2.5; ctx.stroke();

    // Lane hit targets
    for (let li = 0; li < LANES; li++) {
      const cx = getLaneHitCenter(li, W);
      const isPressed = pressedRef.current[li];
      // Lane activation effect
      const lfx = laneFxRef.current.find(l => l.lane === li);
      if (lfx && lfx.alpha > 0) {
        const laneGrad = ctx.createLinearGradient(cx-laneSpacing/2, vpY, cx, hitY);
        laneGrad.addColorStop(0, `rgba(168,85,247,0)`);
        laneGrad.addColorStop(1, `rgba(168,85,247,${lfx.alpha*0.4})`);
        ctx.fillStyle = laneGrad;
        ctx.fillRect(cx-laneSpacing/2, vpY, laneSpacing, hitY-vpY);
        lfx.alpha -= 0.04;
      }
      // Target ring
      ctx.beginPath(); ctx.arc(cx, hitY, NOTE_R_BASE, 0, Math.PI*2);
      if (isPressed) {
        ctx.shadowBlur = 40; ctx.shadowColor = LANE_COLORS[li];
        ctx.strokeStyle = LANE_COLORS[li]; ctx.lineWidth = 4;
        ctx.fillStyle = `${LANE_COLORS[li]}33`; ctx.fill();
      } else {
        ctx.strokeStyle = `${LANE_COLORS[li]}60`; ctx.lineWidth = 2;
        ctx.fillStyle = `${LANE_COLORS[li]}10`; ctx.fill();
      }
      ctx.stroke(); ctx.shadowBlur = 0;
      // Key label
      ctx.fillStyle = isPressed ? '#fff' : 'rgba(255,255,255,0.35)';
      ctx.font = `bold ${Math.round(16*W/500)}px monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(LANE_KEYS[li], cx, hitY);
    }
    ctx.restore();

    // ── Rings ──
    ctx.save();
    ringFxRef.current = ringFxRef.current.filter(r => r.alpha > 0.01);
    ringFxRef.current.forEach(r => {
      ctx.globalAlpha = r.alpha;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI*2);
      ctx.strokeStyle = r.color; ctx.lineWidth = 3; ctx.stroke();
      r.r += (r.maxR - r.r) * 0.18 + 1.5;
      r.alpha *= 0.85;
    });
    ctx.restore();

    // ── Particles ──
    ctx.save();
    particlesRef.current = particlesRef.current.filter(p => p.life > 0);
    particlesRef.current.forEach(p => {
      ctx.globalAlpha = Math.max(0, p.alpha * (p.life / 60));
      ctx.fillStyle = p.color;
      ctx.shadowBlur = 8; ctx.shadowColor = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.1,p.r), 0, Math.PI*2); ctx.fill();
      p.x += p.vx; p.y += p.vy; p.vy += 0.18; p.vx *= 0.96;
      p.r *= 0.97; p.life--;
    });
    ctx.shadowBlur = 0; ctx.restore();

    // ── Text effects ──
    ctx.save();
    textFxRef.current = textFxRef.current.filter(t => t.alpha > 0.02);
    textFxRef.current.forEach(t => {
      ctx.globalAlpha = t.alpha;
      ctx.shadowBlur = 20; ctx.shadowColor = t.color;
      ctx.fillStyle = t.color;
      ctx.font = `bold ${Math.round(t.size * W/500)}px 'Helvetica Neue', sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(t.text, t.x, t.y);
      t.y += t.vy; t.alpha *= 0.91; t.vy *= 0.92;
    });
    ctx.shadowBlur = 0; ctx.restore();

    // ── HUD ──
    ctx.save();
    // Score
    const scoreText = scoreRef.current.toLocaleString();
    ctx.font = `bold ${Math.round(28*W/500)}px 'Helvetica Neue', sans-serif`;
    ctx.fillStyle = '#fff'; ctx.textAlign = 'right'; ctx.textBaseline = 'top';
    ctx.shadowBlur = 15; ctx.shadowColor = isFever ? '#a855f7' : '#7c3aed';
    ctx.fillText(scoreText, W-20, 18);
    ctx.shadowBlur = 0;
    ctx.font = `${Math.round(11*W/500)}px monospace`;
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillText('SCORE', W-20, 52);

    // Combo
    if (comboRef.current >= 3) {
      const cx2 = W/2;
      ctx.textAlign = 'center';
      const cSize = comboRef.current >= 100 ? 52 : comboRef.current >= 50 ? 44 : 36;
      ctx.font = `bold ${Math.round(cSize*W/500)}px 'Helvetica Neue', sans-serif`;
      ctx.shadowBlur = 30; ctx.shadowColor = isFever ? '#fcd34d' : '#f0abfc';
      ctx.fillStyle = isFever ? '#fcd34d' : '#f0abfc';
      ctx.fillText(`${comboRef.current}`, cx2, 22);
      ctx.font = `${Math.round(11*W/500)}px monospace`;
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.shadowBlur = 0;
      ctx.fillText('COMBO', cx2, 22 + cSize*W/500 + 4);
    }

    // HP bar
    const barW = Math.min(200, W*0.25); const barH = 10;
    const barX = 20; const barY = 20;
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.beginPath(); ctx.roundRect(barX, barY, barW, barH, 5); ctx.fill();
    const hpRatio = hpRef.current / HP_MAX;
    const hpColor = hpRatio > 0.5 ? '#86efac' : hpRatio > 0.25 ? '#fcd34d' : '#f87171';
    const hpGrad = ctx.createLinearGradient(barX, 0, barX+barW, 0);
    hpGrad.addColorStop(0, hpColor); hpGrad.addColorStop(1, '#ffffff');
    ctx.fillStyle = hpGrad;
    ctx.shadowBlur = 10; ctx.shadowColor = hpColor;
    ctx.beginPath(); ctx.roundRect(barX, barY, barW*hpRatio, barH, 5); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = `${Math.round(10*W/500)}px monospace`; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText('HP', barX, barY+barH+3);

    // Fever indicator
    if (isFever) {
      ctx.textAlign = 'left';
      ctx.font = `bold ${Math.round(18*W/500)}px 'Helvetica Neue', sans-serif`;
      ctx.fillStyle = '#fcd34d'; ctx.shadowBlur = 25; ctx.shadowColor = '#fcd34d';
      ctx.fillText('✦ FEVER ✦', 20, 46);
      ctx.shadowBlur = 0;
    }

    // Accuracy live
    const total = perfectRef.current + greatRef.current + goodRef.current + missRef.current;
    if (total > 0) {
      const acc = ((perfectRef.current + greatRef.current*0.7 + goodRef.current*0.4)/total*100).toFixed(1);
      ctx.textAlign = 'right'; ctx.textBaseline = 'top';
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.font = `${Math.round(12*W/500)}px monospace`;
      ctx.fillText(`ACC ${acc}%`, W-20, 56);
    }
    ctx.restore();
  }, []);

  // ── GAME LOOP ────────────────────────────────────────────────────────────────
  const gameLoop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || phaseRef.current !== 'playing') return;
    draw();
    if (audio.ended || (audio.duration > 0 && audio.currentTime >= audio.duration - 0.2)) {
      endGame(); return;
    }
    animRef.current = requestAnimationFrame(gameLoop);
  }, [draw]);

  const endGame = useCallback(() => {
    cancelAnimationFrame(animRef.current);
    phaseRef.current = 'result';
    setPhase('result');
    const total = perfectRef.current + greatRef.current + goodRef.current + missRef.current;
    const acc = total > 0 ? Math.round(((perfectRef.current + greatRef.current*0.7 + goodRef.current*0.4)/total)*100*10)/10 : 0;
    const noMiss = missRef.current === 0;
    setResultData({
      score: scoreRef.current, acc, maxCombo: maxComboRef.current,
      perfect: perfectRef.current, great: greatRef.current,
      good: goodRef.current, miss: missRef.current,
      grade: getGrade(acc, noMiss), noMiss
    });
    setSaved(false);
  }, []);

  // ── INPUT JUDGE ─────────────────────────────────────────────────────────────
  const judgeHit = useCallback((lane: number) => {
    if (phaseRef.current !== 'playing') return;
    const audio = audioRef.current; if (!audio) return;
    const now = audio.currentTime * 1000;
    const W = canvasRef.current?.width ?? 500;
    const H = canvasRef.current?.height ?? 700;
    const hitY = H * HIT_Y_RATIO;
    const hx = getLaneHitCenter(lane, W);

    // Find closest unhit note in lane
    let best: LiveNote | null = null; let bestDiff = Infinity;
    for (const n of notesRef.current) {
      if (n.lane !== lane || n.hit || n.missed) continue;
      const diff = Math.abs(now - n.time);
      if (diff < bestDiff && diff < TIMING.GOOD + 60) { bestDiff = diff; best = n; }
    }

    // Lane activation effect
    const existing = laneFxRef.current.find(l => l.lane === lane);
    if (existing) existing.alpha = 1; else laneFxRef.current.push({ lane, alpha: 1, color: LANE_COLORS[lane] });

    if (!best) {
      // No note nearby - ghost press
      ringFxRef.current.push({ x:hx, y:hitY, r:NOTE_R_BASE*0.5, maxR:NOTE_R_BASE*1.8, alpha:0.4, color:'rgba(255,255,255,0.3)' });
      return;
    }

    let judge: JudgeType;
    let scoreGain = 0;
    if (bestDiff <= TIMING.PERFECT) { judge = 'PERFECT'; scoreGain = SCORE_TABLE.PERFECT; perfectRef.current++; }
    else if (bestDiff <= TIMING.GREAT) { judge = 'GREAT'; scoreGain = SCORE_TABLE.GREAT; greatRef.current++; }
    else { judge = 'GOOD'; scoreGain = SCORE_TABLE.GOOD; goodRef.current++; }

    best.hit = true;
    if (best.type === 'hold') best.holdActive = true;
    comboRef.current++; if (comboRef.current > maxComboRef.current) maxComboRef.current = comboRef.current;
    feverRef.current = comboRef.current >= FEVER_AT;
    if (comboRef.current === FEVER_AT) feverFlashRef.current = 1;

    const multi = feverRef.current ? FEVER_MULTI : 1;
    const comboBonus = Math.min(comboRef.current, 200) * 3;
    scoreRef.current += Math.round((scoreGain + comboBonus) * multi);
    if (judge === 'PERFECT') hpRef.current = Math.min(HP_MAX, hpRef.current + HP_HEAL_PERFECT);
    if (judge === 'GREAT') hpRef.current = Math.min(HP_MAX, hpRef.current + HP_HEAL_GREAT);

    // Effects
    const hitY2 = H * HIT_Y_RATIO;
    particlesRef.current.push(...spawnHitParticles(hx, hitY2, NOTE_COLORS[best.type].glow, judge==='PERFECT'?14:8));
    if (judge === 'PERFECT') {
      particlesRef.current.push(...spawnStarParticles(hx, hitY2));
      ringFxRef.current.push({ x:hx, y:hitY2, r:NOTE_R_BASE, maxR:NOTE_R_BASE*3, alpha:0.9, color:NOTE_COLORS[best.type].ring });
      ringFxRef.current.push({ x:hx, y:hitY2, r:NOTE_R_BASE*0.5, maxR:NOTE_R_BASE*2.5, alpha:0.6, color:'rgba(255,255,255,0.8)' });
    } else {
      ringFxRef.current.push({ x:hx, y:hitY2, r:NOTE_R_BASE, maxR:NOTE_R_BASE*2.2, alpha:0.7, color:NOTE_COLORS[best.type].ring });
    }
    // Milestone effects
    if (comboRef.current % 50 === 0 && comboRef.current > 0) {
      particlesRef.current.push(...spawnStarParticles(W/2, H*0.5));
    }
    textFxRef.current.push({ text:judge, x:hx, y:hitY2-50, color:JUDGE_COLORS[judge], alpha:1, vy:-1.5, size:judge==='PERFECT'?24:20 });
  }, []);

  // ── HOLD RELEASE ────────────────────────────────────────────────────────────
  const judgeRelease = useCallback((lane: number) => {
    for (const n of notesRef.current) {
      if (n.lane===lane && n.type==='hold' && n.holdActive && !n.holdComplete) {
        n.holdComplete = true; n.holdActive = false;
        const audio = audioRef.current; if (!audio) return;
        const now = audio.currentTime * 1000;
        if (n.holdEnd && now >= n.holdEnd - TIMING.GOOD) {
          comboRef.current++; perfectRef.current++;
          scoreRef.current += 300 * (feverRef.current ? FEVER_MULTI : 1);
        }
      }
    }
  }, []);

  // ── START GAME ───────────────────────────────────────────────────────────────
  const startGame = useCallback((diff: Difficulty) => {
    const audio = audioRef.current; if (!audio) return;
    diffRef.current = diff;
    fallMsRef.current = diff === 'easy' ? 1900 : diff === 'normal' ? 1500 : 1200;
    beatmapRef.current = buildBeatmap(diff);
    notesRef.current = []; nextIdxRef.current = 0;
    scoreRef.current = 0; comboRef.current = 0; maxComboRef.current = 0;
    hpRef.current = HP_MAX; perfectRef.current = 0; greatRef.current = 0;
    goodRef.current = 0; missRef.current = 0; feverRef.current = false;
    particlesRef.current = []; textFxRef.current = []; ringFxRef.current = []; laneFxRef.current = [];
    pressedRef.current = [false,false,false,false];
    audio.currentTime = 0; audio.pause();
    phaseRef.current = 'countdown'; setPhase('countdown');
    let count = 3; setCountdown(count);
    const tick = setInterval(() => {
      count--; setCountdown(count);
      if (count <= 0) {
        clearInterval(tick);
        audio.play().catch(()=>{});
        phaseRef.current = 'playing'; setPhase('playing');
        animRef.current = requestAnimationFrame(gameLoop);
      }
    }, 1000);
  }, [gameLoop]);

  const restartGame = useCallback(() => {
    const audio = audioRef.current;
    if (audio) { audio.pause(); audio.currentTime = 0; }
    cancelAnimationFrame(animRef.current);
    startGame(diffRef.current);
  }, [startGame]);

  // ── KEYBOARD / TOUCH ────────────────────────────────────────────────────────
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === 'Escape') { if (phaseRef.current === 'playing') { phaseRef.current = 'paused'; setPhase('paused'); audioRef.current?.pause(); setIsPaused(true); } return; }
      const lane = KEY_MAP[e.key.toLowerCase()];
      if (lane === undefined) return;
      pressedRef.current[lane] = true;
      judgeHit(lane);
    };
    const up = (e: KeyboardEvent) => {
      const lane = KEY_MAP[e.key.toLowerCase()];
      if (lane === undefined) return;
      pressedRef.current[lane] = false;
      judgeRelease(lane);
    };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [judgeHit, judgeRelease]);

  // Canvas resize
  useEffect(() => {
    const resize = () => {
      const c = canvasRef.current; if (!c) return;
      c.width = c.offsetWidth; c.height = c.offsetHeight;
    };
    resize(); window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // Idle animation loop
  useEffect(() => {
    if (phase !== 'idle') return;
    let af: number;
    const idleLoop = () => {
      const c = canvasRef.current; if (!c) return;
      const ctx = c.getContext('2d'); if (!ctx) return;
      const W = c.width; const H = c.height;
      ctx.fillStyle = '#050010'; ctx.fillRect(0,0,W,H);
      bgStarsRef.current.forEach(s => {
        s.y += s.vy*0.5;
        if (s.y > 1) s.y = 0;
        ctx.globalAlpha = s.alpha*0.5;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(s.x*W, s.y*H, s.r, 0, Math.PI*2); ctx.fill();
      });
      ctx.globalAlpha = 1;
      af = requestAnimationFrame(idleLoop);
    };
    af = requestAnimationFrame(idleLoop);
    return () => cancelAnimationFrame(af);
  }, [phase]);

  // Cleanup
  useEffect(() => () => { cancelAnimationFrame(animRef.current); audioRef.current?.pause(); }, []);

  // Touch lane handlers
  const handleTouchLane = useCallback((lane: number, active: boolean) => {
    pressedRef.current[lane] = active;
    if (active) judgeHit(lane); else judgeRelease(lane);
  }, [judgeHit, judgeRelease]);

  const togglePause = useCallback(() => {
    const audio = audioRef.current;
    if (phaseRef.current === 'playing') {
      phaseRef.current = 'paused'; setPhase('paused'); audio?.pause(); setIsPaused(true);
      cancelAnimationFrame(animRef.current);
    } else if (phaseRef.current === 'paused') {
      phaseRef.current = 'playing'; setPhase('playing'); audio?.play().catch(()=>{});
      setIsPaused(false); animRef.current = requestAnimationFrame(gameLoop);
    }
  }, [gameLoop]);

  const saveScore = useCallback(() => {
    if (!nameInput.trim() || saved) return;
    const e: RankEntry = { name: nameInput.trim().slice(0,12), score: resultData.score, acc: resultData.acc, combo: resultData.maxCombo, grade: resultData.grade, date: new Date().toLocaleDateString('ja-JP') };
    const updated = [...getRanking(), e];
    saveRanking(updated);
    setRanking([...updated].sort((a,b)=>b.score-a.score).slice(0,20));
    setSaved(true);
  }, [nameInput, resultData, saved]);

  const gradeColor: Record<string,string> = { 'AP':'#fcd34d','FC':'#f0abfc','S+':'#fcd34d','S':'#fcd34d','A':'#86efac','B':'#93c5fd','C':'#fda4af','D':'#f87171' };

  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col" style={{ touchAction: 'none' }}>
      <audio ref={audioRef} src="/music/replay.mp3" preload="auto" />

      {/* Canvas — full screen */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-end px-4 py-3 pointer-events-none">
        <div className="flex items-center gap-3 pointer-events-auto">
          {phase === 'playing' && (
            <button onClick={togglePause} className="w-9 h-9 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 transition-all">
              <Pause className="w-4 h-4" />
            </button>
          )}
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/20 transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Touch lane buttons (overlaid on hit zone) */}
      {phase === 'playing' && (
        <div className="absolute bottom-0 left-0 right-0 h-24 flex" style={{ zIndex: 5 }}>
          {[0,1,2,3].map(li => (
            <div key={li} className="flex-1 h-full cursor-pointer select-none"
              onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); handleTouchLane(li, true); }}
              onPointerUp={() => handleTouchLane(li, false)}
              onPointerLeave={() => handleTouchLane(li, false)}
              onPointerCancel={() => handleTouchLane(li, false)}
            />
          ))}
        </div>
      )}

      {/* ── IDLE SCREEN ── */}
      <AnimatePresence>
        {phase === 'idle' && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="absolute inset-0 flex flex-col items-center justify-center z-10 px-4">
            <motion.div initial={{y:30,opacity:0}} animate={{y:0,opacity:1}} transition={{delay:0.2}} className="text-center mb-8">
              <div className="text-purple-400/60 font-mono text-xs tracking-[0.4em] mb-2 uppercase">Mirco Rhythm Project</div>
              <h1 className="text-5xl md:text-7xl font-bold text-white mb-1" style={{textShadow:'0 0 60px rgba(168,85,247,0.8)'}}>
                replay
              </h1>
              <div className="text-white/40 text-sm tracking-widest">（仮）— Chapter 01: Awakening</div>
            </motion.div>

            {/* Difficulty select */}
            <motion.div initial={{y:20,opacity:0}} animate={{y:0,opacity:1}} transition={{delay:0.4}} className="flex gap-3 mb-8">
              {(['easy','normal','hard'] as Difficulty[]).map(d => (
                <button key={d} onClick={() => setDifficulty(d)}
                  className={`px-6 py-2.5 rounded-full font-bold text-sm tracking-widest border-2 transition-all ${difficulty===d ? d==='easy'?'bg-green-500/20 border-green-400 text-green-300':d==='normal'?'bg-purple-500/20 border-purple-400 text-purple-300':'bg-red-500/20 border-red-400 text-red-300' : 'border-white/15 text-white/40 hover:border-white/30 hover:text-white/60'}`}>
                  {d.toUpperCase()}
                </button>
              ))}
            </motion.div>

            <motion.button initial={{y:20,opacity:0}} animate={{y:0,opacity:1}} transition={{delay:0.5}}
              whileHover={{scale:1.05}} whileTap={{scale:0.95}}
              onClick={() => startGame(difficulty)}
              className="px-14 py-5 rounded-full font-bold text-xl tracking-widest text-white mb-6 relative overflow-hidden"
              style={{background:'linear-gradient(135deg,#7c3aed,#db2777)',boxShadow:'0 0 50px rgba(168,85,247,0.5),0 0 100px rgba(168,85,247,0.2)'}}>
              <Play className="inline w-6 h-6 mr-3 fill-white" />PLAY
            </motion.button>

            <div className="flex gap-3 mb-8">
              {LANE_KEYS.map((k,i) => (
                <div key={i} className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-white/50 border border-white/20 bg-white/5 text-lg">{k}</div>
              ))}
            </div>
            <div className="text-white/25 text-xs tracking-widest text-center">D / F / J / K キー　または　タップ<br/>ESC でポーズ</div>

            {/* Mini ranking */}
            {ranking.length > 0 && (
              <motion.div initial={{opacity:0}} animate={{opacity:1}} transition={{delay:0.7}} className="mt-8 bg-white/5 border border-white/10 rounded-2xl p-4 w-full max-w-xs">
                <div className="flex items-center gap-2 mb-3"><Trophy className="w-4 h-4 text-yellow-400" /><span className="text-xs text-yellow-400 font-bold tracking-widest">TOP SCORES</span></div>
                {ranking.slice(0,5).map((r,i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-mono font-bold w-5 text-center ${i===0?'text-yellow-400':i===1?'text-gray-300':i===2?'text-amber-600':'text-white/30'}`}>#{i+1}</span>
                      <span className={`text-xs font-bold ${gradeColor[r.grade]||'text-white'}`}>{r.grade}</span>
                      <span className="text-white/70 text-sm">{r.name}</span>
                    </div>
                    <span className="font-mono text-purple-300 text-sm">{r.score.toLocaleString()}</span>
                  </div>
                ))}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── COUNTDOWN ── */}
      <AnimatePresence>
        {phase === 'countdown' && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
            <AnimatePresence mode="wait">
              <motion.div key={countdown} initial={{scale:2,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.5,opacity:0}} transition={{duration:0.4}}
                className="text-9xl font-bold text-white" style={{textShadow:'0 0 80px rgba(168,85,247,0.9)'}}>
                {countdown > 0 ? countdown : '▶'}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── PAUSE SCREEN ── */}
      <AnimatePresence>
        {phase === 'paused' && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="absolute inset-0 bg-black/70 backdrop-blur-md flex flex-col items-center justify-center z-20">
            <div className="text-4xl font-bold text-white mb-6" style={{textShadow:'0 0 30px rgba(168,85,247,0.8)'}}>PAUSED</div>
            <div className="flex gap-4">
              <button onClick={togglePause} className="px-8 py-3 rounded-full bg-purple-600 hover:bg-purple-500 text-white font-bold tracking-widest transition-colors">RESUME</button>
              <button onClick={restartGame} className="px-8 py-3 rounded-full border border-white/30 text-white/70 hover:text-white hover:border-white/60 font-bold tracking-widest transition-colors flex items-center gap-2"><RotateCcw className="w-4 h-4" />RETRY</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── RESULT SCREEN ── */}
      <AnimatePresence>
        {phase === 'result' && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="absolute inset-0 bg-black/80 backdrop-blur-xl flex items-center justify-center z-20 overflow-y-auto py-6">
            <motion.div initial={{y:50,opacity:0}} animate={{y:0,opacity:1}} transition={{delay:0.1}} className="w-full max-w-md mx-4 bg-black/60 border border-purple-500/30 rounded-3xl p-6 shadow-[0_0_80px_rgba(168,85,247,0.2)]">
              {/* Header */}
              <div className="text-center mb-5">
                <div className="text-purple-400/50 text-xs tracking-[0.4em] font-mono mb-1">RESULT</div>
                <div className="text-white/50 text-sm">{diffRef.current.toUpperCase()} / replay（仮）</div>
              </div>
              {/* Grade */}
              <div className="text-center mb-5">
                <motion.div initial={{scale:0}} animate={{scale:1}} transition={{delay:0.3,type:'spring',stiffness:200}}
                  className="text-8xl font-bold mb-1" style={{color:gradeColor[resultData.grade]||'#fff',textShadow:`0 0 60px ${gradeColor[resultData.grade]||'#fff'}`}}>
                  {resultData.grade}
                </motion.div>
                {resultData.noMiss && <div className="text-green-400 text-xs tracking-widest font-bold">✓ FULL COMBO</div>}
                <div className="font-mono text-3xl font-bold text-white mt-2">{resultData.score.toLocaleString()}</div>
                <div className="text-white/40 text-sm">Accuracy {resultData.acc}%</div>
              </div>
              {/* Stats */}
              <div className="grid grid-cols-4 gap-2 mb-4">
                {[{l:'PERFECT',v:resultData.perfect,c:'text-yellow-400'},{l:'GREAT',v:resultData.great,c:'text-green-400'},{l:'GOOD',v:resultData.good,c:'text-blue-400'},{l:'MISS',v:resultData.miss,c:'text-red-400'}].map((s,i)=>(
                  <div key={i} className="bg-white/5 rounded-xl p-2 text-center border border-white/5">
                    <div className={`font-mono text-lg font-bold ${s.c}`}>{s.v}</div>
                    <div className="text-[10px] text-white/30 tracking-wider mt-0.5">{s.l}</div>
                  </div>
                ))}
              </div>
              <div className="text-center text-xs text-white/30 mb-4">MAX COMBO <span className="text-pink-400 font-mono font-bold text-base">{resultData.maxCombo}x</span></div>

              {/* Save */}
              {!saved ? (
                <div className="flex gap-2 mb-4">
                  <input type="text" placeholder="名前 (MAX 12文字)" maxLength={12} value={nameInput}
                    onChange={e=>setNameInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')saveScore();}}
                    className="flex-1 bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-purple-400" />
                  <button onClick={saveScore} className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 rounded-xl text-white font-bold text-sm flex items-center gap-1 transition-colors">
                    <Trophy className="w-4 h-4" />登録
                  </button>
                </div>
              ) : (
                <div className="text-center text-green-400 text-sm mb-4 py-2 bg-green-400/10 rounded-xl border border-green-400/20">✓ ランキングに登録しました！</div>
              )}

              {/* Ranking */}
              {ranking.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2"><Trophy className="w-3.5 h-3.5 text-yellow-400" /><span className="text-[10px] font-bold tracking-widest text-yellow-400">RANKING</span></div>
                  <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                    {ranking.slice(0,10).map((r,i)=>(
                      <div key={i} className={`flex items-center justify-between py-1.5 px-3 rounded-lg text-xs ${saved&&r.name===nameInput&&r.score===resultData.score?'bg-purple-500/20 border border-purple-500/30':'bg-white/3'}`}>
                        <div className="flex items-center gap-2">
                          <span className={`font-mono font-bold w-4 text-center ${i===0?'text-yellow-400':i===1?'text-gray-300':i===2?'text-amber-600':'text-white/25'}`}>{i+1}</span>
                          <span className={`font-bold ${gradeColor[r.grade]||'text-white'} text-xs`}>{r.grade}</span>
                          <span className="text-white/70">{r.name}</span>
                        </div>
                        <span className="font-mono text-purple-300">{r.score.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button onClick={restartGame} className="w-full py-3.5 rounded-2xl font-bold text-base tracking-widest text-white flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
                style={{background:'linear-gradient(135deg,#7c3aed,#db2777)',boxShadow:'0 0 30px rgba(168,85,247,0.3)'}}>
                <RotateCcw className="w-5 h-5" />RETRY
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

