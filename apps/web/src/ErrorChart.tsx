import { useState } from "react";
import {
    ResponsiveContainer, LineChart, Line, XAxis, YAxis,
    CartesianGrid, Tooltip, Legend, ReferenceLine,
} from "recharts";
import type { ComparisonRow } from "@weather-verify/shared";



type Props = {
    comparisonByProvider: Record<string, ComparisonRow[]>;
};

// палитра: какому провайдеру какой цвет линии
const COLORS: Record<string, string> = {
    "open-meteo": "#e74c3c",
    "weatherapi": "#2ecc71",
};
const FALLBACK_COLORS = ["#9b59b6", "#f39c12", "#1abc9c", "#e67e22"];

export function ErrorChart({ comparisonByProvider }: Props) {

    const [metric, setMetric] = useState<"max" | "min">("max");

    const errorField = metric === "max" ? "errorMax" : "errorMin";
    const metricLabel = metric === "max" ? "Tmax" : "Tmin";

    const providers = Object.keys(comparisonByProvider);

    // 1. Собираем все строки всех провайдеров в одну плоскую "длинную" таблицу,
    //    оставляя только прогнозы на завтра (lead = 1) с непустой ошибкой Tmax.
    const longRows: { provider: string; date: string; error: number }[] = [];
    for (const provider of providers) {
        for (const row of comparisonByProvider[provider]) {
            if (row.leadTimeDays !== 1) continue;       // только горизонт "на завтра"
            const error = row[errorField];               // errorMax или errorMin
            if (error == null) continue;                 // нет ошибки — пропускаем
            longRows.push({
                provider,
                date: row.targetDate,
                error,
            });
        }
    }

    // 2. Переразложение в "широкую" форму для Recharts:
    //    одна строка на дату, в ней по колонке на каждого провайдера.
    //    { date: "2026-06-09", "open-meteo": -3.1, "weatherapi": -2.0 }
    const byDate = new Map<string, Record<string, number | string>>();
    for (const r of longRows) {
        if (!byDate.has(r.date)) {
            byDate.set(r.date, {date: r.date});
        }
        byDate.get(r.date)![r.provider] = r.error;
    }

    // 3. Достаём строки из Map и сортируем по дате (ось X идёт слева направо).
    const chartData = Array.from(byDate.values()).sort((a, b) =>
        String(a.date).localeCompare(String(b.date)),
    );

    if (chartData.length === 0) {
        return <p>Нет данных для графика (нужны прогнозы с lead = 1 и факт).</p>;
    }

    return (
        <div>
            {/* переключатель метрики */}
            <div style={{marginBottom: 8, display: "flex", gap: 8}}>
                <button
                    onClick={() => setMetric("max")}
                    style={{fontWeight: metric === "max" ? "bold" : "normal"}}
                >
                    Tmax
                </button>
                <button
                    onClick={() => setMetric("min")}
                    style={{fontWeight: metric === "min" ? "bold" : "normal"}}
                >
                    Tmin
                </button>
            </div>
            <div style={{ marginBottom: 8, color: "#888", fontSize: 14 }}>
                Ошибка {metricLabel} (прогноз − факт), горизонт lead = 1
            </div>

            {chartData.length === 0 ? (
                <p>Нет данных для графика (нужны прогнозы с lead = 1 и факт).</p>
            ) : (
                <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData} margin={{top: 10, right: 20, bottom: 10, left: 0}}>
                        <CartesianGrid strokeDasharray="3 3"/>
                        <XAxis dataKey="date"/>
                        <YAxis unit="°"/>
                        <Tooltip/>
                        <Legend/>
                        <ReferenceLine y={0} stroke="#888"/>
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
            )}
        </div>
    );
}