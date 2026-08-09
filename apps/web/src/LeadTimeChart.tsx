import {
    ResponsiveContainer, LineChart, Line, XAxis, YAxis,
    CartesianGrid, Tooltip, Legend,
} from "recharts";
import {useState} from "react";
import type { LeadTimeStat } from "@weather-verify/shared";
import { ChartTooltip } from "./components/ChartTooltip";


type Props = {
    statsByProvider: Record<string, LeadTimeStat[]>;
};

// Цвета линий по провайдерам. Если провайдера тут нет — берём серый запасной.
const COLORS: Record<string, string> = {
    "open-meteo": "#4f46e5",
    "weatherapi": "#10b981",
    "gismeteo": "#f59e0b",
};
const FALLBACK_COLORS = ["#64748b", "#0ea5e9", "#a855f7"];

const tickStyle = { fontSize: 12, fill: "#94a3b8" };

export function LeadTimeChart({ statsByProvider }: Props) {
    const [metric, setMetric] = useState<"max" | "min">("max");
    const field = metric === "max" ? "maeMax" : "maeMin";
    const metricLabel = metric === "max" ? "Tmax" : "Tmin";
    const providers = Object.keys(statsByProvider);
    if (providers.length === 0) {
        return <p className="py-2 text-sm text-slate-500">Пока нет верифицированных прогнозов.</p>;
    }

    // PIVOT: из { provider: [{lead, maeMax}] } делаем единый массив строк,
    // по одной на каждый leadTimeDays, с колонкой-провайдером внутри.
    const byLead = new Map<number, Record<string, number>>();
    for (const provider of providers) {
        for (const s of statsByProvider[provider]) {
            let row = byLead.get(s.leadTimeDays);
            if (!row) {
                row = { leadTimeDays: s.leadTimeDays };
                byLead.set(s.leadTimeDays, row);
            }
            // Колонку называем именем провайдера; значение — его MAE Tmax.
            const mae = s[field];
            if (mae != null) row[provider] = mae;
        }
    }

    const data = [...byLead.values()].sort(
        (a, b) => a.leadTimeDays - b.leadTimeDays,
    );

    return (
        <div>
            <div className="mb-3 flex flex-wrap items-center gap-3">
                <div className="inline-flex gap-1 rounded-lg bg-slate-100 p-1">
                    <button
                        onClick={() => setMetric("max")}
                        className={
                            metric === "max"
                                ? "rounded-md bg-white px-3 py-1 text-xs font-medium text-indigo-600 shadow-sm transition-colors"
                                : "rounded-md px-3 py-1 text-xs font-medium text-slate-500 transition-colors hover:text-slate-700"
                        }
                    >
                        Tmax
                    </button>
                    <button
                        onClick={() => setMetric("min")}
                        className={
                            metric === "min"
                                ? "rounded-md bg-white px-3 py-1 text-xs font-medium text-indigo-600 shadow-sm transition-colors"
                                : "rounded-md px-3 py-1 text-xs font-medium text-slate-500 transition-colors hover:text-slate-700"
                        }
                    >
                        Tmin
                    </button>
                </div>
                <span className="text-xs text-slate-500">
                    MAE {metricLabel} по горизонту (чем ниже, тем точнее)
                </span>
            </div>
            <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                    <CartesianGrid vertical={false} stroke="#e2e8f0" />
                    <XAxis
                        dataKey="leadTimeDays"
                        tick={tickStyle}
                        axisLine={false}
                        tickLine={false}
                        label={{ value: "Заблаговременность, дни", position: "insideBottom", offset: -5, fontSize: 12, fill: "#94a3b8" }}
                    />
                    <YAxis unit="°" domain={[0, "auto"]} tick={tickStyle} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} verticalAlign="top" align="left" height={32} iconType="circle" iconSize={8} />
                    {providers.map((provider, i) => (
                        <Line
                            key={provider}
                            type="monotone"
                            dataKey={provider}
                            name={provider}
                            stroke={COLORS[provider] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length]}
                            strokeWidth={2}
                            dot={{ r: 3 }}
                            connectNulls
                        />
                    ))}
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}
