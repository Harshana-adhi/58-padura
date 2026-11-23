const COLOR_MAP: Record<string, string> = {
  violet: "bg-violet-500/15 text-violet-300 ring-violet-500/30",
  amber: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  rose: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
  slate: "bg-slate-500/15 text-slate-300 ring-slate-500/30",
  green: "bg-green-500/15 text-green-300 ring-green-500/30",
  blue: "bg-blue-500/15 text-blue-300 ring-blue-500/30",
};

export function CategoryChip({ name, color }: { name: string; color: string }) {
  const classes = COLOR_MAP[color] ?? COLOR_MAP.slate;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${classes}`}>
      {name}
    </span>
  );
}
