"use client";

export function Chip({
  active,
  onClick,
  children,
  className = "",
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`label flex h-14 items-center justify-center border text-lg transition-colors ${
        active ? "border-ink bg-ink text-paper" : "border-line bg-card"
      } ${className}`}
    >
      {children}
    </button>
  );
}
