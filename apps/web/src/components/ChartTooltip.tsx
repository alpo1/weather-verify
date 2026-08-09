import type { TooltipContentProps } from "recharts";

type Props = Partial<TooltipContentProps<number, string>> & { unit?: string };

export function ChartTooltip({ active, payload, label, unit = "°" }: Props) {
    if (!active || !payload || payload.length === 0) return null;

    return (
        <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-sm">
            {label != null && <p className="mb-1.5 text-xs font-medium text-slate-500">{label}</p>}
            <div className="space-y-1">
                {payload.map((entry) => (
                    <div key={entry.dataKey as string} className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
                        <span className="text-slate-600">{entry.name}</span>
                        <span className="ml-auto font-medium text-slate-900">
                            {entry.value}
                            {unit}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
