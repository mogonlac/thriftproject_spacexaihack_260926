"use client";

import { Logo } from "@thrift/shared/Logo";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ItemCard } from "./ItemCard";
import { DEFAULT_ROI, DH, DW, GarmentDetector, nearestColourName, type Roi } from "@/lib/detector";
import { captureFrame, grabBackground, parseRackCode, readCodes } from "@/lib/client/capture";
import { setSoundEnabled, sounds } from "@/lib/client/sound";
import { gbp, sizeText } from "@/lib/format";
import { STOREFRONT_URL } from "@/lib/links";
import type { Item } from "@/lib/types";

// ---------------------------------------------------------------------------
// State machine
//
//   calibrating → ready ⇄ settling → steady → capturing → analysing
//        ↑          ↑                                          │
//        │          └──── garment removed (re-arm) ◄── saved / rejected / error
//        └── R key / Recalibrate
//
// After a capture the scanner is DISARMED until the hanger zone has been empty
// for REMOVE_MS, so a garment left hanging is never captured twice.
// ---------------------------------------------------------------------------

type Phase =
  | "starting" | "camera-error" | "calibrating" | "ready" | "settling" | "steady"
  | "capturing" | "analysing" | "saved" | "rejected" | "error" | "rack-set" | "remove";

const TICK_MS = 100;
const REMOVE_MS = 1000;       // zone must be empty this long to re-arm
const SUCCESS_HOLD_MS = 2500; // minimum time the green success state is shown
const RACK_SCAN_MS = 600;     // how often to look for a rack QR card while idle
const REQUEST_TIMEOUT_MS = 75_000;

const RACKS = (process.env.NEXT_PUBLIC_RACKS || "A1,A2,B1,B2,B3,C1,C2,D1")
  .split(",").map((r) => r.trim().toUpperCase()).filter(Boolean);
const STATION = process.env.NEXT_PUBLIC_STATION_ID || "stockroom-1";

interface Settings {
  rack: string;
  deviceId: string | null;
  stableMs: number;     // how long the garment must be still
  still: number;        // max motion fraction that counts as still
  enter: number;        // presence fraction that counts as "garment present"
  sound: boolean;
  debug: boolean;
}
const DEFAULTS: Settings = {
  rack: RACKS[0] ?? "A1", deviceId: null, stableMs: 1200, still: 0.012, enter: 0.08, sound: true, debug: false,
};
const SETTINGS_KEY = "scanner.settings.v1";

function loadSettings(): Settings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") };
  } catch {
    return DEFAULTS;
  }
}

interface Pending { photo: Blob; original: Blob; cutout: Blob | null; hints: { colour?: string; aspect?: number; barcode?: string | null } }

const PHASE_COPY: Record<Phase, { title: string; sub: string }> = {
  starting: { title: "Starting camera", sub: "Allow camera access if asked" },
  "camera-error": { title: "Camera unavailable", sub: "" },
  calibrating: { title: "Calibrating", sub: "Keep the hanger area empty" },
  ready: { title: "Ready", sub: "Hang the next garment" },
  settling: { title: "Garment detected", sub: "Hold still…" },
  steady: { title: "Hold still", sub: "Capturing in a moment" },
  capturing: { title: "Captured", sub: "Got it" },
  analysing: { title: "Analysing", sub: "Identifying garment, size, price tag…" },
  saved: { title: "Saved", sub: "Remove the garment for the next scan" },
  rejected: { title: "No garment seen", sub: "Remove it and try again · press R to recalibrate if this repeats" },
  error: { title: "Couldn't save", sub: "" },
  "rack-set": { title: "Rack set", sub: "Remove the rack card" },
  remove: { title: "Remove garment", sub: "Then hang the next one" },
};

export default function Scanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const smallRef = useRef<HTMLCanvasElement>(null);
  const maskRef = useRef<HTMLCanvasElement>(null);
  const detRef = useRef(new GarmentDetector());
  const streamRef = useRef<MediaStream | null>(null);
  const bgFullRef = useRef<HTMLCanvasElement | null>(null); // full-res empty station, for cutouts

  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const settingsRef = useRef(settings);
  const [phase, setPhaseState] = useState<Phase>("starting");
  const phaseRef = useRef<Phase>("starting");
  const [progress, setProgress] = useState(0);
  const [meters, setMeters] = useState({ presence: 0, motion: 0 });
  const [cameraError, setCameraError] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [warning, setWarning] = useState("");
  const [flash, setFlash] = useState(false);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [lastItem, setLastItem] = useState<Item | null>(null);
  const [recent, setRecent] = useState<Item[]>([]);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [showRacks, setShowRacks] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [status, setStatus] = useState<{ store: string; ai: string; market: boolean } | null>(null);
  const [analysingStep, setAnalysingStep] = useState(0);

  const eng = useRef({
    present: false,
    armed: true,
    busy: false,
    stableSince: null as number | null,
    emptySince: null as number | null,
    holdUntil: 0,
    lastBbox: null as Roi | null,
    lastColour: null as [number, number, number] | null,
    lastCodeScan: 0,
    codeBusy: false,
    lastTelemetry: 0,
    lastBgGrab: 0,
    lastSnapshot: 0,
    pending: null as Pending | null,
  });

  const setPhase = useCallback((p: Phase) => {
    if (phaseRef.current !== p) {
      phaseRef.current = p;
      setPhaseState(p);
    }
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((s) => {
      const next = { ...s, ...patch };
      settingsRef.current = next;
      try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  // Load persisted settings + backend status once
  useEffect(() => {
    const s = loadSettings();
    settingsRef.current = s;
    setSettings(s);
    setSoundEnabled(s.sound);
    fetch("/api/status").then((r) => r.json()).then(setStatus).catch(() => {});
    fetch("/api/items?limit=8").then((r) => r.json()).then((d) => d.items && setRecent(d.items)).catch(() => {});
  }, []);

  useEffect(() => { setSoundEnabled(settings.sound); }, [settings.sound]);

  // ---------------- Camera ----------------
  const startCamera = useCallback(async (deviceId: string | null) => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setPhase("starting");
    setCameraError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("This browser can't access a camera here. Use Chrome on https:// or http://localhost.");
      setPhase("camera-error");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: deviceId
          ? { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
          : { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      const v = videoRef.current!;
      v.srcObject = stream;
      await v.play().catch(() => {});
      navigator.mediaDevices.enumerateDevices()
        .then((d) => setDevices(d.filter((x) => x.kind === "videoinput")))
        .catch(() => {});
      // Let auto-exposure settle, then learn the empty background
      setPhase("calibrating");
      setTimeout(() => {
        detRef.current.startCalibration();
        eng.current.armed = true;
      }, 1200);
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      setCameraError(
        name === "NotAllowedError" ? "Camera permission was denied. Allow camera access in the browser's site settings, then retry."
        : name === "NotFoundError" || name === "OverconstrainedError" ? "No camera found. Plug one in or pick another camera in Settings."
        : name === "NotReadableError" ? "The camera is in use by another app. Close it and retry."
        : `Couldn't start the camera${err instanceof Error ? `: ${err.message}` : ""}`,
      );
      setPhase("camera-error");
    }
  }, [setPhase]);

  useEffect(() => {
    startCamera(loadSettings().deviceId);
    return () => streamRef.current?.getTracks().forEach((t) => t.stop());
  }, [startCamera]);

  const recalibrate = useCallback(() => {
    const e = eng.current;
    if (e.busy) return;
    e.armed = true;
    e.present = false;
    e.stableSince = null;
    detRef.current.startCalibration();
    setPhase("calibrating");
  }, [setPhase]);

  // ---------------- Scan submission ----------------
  const submit = useCallback(async (pending: Pending) => {
    const e = eng.current;
    e.busy = true;
    setPhase("analysing");
    setErrorMsg("");
    const form = new FormData();
    form.append("photo", pending.photo, "photo.jpg");
    form.append("original", pending.original, "original.jpg");
    if (pending.cutout) form.append("cutout", pending.cutout, "cutout.jpg");
    form.append("rack", settingsRef.current.rack);
    form.append("station", STATION);
    form.append("hints", JSON.stringify(pending.hints));

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch("/api/scan", { method: "POST", body: form, signal: ctrl.signal });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);
      if (data.rejected) {
        e.pending = null;
        setPhase("rejected");
        sounds.error();
      } else {
        const item = data.item as Item;
        e.pending = null;
        setLastItem(item);
        setRecent((r) => [item, ...r.filter((x) => x.id !== item.id)].slice(0, 8));
        setWarning((data.warnings as string[] | undefined)?.join(" · ") ?? "");
        setPhase("saved");
        sounds.success();
      }
      e.holdUntil = performance.now() + SUCCESS_HOLD_MS;
    } catch (err) {
      setErrorMsg(
        err instanceof DOMException && err.name === "AbortError" ? "The server took too long to respond."
        : err instanceof TypeError ? "Can't reach the scanner server. Check the connection."
        : err instanceof Error ? err.message : "Unknown error",
      );
      setPhase("error");
      sounds.error();
    } finally {
      clearTimeout(timer);
      e.busy = false;
    }
  }, [setPhase]);

  const capture = useCallback(async () => {
    const e = eng.current;
    const v = videoRef.current;
    if (e.busy || !v) return;
    e.busy = true;
    e.armed = false;
    e.stableSince = null;
    e.emptySince = null;
    setPhase("capturing");
    setFlash(true);
    setTimeout(() => setFlash(false), 350);
    sounds.shutter();

    try {
      const shot = await captureFrame(v, e.lastBbox, detRef.current.roi, bgFullRef.current);
      const codes = await readCodes(shot.full);
      const rack = codes.map(parseRackCode).find(Boolean);
      if (rack) {
        updateSettings({ rack });
        setPhase("rack-set");
        sounds.rack();
        e.holdUntil = performance.now() + 1500;
        e.busy = false;
        return;
      }
      setCapturedUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(shot.cutout ?? shot.photo);
      });
      const pending: Pending = {
        photo: shot.photo,
        cutout: shot.cutout,
        original: shot.original,
        hints: {
          colour: e.lastColour ? nearestColourName(e.lastColour) : undefined,
          aspect: shot.aspect,
          barcode: codes[0] ?? null,
        },
      };
      e.pending = pending;
      await submit(pending);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Capture failed");
      setPhase("error");
      sounds.error();
      e.busy = false;
    }
  }, [setPhase, submit, updateSettings]);

  const retry = useCallback(() => {
    const p = eng.current.pending;
    if (p && !eng.current.busy) void submit(p);
  }, [submit]);

  const dismiss = useCallback(() => {
    const e = eng.current;
    e.pending = null;
    e.holdUntil = 0;
    e.armed = false; // re-arms once the zone is empty
    setPhase(e.present ? "remove" : "ready");
  }, [setPhase]);

  const undoLast = useCallback(async () => {
    if (!lastItem) return;
    const res = await fetch(`/api/items/${lastItem.id}`, { method: "DELETE" }).catch(() => null);
    if (res?.ok) {
      setRecent((r) => r.filter((x) => x.id !== lastItem.id));
      setLastItem(null);
      setWarning("Last scan removed");
    } else {
      setWarning("Couldn't undo — try again from Inventory");
    }
  }, [lastItem]);

  // ---------------- Detection loop ----------------
  useEffect(() => {
    const small = smallRef.current!;
    const ctx = small.getContext("2d", { willReadFrequently: true })!;
    let tick = 0;

    const id = setInterval(() => {
      const v = videoRef.current;
      const p = phaseRef.current;
      if (!v || v.readyState < 2 || p === "starting" || p === "camera-error") return;
      const S = settingsRef.current;
      const det = detRef.current;
      const e = eng.current;
      const now = performance.now();

      ctx.drawImage(v, 0, 0, DW, DH);
      const frame = ctx.getImageData(0, 0, DW, DH).data;
      const wasCalibrating = det.calibrating;
      const st = det.process(frame);

      if (++tick % 2 === 0) setMeters({ presence: st.presence, motion: st.motion });
      if (S.debug && maskRef.current) drawMask(maskRef.current, det.mask);
      if (S.debug && now - e.lastTelemetry > 500) {
        e.lastTelemetry = now;
        const snap = now - e.lastSnapshot > 3000;
        if (snap) e.lastSnapshot = now;
        sendTelemetry(v, maskRef.current, snap, {
          phase: p, presence: round(st.presence), motion: round(st.motion), present: e.present, armed: e.armed,
          busy: e.busy, enter: S.enter, still: S.still, stableMs: S.stableMs, bbox: st.bbox,
        });
      }

      if (det.calibrating) { setPhase("calibrating"); return; }
      if (wasCalibrating) {
        e.present = false;
        bgFullRef.current = grabBackground(v);
        e.lastBgGrab = now;
        setPhase("ready");
        return;
      }
      if (p === "calibrating") return; // waiting for the delayed calibration start

      // Presence with hysteresis
      if (!e.present && st.presence > S.enter) e.present = true;
      else if (e.present && st.presence < S.enter * 0.5) e.present = false;
      if (st.bbox) e.lastBbox = st.bbox;
      if (st.fgColour) e.lastColour = st.fgColour;

      if (e.busy) return;

      // Disarmed: wait for the garment to be taken away
      if (!e.armed) {
        if (e.present) { e.emptySince = null; return; }
        e.emptySince ??= now;
        if (now - e.emptySince >= REMOVE_MS && now >= e.holdUntil && p !== "error") {
          e.armed = true;
          e.emptySince = null;
          setPhase("ready");
        }
        return;
      }

      // Armed: look for a rack QR card while idle
      if (now - e.lastCodeScan > RACK_SCAN_MS && !e.codeBusy) {
        e.lastCodeScan = now;
        e.codeBusy = true;
        readCodes(v).then((codes) => {
          const rack = codes.map(parseRackCode).find(Boolean);
          if (rack && eng.current.armed && !eng.current.busy) {
            updateSettings({ rack });
            eng.current.armed = false;          // don't photograph the card
            eng.current.holdUntil = performance.now() + 1500;
            setPhase("rack-set");
            sounds.rack();
          }
        }).finally(() => { eng.current.codeBusy = false; });
      }

      if (!e.present) {
        e.stableSince = null;
        setProgress(0);
        if (st.presence < S.enter * 0.25 && st.motion < 0.005) {
          det.adapt(frame, 0.02);
          // keep the full-res empty shot fresh for cutouts as the light changes
          if (now - e.lastBgGrab > 10_000) { bgFullRef.current = grabBackground(v); e.lastBgGrab = now; }
        }
        setPhase("ready");
        return;
      }
      if (st.motion > S.still) {
        e.stableSince = null;
        setProgress(0);
        setPhase("settling");
        return;
      }
      e.stableSince ??= now;
      const prog = Math.min(1, (now - e.stableSince) / S.stableMs);
      setProgress(prog);
      if (prog >= 1) void capture();
      else setPhase("steady");
    }, TICK_MS);

    return () => clearInterval(id);
  }, [capture, setPhase, updateSettings]);

  // Analysing sub-steps (identification ~2.5 s, then market lookup)
  useEffect(() => {
    if (phase !== "analysing") return;
    setAnalysingStep(0);
    const t = setTimeout(() => setAnalysingStep(1), 2600);
    return () => clearTimeout(t);
  }, [phase]);

  // ---------------- Keyboard shortcuts ----------------
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if ((ev.target as HTMLElement)?.closest("input, select, textarea")) return;
      sounds.unlock();
      if (ev.code === "Space") { ev.preventDefault(); void capture(); }
      else if (ev.key === "r" || ev.key === "R") recalibrate();
      else if (ev.key === "d" || ev.key === "D") updateSettings({ debug: !settingsRef.current.debug });
      else if (/^[1-9]$/.test(ev.key) && RACKS[Number(ev.key) - 1]) updateSettings({ rack: RACKS[Number(ev.key) - 1] });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [capture, recalibrate, updateSettings]);

  const copy = PHASE_COPY[phase];
  const roi = DEFAULT_ROI;

  return (
    <div className={`scanner phase-${phase}`} onPointerDown={() => sounds.unlock()}>
      <header className="topbar">
        <div className="brand">
          <Logo size={30} />
          <strong>Intake</strong>
          <span className="muted station">{STATION}</span>
        </div>
        <button className="rack-pill" onClick={() => setShowRacks(true)} title="Change rack (keys 1–9 or show a RACK:xx QR card)">
          <span>Rack</span>
          <strong>{settings.rack}</strong>
        </button>
        <nav className="top-actions">
          {status && (
            <span className="chips">
              <span className={`chip ${status.ai === "fallback" ? "warn" : "ok"}`}>AI · {status.ai}</span>
              {status.market && <span className="chip ok">Prices · live market</span>}
              <span className={`chip ${status.store === "supabase" ? "ok" : "warn"}`}>
                DB · {status.store === "supabase" ? "Supabase" : "local file"}
              </span>
            </span>
          )}
          <Link href="/inventory" className="btn ghost">Inventory</Link>
          <a href={`${STOREFRONT_URL}/staff`} className="btn ghost">Till ↗</a>
          <button className="btn ghost" onClick={() => setShowSettings((s) => !s)}>Settings</button>
        </nav>
      </header>

      <main className="stage">
        <section className="camera-panel">
          <div className="video-wrap">
            <video ref={videoRef} playsInline muted autoPlay />
            <div
              className="roi"
              style={{
                left: `${roi.x0 * 100}%`, top: `${roi.y0 * 100}%`,
                width: `${(roi.x1 - roi.x0) * 100}%`, height: `${(roi.y1 - roi.y0) * 100}%`,
              }}
            >
              <span className="roi-label">Hang garment here</span>
              <span className="hook" />
            </div>
            {phase === "steady" && (
              <div className="steady-bar"><div style={{ width: `${progress * 100}%` }} /></div>
            )}
            {flash && <div className="flash" />}
            {phase === "camera-error" && (
              <div className="camera-error">
                <p>{cameraError}</p>
                <button className="btn primary" onClick={() => startCamera(settings.deviceId)}>Retry camera</button>
              </div>
            )}
            {settings.debug && <canvas ref={maskRef} width={DW} height={DH} className="mask" />}
          </div>
          <div className="meters">
            <Meter label="Presence" value={meters.presence} mark={settings.enter} max={0.5} />
            <Meter label="Motion" value={meters.motion} mark={settings.still} max={0.1} />
            <div className="manual">
              <button className="btn ghost small" onClick={() => void capture()}>Capture now <kbd>Space</kbd></button>
              <button className="btn ghost small" onClick={recalibrate}>Recalibrate <kbd>R</kbd></button>
            </div>
          </div>
        </section>

        <section className="status-panel">
          <div className="status-hero">
            <StatusIcon phase={phase} progress={progress} />
            <h1>{phase === "rack-set" ? `Rack ${settings.rack}` : copy.title}</h1>
            <p className="sub">
              {phase === "camera-error" ? cameraError : phase === "error" ? errorMsg : phase === "analysing" ? "" : copy.sub}
            </p>

            {phase === "error" && (
              <div className="row">
                {eng.current.pending && <button className="btn primary big" onClick={retry}>Retry</button>}
                <button className="btn ghost big" onClick={dismiss}>Discard</button>
              </div>
            )}

            {phase === "analysing" && (
              <p className="sub step">
                {analysingStep === 0 ? "Identifying garment, size and price tag…"
                  : status?.market ? "Checking resale prices on eBay, Vinted & Depop…" : "Reading tags…"}
              </p>
            )}
            {phase === "analysing" && capturedUrl && (
              <img className="captured-thumb" src={capturedUrl} alt="Captured garment" />
            )}

            {phase === "saved" && lastItem && (
              <div className="saved-summary">
                <div className="saved-title">{lastItem.title}</div>
                <div className="saved-line">
                  {[sizeText(lastItem) && `Size ${sizeText(lastItem)}`, gbp(lastItem.price_pence) + (lastItem.price_source === "ai_suggested" ? " (est.)" : ""), lastItem.valuation?.resale_typical_gbp != null && `resale ~£${Math.round(lastItem.valuation.resale_typical_gbp)}`, `Rack ${lastItem.rack}`]
                    .filter(Boolean).join("  ·  ")}
                </div>
              </div>
            )}
          </div>

          {warning && <div className="warning" onClick={() => setWarning("")}>{warning}</div>}

          {lastItem && (
            <div className="last-item">
              <div className="section-head">
                <span>Last scan</span>
                <button className="btn ghost small" onClick={undoLast}>Undo</button>
              </div>
              <ItemCard item={lastItem} />
            </div>
          )}

          {recent.length > 0 && (
            <div className="recent">
              <div className="section-head"><span>Recent</span><Link href="/inventory">View all →</Link></div>
              <div className="recent-strip">
                {recent.map((it) => (
                  <div key={it.id} className="recent-thumb" title={it.title}>
                    {it.photos[0] && <img src={it.photos[0]} alt="" />}
                    <span>{it.rack}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </main>

      <canvas ref={smallRef} width={DW} height={DH} hidden />

      {showRacks && (
        <div className="overlay" onClick={() => setShowRacks(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h2>Which rack are these going to?</h2>
            <p className="muted">Every garment scanned from now on is assigned to this rack. Tip: hold a QR card reading <code>RACK:B3</code> up to the camera to switch hands-free.</p>
            <div className="rack-grid">
              {RACKS.map((r, i) => (
                <button
                  key={r}
                  className={`rack-btn${r === settings.rack ? " active" : ""}`}
                  onClick={() => { updateSettings({ rack: r }); setShowRacks(false); }}
                >
                  {r}<small>{i < 9 ? i + 1 : ""}</small>
                </button>
              ))}
            </div>
            <form
              className="row"
              onSubmit={(e) => {
                e.preventDefault();
                const v = String(new FormData(e.currentTarget).get("rack") || "").trim().toUpperCase();
                if (v) { updateSettings({ rack: v }); setShowRacks(false); }
              }}
            >
              <input name="rack" placeholder="Other rack…" maxLength={12} />
              <button className="btn primary">Set</button>
            </form>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="overlay" onClick={() => setShowSettings(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h2>Scanner settings</h2>
            <label>
              Camera
              <select
                value={settings.deviceId ?? ""}
                onChange={(e) => { const id = e.target.value || null; updateSettings({ deviceId: id }); startCamera(id); }}
              >
                <option value="">Default camera</option>
                {devices.map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${i + 1}`}</option>)}
              </select>
            </label>
            <Slider label="Presence threshold" value={settings.enter} min={0.02} max={0.3} step={0.01}
              fmt={(v) => `${Math.round(v * 100)}% of zone`} onChange={(enter) => updateSettings({ enter })} />
            <Slider label="Stillness threshold" value={settings.still} min={0.002} max={0.06} step={0.002}
              fmt={(v) => `${(v * 100).toFixed(1)}% moving`} onChange={(still) => updateSettings({ still })} />
            <Slider label="Hold still for" value={settings.stableMs} min={400} max={3000} step={100}
              fmt={(v) => `${(v / 1000).toFixed(1)} s`} onChange={(stableMs) => updateSettings({ stableMs })} />
            <label className="check">
              <input type="checkbox" checked={settings.sound} onChange={(e) => updateSettings({ sound: e.target.checked })} /> Sound cues
            </label>
            <label className="check">
              <input type="checkbox" checked={settings.debug} onChange={(e) => updateSettings({ debug: e.target.checked })} /> Show detection mask <kbd>D</kbd>
            </label>
            <div className="row">
              <button className="btn ghost" onClick={() => updateSettings({ ...DEFAULTS, rack: settings.rack, deviceId: settings.deviceId })}>Reset tuning</button>
              <button className="btn primary" onClick={() => { recalibrate(); setShowSettings(false); }}>Recalibrate background</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const round = (v: number) => Math.round(v * 10000) / 10000;

/** Debug mode only: stream detection stats (and a snapshot every 3 s) to the dev server for tuning. */
function sendTelemetry(video: HTMLVideoElement, mask: HTMLCanvasElement | null, snapshot: boolean, stats: Record<string, unknown>) {
  const body: Record<string, unknown> = { ...stats };
  if (snapshot && video.videoWidth) {
    const c = document.createElement("canvas");
    c.width = 640;
    c.height = Math.round((640 * video.videoHeight) / video.videoWidth);
    c.getContext("2d")!.drawImage(video, 0, 0, c.width, c.height);
    body.frame = c.toDataURL("image/jpeg", 0.7);
    if (mask) body.mask = mask.toDataURL("image/png");
  }
  fetch("/api/telemetry", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    .catch(() => {});
}

function drawMask(canvas: HTMLCanvasElement, mask: Uint8Array) {
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(DW, DH);
  for (let i = 0; i < mask.length; i++) {
    const on = mask[i];
    img.data[i * 4] = on ? 34 : 0;
    img.data[i * 4 + 1] = on ? 197 : 0;
    img.data[i * 4 + 2] = on ? 94 : 0;
    img.data[i * 4 + 3] = on ? 200 : 60;
  }
  ctx.putImageData(img, 0, 0);
}

function Meter({ label, value, mark, max }: { label: string; value: number; mark: number; max: number }) {
  const pct = (v: number) => `${Math.min(100, (v / max) * 100)}%`;
  return (
    <div className="meter">
      <span>{label}</span>
      <div className="meter-track">
        <div className="meter-fill" style={{ width: pct(value) }} />
        <div className="meter-mark" style={{ left: pct(mark) }} />
      </div>
      <span className="meter-val">{(value * 100).toFixed(1)}%</span>
    </div>
  );
}

function Slider(props: { label: string; value: number; min: number; max: number; step: number; fmt: (v: number) => string; onChange: (v: number) => void }) {
  return (
    <label>
      <span className="slider-head">{props.label}<em>{props.fmt(props.value)}</em></span>
      <input type="range" min={props.min} max={props.max} step={props.step} value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))} />
    </label>
  );
}

function StatusIcon({ phase, progress }: { phase: Phase; progress: number }) {
  if (phase === "saved") {
    return (
      <svg className="status-icon" viewBox="0 0 120 120" aria-hidden>
        <circle cx="60" cy="60" r="54" className="ring-bg" />
        <path d="M36 62 L53 79 L86 44" className="check" />
      </svg>
    );
  }
  if (phase === "error" || phase === "camera-error" || phase === "rejected") {
    return (
      <svg className="status-icon" viewBox="0 0 120 120" aria-hidden>
        <circle cx="60" cy="60" r="54" className="ring-bg" />
        <path d="M60 32 V68 M60 84 V88" className="check" />
      </svg>
    );
  }
  if (phase === "analysing" || phase === "starting" || phase === "calibrating") {
    return <div className="status-icon spinner" aria-hidden />;
  }
  const c = 2 * Math.PI * 54;
  return (
    <svg className="status-icon" viewBox="0 0 120 120" aria-hidden>
      <circle cx="60" cy="60" r="54" className="ring-bg" />
      {phase === "steady" && (
        <circle cx="60" cy="60" r="54" className="ring-fg" strokeDasharray={c} strokeDashoffset={c * (1 - progress)} />
      )}
      <path d="M60 22 a8 8 0 1 1 8 8 q-8 2 -8 10 v4 L28 70 h64 L60 44" className="hanger" />
    </svg>
  );
}
