interface TimerDisplayProps {
  elapsed: string;
  total: string;
}

export function TimerDisplay({ elapsed, total }: TimerDisplayProps) {
  return (
    <div className="flex items-center gap-1.5 text-sm font-counter text-text-tertiary tabular-nums">
      <span className="text-amber-400">{elapsed}</span>
      <span>/</span>
      <span>{total}</span>
    </div>
  );
}
