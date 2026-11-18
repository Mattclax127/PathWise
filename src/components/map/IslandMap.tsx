"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ART_BOXES, BACKGROUND_SVG, DEFS_SVG, LANDMARK_SVG } from "@/lib/map/artSvg";
import { SCENERY } from "@/lib/map/sceneryData";
import { MAP_H, MAP_W, ROAD_D, STAGE_F, headingAt, pointAt } from "@/lib/map/roadGeometry";
import type { MapModel, MapNode, NodeStatus } from "@/lib/map/mapModel";

const SYM: Record<string, [number, number, number, number]> = {
  palm: [-35, -68, 70, 86], tree: [-30, -62, 60, 80], shrub: [-25, -18, 50, 36], stone: [-25, -20, 50, 35], flower: [-15, -18, 30, 36],
};
const STATUS_TEXT: Record<NodeStatus, string> = {
  done: "Done", confirmed: "Confirmed outside PathWise", waiting: "Waiting on an outside party", next: "Your next step", upcoming: "Not yet",
};
const MAX_ZOOM = 4;
const ANIM_MS = 2200;

type View = { cx: number; cy: number; z: number };
const FULL: View = { cx: MAP_W / 2, cy: MAP_H / 2, z: 1 };
const clampView = (v: View): View => {
  const w = MAP_W / v.z, h = MAP_H / v.z;
  return { z: v.z, cx: Math.min(MAP_W - w / 2, Math.max(w / 2, v.cx)), cy: Math.min(MAP_H - h / 2, Math.max(h / 2, v.cy)) };
};
const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const safeGet = (k: string) => { try { return window.localStorage.getItem(k); } catch { return null; } };
const safeSet = (k: string, v: string) => { try { window.localStorage.setItem(k, v); } catch { /* storage unavailable: map still works */ } };

function Marker({ n, c, compact, selected, onPick }: { n: MapNode; c: number; compact: boolean; selected: boolean; onPick: () => void }) {
  const p = pointAt(n.f);
  const major = n.kind === "stage";
  const R = major ? 22 : 12;
  const label = `${major ? `Stage ${n.stage + 1}` : "Checkpoint"}: ${n.title}. ${n.pending ? "Not available yet" : STATUS_TEXT[n.status]}`;
  const s = n.status;
  return (
    <g transform={`translate(${p.x} ${p.y}) scale(${c})`} role="button" tabIndex={0} aria-label={label} aria-pressed={selected} className="pwm-hit"
      onClick={onPick} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(); } }}>
      <circle r={R + 8} fill="transparent" />
      {selected && <circle r={R + 7} fill="none" stroke="#14284B" strokeWidth={2} strokeDasharray="3 4" />}
      {s === "done" && <><circle r={R} fill="#35AF94" stroke="#fff" strokeWidth={4} /><path d={`M${-R * 0.45} 0l${R * 0.3} ${R * 0.32} ${R * 0.62}-${R * 0.75}`} stroke="#fff" strokeWidth={major ? 5 : 3} fill="none" strokeLinecap="round" /></>}
      {s === "confirmed" && <path d={`M0 ${-R - 4}L${R + 4} 0 0 ${R + 4}-${R + 4} 0Z`} fill="#FFC85A" stroke="#14284B" strokeWidth={3} />}
      {s === "waiting" && <circle r={R + 3} fill="#fff" stroke="#FF8670" strokeWidth={5} strokeDasharray="6 5" />}
      {s === "next" && <><circle className="pwm-pulse" r={R + 10} fill="#3478F6" opacity={0.35} /><circle r={R} fill="#fff" stroke="#3478F6" strokeWidth={5} /></>}
      {s === "upcoming" && <circle r={R} fill="#fff" stroke="#7f93a3" strokeWidth={3.5} opacity={0.95} />}
      {major && compact && <text y={6} textAnchor="middle" fontSize={17} fontWeight={800} fill={s === "done" || s === "confirmed" ? "#14284B" : "#14284B"}>{s === "done" ? "" : n.stage + 1}</text>}
    </g>
  );
}

export default function IslandMap({ model, journeyId }: { model: MapModel; journeyId: string }) {
  const { nodes, stages, characterF, characterIndex, finished } = model;
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1000);
  const [view, setView] = useState<View>(FULL);
  const [following, setFollowing] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [shownF, setShownF] = useState(characterF);
  const [animating, setAnimating] = useState(false);
  const [caption, setCaption] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const raf = useRef(0);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; z: number } | null>(null);

  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth || 1000));
    ro.observe(el);
    setWidth(el.clientWidth || 1000);
    return () => ro.disconnect();
  }, []);

  // Return animation: only when saved progress changed since the applicant last looked. Never replays otherwise.
  const keyF = `pw_map_f_${journeyId}`, keyIntro = `pw_map_intro_${journeyId}`, keyDone = `pw_map_done_${journeyId}`;
  const stop = useCallback(() => {
    cancelAnimationFrame(raf.current);
    setAnimating(false);
    setShownF(characterF);
  }, [characterF]);
  useEffect(() => {
    const seen = safeGet(keyF);
    const introSeen = safeGet(keyIntro);
    const last = seen === null ? 0 : Number(seen);
    const from = Number.isFinite(last) ? last : 0;
    const changed = Math.abs(from - characterF) > 0.0005;
    safeSet(keyF, String(characterF));
    safeSet(keyIntro, "1");
    if (finished && !safeGet(keyDone)) { safeSet(keyDone, "1"); setCelebrate(true); }
    if (!changed && introSeen) return;
    if (introSeen === null && !changed) { setCaption("Your path starts here."); window.setTimeout(() => setCaption(null), 3500); return; }
    if (reducedMotion()) return;
    setShownF(from);
    setAnimating(true);
    if (introSeen === null) { setCaption("Your path starts here."); window.setTimeout(() => setCaption(null), 3500); }
    const t0 = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / ANIM_MS);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      setShownF(from + (characterF - from) * e);
      if (k < 1) raf.current = requestAnimationFrame(tick); else setAnimating(false);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [characterF, finished, keyF, keyIntro, keyDone]);

  const w = MAP_W / view.z, h = MAP_H / view.z;
  const scale = width / w;
  const c = Math.min(2.4, Math.max(0.55, 0.9 / scale));
  const compact = scale < 0.5;
  const vb = `${view.cx - w / 2} ${view.cy - h / 2} ${w} ${h}`;

  useEffect(() => {
    if (!following) return;
    const p = pointAt(shownF);
    setView((v) => clampView({ cx: p.x, cy: p.y, z: Math.max(v.z, 2) }));
  }, [following, shownF]);

  const zoomBy = (f: number) => { setFollowing(false); setView((v) => clampView({ ...v, z: Math.min(MAX_ZOOM, Math.max(1, v.z * f)) })); };
  const onDown = (e: React.PointerEvent) => { pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); };
  const onMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, cur);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (!pinch.current) pinch.current = { d, z: view.z };
      else { setFollowing(false); setView((v) => clampView({ ...v, z: Math.min(MAX_ZOOM, Math.max(1, pinch.current!.z * (d / pinch.current!.d))) })); }
      return;
    }
    if (view.z > 1 && (Math.abs(cur.x - prev.x) + Math.abs(cur.y - prev.y)) > 0) {
      setFollowing(false);
      setView((v) => clampView({ ...v, cx: v.cx - (cur.x - prev.x) / scale, cy: v.cy - (cur.y - prev.y) / scale }));
    }
  };
  const onUp = (e: React.PointerEvent) => { pointers.current.delete(e.pointerId); if (pointers.current.size < 2) pinch.current = null; };
  const onWheel = (e: React.WheelEvent) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); zoomBy(e.deltaY < 0 ? 1.15 : 1 / 1.15); } };

  const focusNode = (n: MapNode) => {
    setSelected(n.id);
    setFollowing(false);
    if (view.z > 1) { const p = pointAt(n.f); setView((v) => clampView({ ...v, cx: p.x, cy: p.y })); }
  };
  const sel = nodes.find((n) => n.id === selected) ?? null;
  const selStage = sel ? stages[sel.stage] : null;
  const stageNodes = useMemo(() => (selStage ? nodes.filter((n) => n.stage === selStage.index) : []), [nodes, selStage]);

  const me = pointAt(shownF);
  const hd = headingAt(shownF);
  const face = hd.dx < 0 ? -1 : 1;
  const len = 1000;

  return (
    <section className="pwm" aria-label="Illustrated journey map">
      <div className="pwm-bar">
        <button type="button" className="btn ghost" onClick={() => { setFollowing(false); setView(FULL); }}>Full route</button>
        <button type="button" className="btn ghost" aria-pressed={following} onClick={() => setFollowing((f) => !f)}>Follow character</button>
        <button type="button" className="btn ghost" aria-label="Zoom in" onClick={() => zoomBy(1.4)}>+</button>
        <button type="button" className="btn ghost" aria-label="Zoom out" onClick={() => zoomBy(1 / 1.4)}>−</button>
        {animating && <button type="button" className="btn ghost" onClick={stop}>Skip</button>}
      </div>
      <div ref={boxRef} className="pwm-box" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onWheel={onWheel}>
        <svg viewBox={vb} role="group" aria-label="Map of your six-stage journey. Use the stage list below for a keyboard-friendly version." className="pwm-svg" preserveAspectRatio="xMidYMid meet">
          <defs>
            <g dangerouslySetInnerHTML={{ __html: DEFS_SVG }} />
            <path id="road" d={ROAD_D} pathLength={len} />
          </defs>
          <g id="layer-background" aria-hidden="true" dangerouslySetInnerHTML={{ __html: BACKGROUND_SVG }} />
          <g id="layer-scenery" aria-hidden="true">
            {SCENERY.map(([k, x, y, s], i) => { const d = SYM[k]; return <use key={i} href={`#${k}`} x={d[0]} y={d[1]} width={d[2]} height={d[3]} transform={`translate(${x} ${y}) scale(${s})`} />; })}
          </g>
          <g id="layer-road" aria-hidden="true">
            <use href="#road" fill="none" stroke="#93aba2" strokeWidth={64} strokeLinecap="round" strokeLinejoin="round" />
            <use href="#road" fill="none" stroke="#fcf6de" strokeWidth={53} strokeLinecap="round" strokeLinejoin="round" />
            <use href="#road" fill="none" stroke="#526b78" strokeWidth={43} strokeLinecap="round" strokeLinejoin="round" />
            <use href="#road" fill="none" stroke="#99e9bd" strokeWidth={51} strokeLinecap="round" strokeLinejoin="round" opacity={0.55} filter="url(#glow)" strokeDasharray={`${shownF * len} ${len}`} />
            <use href="#road" fill="none" stroke="#42b79a" strokeWidth={40} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={`${shownF * len} ${len}`} />
            <use href="#road" fill="none" stroke="#f8e7b0" strokeWidth={3.5} strokeDasharray="15 16" strokeLinecap="round" />
          </g>
          <g id="layer-landmarks" aria-hidden="true">
            {LANDMARK_SVG.map((svg, i) => <g key={i} transform={`translate(${ART_BOXES[i][0]} ${ART_BOXES[i][1]})`} dangerouslySetInnerHTML={{ __html: svg }} />)}
            {ART_BOXES.map(([x, y, bw, bh], i) => { const p = pointAt(STAGE_F[i]); return <line key={i} x1={x + bw / 2} y1={y + bh - 14} x2={p.x} y2={p.y} stroke="#fcfff4" strokeWidth={3} strokeDasharray="3 12" strokeLinecap="round" opacity={0.72} />; })}
          </g>
          <g id="layer-ui">
            {nodes.filter((n) => n.kind === "checkpoint").map((n) => <Marker key={n.id} n={n} c={c} compact={compact} selected={selected === n.id} onPick={() => focusNode(n)} />)}
            {nodes.filter((n) => n.kind === "stage").map((n) => <Marker key={n.id} n={n} c={c} compact={compact} selected={selected === n.id} onPick={() => focusNode(n)} />)}
            {!compact && ART_BOXES.map(([x, y, bw, bh], i) => {
              const n = nodes[stages[i].nodeIndex];
              const below = i >= 2;
              const tw0 = (`${i + 1}  ${stages[i].name}`.length * 9.2 + 26) * c / 2 + 6;
              const lx = Math.min(MAP_W - tw0, Math.max(tw0, i === 5 ? 1260 : x + bw / 2));
              const ly = below ? y + bh + 14 : y - 44;
              const text = `${i + 1}  ${stages[i].name}`;
              const tw = text.length * 9.2 + 26;
              return (
                <g key={i} transform={`translate(${lx} ${ly + 15}) scale(${c})`} role="button" tabIndex={0} aria-label={`Open ${stages[i].name} details`} className="pwm-hit"
                  onClick={() => focusNode(n)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); focusNode(n); } }}>
                  <rect x={-tw / 2} y={-15} width={tw} height={30} rx={15} fill="#14284B" opacity={0.95} />
                  <text y={5} textAnchor="middle" fontSize={16} fontWeight={700} fill="#fff">{text}</text>
                </g>
              );
            })}
            <g transform={`translate(${me.x} ${me.y - 4}) scale(${c * face} ${c})`} aria-hidden="true" className="pwm-who">
              <ellipse cx={0} cy={6} rx={14} ry={5} fill="#0F1F46" opacity={0.25} />
              <rect x={-9} y={-20} width={18} height={24} rx={8} fill="#FF8A65" stroke="#fff" strokeWidth={2.5} />
              <rect x={-15} y={-17} width={8} height={16} rx={4} fill="#3478F6" stroke="#fff" strokeWidth={2} />
              <circle cx={0} cy={-30} r={11} fill="#FFD9B8" stroke="#fff" strokeWidth={2.5} />
              <circle cx={4} cy={-31} r={1.8} fill="#14284B" />
              <path d="M-11 -34a11 11 0 0 1 22 0z" fill="#14284B" />
            </g>
          </g>
        </svg>
        {caption && <div className="pwm-caption" role="status">{caption}</div>}
        {celebrate && (
          <div className="pwm-celebrate" role="status">
            <strong>You arrived. Welcome to the U.S.</strong>
            <button type="button" className="btn ghost" onClick={() => setCelebrate(false)}>Close</button>
          </div>
        )}
      </div>
      <p className="muted pwm-note">Markers show saved progress only. A gold diamond means a sponsor or government office confirmed it. A dashed ring means we are waiting on them.</p>
      <ol className="pwm-list" aria-label="Journey stages">
        {stages.map((s) => {
          const n = nodes[s.nodeIndex];
          return (
            <li key={s.section}>
              <button type="button" className={`pwm-stage ${n.status}`} aria-pressed={selected === n.id} onClick={() => focusNode(n)}>
                <span className="pwm-num">{s.index + 1}</span>
                <span><strong>{s.name}</strong><br /><span className="muted">{n.pending ? "Arrival confirmation not set up yet" : STATUS_TEXT[n.status]}</span></span>
                {characterIndex === s.nodeIndex && <span className="chip">You are here</span>}
              </button>
            </li>
          );
        })}
      </ol>
      {sel && selStage && (
        <div className="card pwm-peek" aria-live="polite">
          <div className="row"><h2 style={{ fontSize: 20 }}>{selStage.name}</h2><button type="button" className="btn ghost" onClick={() => setSelected(null)}>Close</button></div>
          <ul className="pwm-cps">
            {stageNodes.map((n) => (
              <li key={n.id} className={n.status}><span className="pwm-dot" aria-hidden="true" />{n.title}{n.kind === "stage" ? " (stage complete)" : ""} <span className="muted">· {n.pending ? "not available yet" : STATUS_TEXT[n.status]}</span></li>
            ))}
          </ul>
          <Link className="btn" href={selStage.href}>Open workspace</Link>
        </div>
      )}
    </section>
  );
}
