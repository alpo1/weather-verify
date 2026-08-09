import { useState } from "react";
import {
    ResponsiveContainer, LineChart, Line, XAxis, YAxis,
    CartesianGrid, Tooltip, Legend, ReferenceLine,
} from "recharts";
import type { ComparisonRow } from "@weather-verify/shared";
import { ChartTooltip } from "./components/ChartTooltip";



type Props = {
    comparisonByProvider: Record<string, ComparisonRow[]>;
};

// палитра: какому провайдеру какой цвет линии
const COLORS: Record<string, string> = {
    "open-meteo": "#4f46e5",
    "weatherapi": "#10b981",
    "gismeteo": "#f59e0b",
};
const FALLBACK_COLORS = ["#64748b", "#0ea5e9", "#a855f7"];

const tickStyle = { fontSize: 12, fill: "#94a3b8" };

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
        return (
            <div className="py-2 text-sm text-slate-500">
                Нет данных для графика — нужны прогнозы с lead = 1 и подтверждённый факт.
            </div>
        );
    }

    return (
        <div>
            {/* переключатель метрики */}
            <div className="mb-3 inline-flex gap-1 rounded-lg bg-slate-100 p-1">
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
            <div className="mb-2 text-xs text-slate-500">
                Ошибка {metricLabel} (прогноз − факт), горизонт lead = 1
            </div>

            <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData} margin={{top: 10, right: 20, bottom: 10, left: 0}}>
                    <CartesianGrid vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="date" tick={tickStyle} axisLine={false} tickLine={false} />
                    <YAxis unit="°" tick={tickStyle} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} verticalAlign="top" align="left" height={32} iconType="circle" iconSize={8} />
                    <ReferenceLine y={0} stroke="#cbd5e1" />
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
