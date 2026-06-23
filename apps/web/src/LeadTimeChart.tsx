import {
    ResponsiveContainer, LineChart, Line, XAxis, YAxis,
    CartesianGrid, Tooltip, Legend,
} from "recharts";
import {useState} from "react";
import type { LeadTimeStat } from "@weather-verify/shared";


type Props = {
    statsByProvider: Record<string, LeadTimeStat[]>;
};

// Цвета линий по провайдерам. Если провайдера тут нет — берём серый запасной.
const COLORS: Record<string, string> = {
    "open-meteo": "#e74c3c",
    "weatherapi": "#27ae60",
};
const FALLBACK_COLORS = ["#8e44ad", "#f39c12", "#16a085", "#2c3e50"];

export function LeadTimeChart({ statsByProvider }: Props) {
    const [metric, setMetric] = useState<"max" | "min">("max");
    const field = metric === "max" ? "maeMax" : "maeMin";
    const metricLabel = metric === "max" ? "Tmax" : "Tmin";
    const providers = Object.keys(statsByProvider);
    if (providers.length === 0) {
        return <p>Пока нет верифицированных прогнозов</p>;
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
            <div style={{ marginBottom: 8 }}>
                <button
                    onClick={() => setMetric("max")}
                    style={{ fontWeight: metric === "max" ? "bold" : "normal", marginRight: 8 }}
                >
                    Tmax
                </button>
                <button
                    onClick={() => setMetric("min")}
                    style={{ fontWeight: metric === "min" ? "bold" : "normal" }}
                >
                    Tmin
                </button>
                <span style={{ marginLeft: 12, color: "#888" }}>
                    MAE {metricLabel} по горизонту (чем ниже, тем точнее)
                </span>
            </div>
            <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                    dataKey="leadTimeDays"
                    label={{ value: "Заблаговременность, дни", position: "insideBottom", offset: -5 }}
                />
                <YAxis unit="°" domain={[0, "auto"]} />
                <Tooltip />
                <Legend verticalAlign="top" />
                {providers.map((provider, i) => (
                    <Line
                        key={provider}
                        type="monotone"
                        dataKey={provider}
                        name={provider}
                        stroke={COLORS[provider] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length]}
                        connectNulls
                    />
                ))}
            </LineChart>
        </ResponsiveContainer>
        </div>
    );
}