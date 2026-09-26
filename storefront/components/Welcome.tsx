"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useIdleReset } from "@/hooks/useIdleReset";
import { estimateSize, cmToFtIn, kgToStLb, WAIST_OPTIONS, type Gender } from "@/lib/sizing";
import { useKiosk } from "@/lib/store";
import { ALPHA_SIZES, type AlphaSize } from "@/lib/types";
import { ArrowLeft } from "./icons";
import { Chip } from "./Chip";
import { Logo } from "@thrift/shared/Logo";

type Step = "enter" | "gender" | "fit";
type FitMode = "measure" | "size";

const ease = [0.22, 1, 0.36, 1] as const;

export function Welcome() {
  const router = useRouter();
  const resetSession = useKiosk((s) => s.resetSession);
  const setProfile = useKiosk((s) => s.setProfile);
  const [step, setStep] = useState<Step>("enter");
  const [gender, setGender] = useState<Gender>("womens");

  // Someone walked away mid-setup: fall back to the Enter screen.
  useIdleReset(() => setStep("enter"), { idleMs: 60_000, warnMs: 0 });

  useEffect(() => {
    router.prefetch("/shop");
  }, [router]);

  const go = () => router.push("/shop");

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-x-hidden px-8 py-8">
      <AnimatePresence>
        {step !== "enter" && (
          <motion.button
            key="back"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setStep(step === "fit" ? "gender" : "enter")}
            className="absolute top-6 left-6 flex h-16 w-16 items-center justify-center"
            aria-label="Back"
          >
            <ArrowLeft size={40} />
          </motion.button>
        )}
      </AnimatePresence>

      <motion.div layout transition={{ duration: 0.6, ease }} className="flex w-full max-w-3xl flex-col items-center">
        <motion.div layout transition={{ duration: 0.6, ease }} className={step === "fit" ? "mb-4" : "mb-16"}>
          <Logo size={step === "enter" ? 96 : step === "fit" ? 36 : 56} withTagline={step === "enter"} />
        </motion.div>

        <AnimatePresence mode="popLayout" initial={false}>
          {step === "enter" && (
            <motion.div
              key="enter"
              className="flex flex-col items-center gap-6"
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
            >
              <motion.button
                layoutId="primary-cta"
                onClick={() => {
                  resetSession();
                  setStep("gender");
                }}
                className="label h-20 w-80 border border-line bg-card text-2xl tracking-[0.25em] transition-colors active:bg-ink active:text-paper"
              >
                Enter
              </motion.button>
              <p className="text-muted max-w-sm text-center text-base leading-relaxed">
                Every item here is one of a kind. Browse what&apos;s on our rails, then print a list with where to find it.
              </p>
            </motion.div>
          )}

          {step === "gender" && (
            <motion.div
              key="gender"
              className="flex flex-col items-center gap-8"
              exit={{ opacity: 0, y: -20, transition: { duration: 0.2 } }}
            >
              <p className="label text-muted text-lg tracking-[0.2em]">Who are you shopping for?</p>
              <div className="flex gap-6">
                <motion.button
                  layoutId="primary-cta"
                  onClick={() => {
                    setGender("womens");
                    setStep("fit");
                  }}
                  className="label h-40 w-64 border border-line bg-card text-3xl tracking-[0.2em] active:bg-ink active:text-paper"
                >
                  Women
                </motion.button>
                <motion.button
                  initial={{ opacity: 0, x: -40 }}
                  animate={{ opacity: 1, x: 0, transition: { delay: 0.15, duration: 0.5, ease } }}
                  onClick={() => {
                    setGender("mens");
                    setStep("fit");
                  }}
                  className="label h-40 w-64 border border-line bg-card text-3xl tracking-[0.2em] active:bg-ink active:text-paper"
                >
                  Men
                </motion.button>
              </div>
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { delay: 0.35 } }}
                onClick={() => {
                  setProfile({ department: null, size: null, waist: null });
                  go();
                }}
                className="label text-muted h-14 px-6 text-base tracking-[0.15em] underline underline-offset-8"
              >
                Just browse everything
              </motion.button>
            </motion.div>
          )}

          {step === "fit" && (
            <motion.div
              key="fit"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.45, ease } }}
              exit={{ opacity: 0 }}
              className="w-full"
            >
              <FitStep
                gender={gender}
                onDone={(size, waist, heightCm, weightKg) => {
                  setProfile({ department: gender, size, waist, heightCm, weightKg });
                  go();
                }}
                onSkip={() => {
                  setProfile({ department: gender, size: null, waist: null });
                  go();
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </main>
  );
}

function FitStep({
  gender,
  onDone,
  onSkip,
}: {
  gender: Gender;
  onDone: (size: AlphaSize | null, waist: number | null, heightCm: number | null, weightKg: number | null) => void;
  onSkip: () => void;
}) {
  const [mode, setMode] = useState<FitMode>("measure");
  const [metric, setMetric] = useState(true);
  const [heightCm, setHeightCm] = useState(gender === "womens" ? 165 : 178);
  const [weightKg, setWeightKg] = useState(gender === "womens" ? 63 : 78);
  const [size, setSize] = useState<AlphaSize | null>(null);
  const [waist, setWaist] = useState<number | null>(null);

  const estimated = estimateSize(gender, { heightCm, weightKg });
  const chosenSize = mode === "measure" ? estimated : size;
  const ftIn = cmToFtIn(heightCm);
  const stLb = kgToStLb(weightKg);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <div className="text-center">
        <h1 className="display text-4xl">Your fit</h1>
        <p className="text-muted mt-2 text-base">So we can show things that fit first. You can change this any time.</p>
      </div>

      <div className="grid grid-cols-2 border border-line" role="tablist">
        {(
          [
            ["measure", "Height & weight"],
            ["size", "I know my size"],
          ] as const
        ).map(([m, label]) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`label h-16 text-lg tracking-[0.12em] transition-colors ${mode === m ? "bg-ink text-paper" : "bg-card"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "measure" ? (
        <div className="relative flex flex-col gap-3">
          <button
            onClick={() => setMetric(!metric)}
            className="label text-muted absolute -top-1 left-1/2 h-11 -translate-x-1/2 px-2 text-sm tracking-[0.15em] underline underline-offset-4"
          >
            {metric ? "Use ft / st" : "Use cm / kg"}
          </button>
          <Slider
            label="Height"
            value={heightCm}
            min={140}
            max={210}
            onChange={setHeightCm}
            display={metric ? `${heightCm} cm` : `${ftIn.ft}′ ${ftIn.inch}″`}
          />
          <Slider
            label="Weight"
            value={weightKg}
            min={38}
            max={150}
            onChange={setWeightKg}
            display={metric ? `${weightKg} kg` : `${stLb.st} st ${stLb.lb} lb`}
          />
          <div className="flex items-baseline justify-between border-t border-soft pt-3">
            <span className="label text-muted text-base tracking-[0.15em]">We&apos;d suggest</span>
            <span className="display text-4xl">{estimated}</span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <span className="label text-muted text-base tracking-[0.15em]">Size</span>
          <div className="grid grid-cols-7 gap-2">
            {ALPHA_SIZES.map((s) => (
              <Chip key={s} active={size === s} onClick={() => setSize(size === s ? null : s)}>
                {s}
              </Chip>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <span className="label text-muted text-base tracking-[0.15em]">Waist (inches) · optional</span>
        <div className="grid grid-cols-9 gap-2">
          {WAIST_OPTIONS.map((w) => (
            <Chip key={w} active={waist === w} onClick={() => setWaist(waist === w ? null : w)}>
              {w}
            </Chip>
          ))}
        </div>
      </div>

      <div className="mt-2 grid grid-cols-[1fr_2fr] gap-4">
        <button onClick={onSkip} className="label h-18 border border-line bg-card text-lg tracking-[0.15em]">
          Skip
        </button>
        <button
          onClick={() => onDone(chosenSize, waist, mode === "measure" ? heightCm : null, mode === "measure" ? weightKg : null)}
          className="label h-18 bg-ink text-paper text-lg tracking-[0.15em] active:opacity-80"
        >
          {chosenSize ? `Show me size ${chosenSize}` : "Show me everything"}
        </button>
      </div>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  onChange,
  display,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  display: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between">
        <span className="label text-muted text-base tracking-[0.15em]">{label}</span>
        <span className="label text-3xl">{display}</span>
      </div>
      <div className="flex items-center gap-4">
        <StepButton onClick={() => onChange(Math.max(min, value - 1))} label={`Less ${label}`}>
          −
        </StepButton>
        <input
          type="range"
          className="kiosk-range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={label}
        />
        <StepButton onClick={() => onChange(Math.min(max, value + 1))} label={`More ${label}`}>
          +
        </StepButton>
      </div>
    </div>
  );
}

function StepButton({ children, onClick, label }: { children: React.ReactNode; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="flex h-14 w-14 shrink-0 items-center justify-center border border-line bg-card text-2xl active:bg-ink active:text-paper"
    >
      {children}
    </button>
  );
}
