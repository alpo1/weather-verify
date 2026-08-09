import { useEffect, useState, useCallback } from "react";
import { AddLocation } from "./AddLocation";
import { ErrorChart } from "./ErrorChart";
import {LeadTimeChart} from "./LeadTimeChart";
import type {ComparisonRow, LeadTimeStat} from "@weather-verify/shared";
import { useAuth } from "./AuthContext";       // ← ДОБАВЛЕНО
import { AuthScreen } from "./AuthScreen";     // ← ДОБАВЛЕНО
import { api } from "./api";                   // ← ДОБАВЛЕНО
import { Card } from "./components/Card";
import { Button } from "./components/Button";

type Mode = "forecast" | "comparison"| "leadtime";


interface Location {
    id: string;
    name: string;
    country: string | null;
    lat: number;
    lon: number;
    timezone: string;
}

interface DailyForecast {
    targetDate: string;
    tempMin: number | null;
    tempMax: number | null;
    precipMm: number | null;
}

interface ForecastResponse {
    location: string;
    forecast: DailyForecast[];
}



// Форматирует ошибку со знаком: +1.2 / -0.8 / 0.
function formatError(err: number): string {
    if (err > 0) return `+${err}`;
    return String(err);
}

// Бейдж-классы для подсветки ошибки: близко к нулю — хорошо, далеко — плохо.
function errorBadgeClasses(err: number | null): string {
    if (err == null) return "bg-slate-100 text-slate-500";
    const abs = Math.abs(err);
    if (abs < 1) return "bg-emerald-50 text-emerald-700";
    if (abs < 3) return "bg-amber-50 text-amber-700";
    return "bg-rose-50 text-rose-700";
}

// Строки-скелетоны на время загрузки — по форме похожи на итоговую таблицу.
function TableSkeleton() {
    return (
        <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-8 animate-pulse rounded bg-slate-100" />
            ))}
        </div>
    );
}

export function App() {
    const { user, loading, logout } = useAuth();   // ← ДОБАВЛЕНО (первой строкой в App)
    const [locations, setLocations] = useState<Location[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [mode, setMode] = useState<Mode>("forecast");
    const [forecast, setForecast] = useState<DailyForecast[]>([]);
    const [comparison, setComparison] = useState<Record<string, ComparisonRow[]>>({});
    const [statsByProvider, setStatsByProvider] = useState<Record<string, LeadTimeStat[]>>({});
    const [loadingData, setLoadingData] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [reloadKey, setReloadKey] = useState(0);

    const loadLocations = useCallback(() => {
        api("/api/locations")
            .then((res) => res.json())
            .then((data: Location[]) => setLocations(data))
            .catch(() => setError("Не удалось загрузить локации"));
    }, []);

    useEffect(() => {
        if (!user) return;
        loadLocations();
    }, [user, loadLocations]);

    // Грузим данные текущего режима при смене локации ИЛИ режима.
    useEffect(() => {
        const id = selectedId;
        if (!id) return;

        let cancelled = false;
        setLoadingData(true);
        setError(null);

        async function load() {
            try {
                if (mode === "forecast") {
                    const res = await api(`/api/locations/${id}/forecast`);   // ← fetch → api
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    const data: ForecastResponse = await res.json();
                    if (!cancelled) setForecast(data.forecast);
                } else if (mode === "comparison") {
                    const res = await api(`/api/locations/${id}/comparison`);  // ← fetch → api
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    const data: { comparisonByProvider: Record<string, ComparisonRow[]> } =
                        await res.json();
                    if (!cancelled) setComparison(data.comparisonByProvider);
                } else {
                    const res = await api(`/api/locations/${id}/lead-time-stats`);  // ← fetch → api
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    const data: { statsByProvider: Record<string, LeadTimeStat[]> } =
                        await res.json();
                    if (!cancelled) setStatsByProvider(data.statsByProvider);
                }
            } catch {
                if (!cancelled) setError("Не удалось загрузить данные");
            } finally {
                if (!cancelled) setLoadingData(false);
            }
        }

        load();

        return () => {
            cancelled = true;
        };
    }, [selectedId, mode, reloadKey]);

    // ← ДОБАВЛЕНО: гейтинг. Обязательно ПОСЛЕ всех хуков, ДО главного return.
    if (loading) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-slate-50">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600" />
            </main>
        );
    }
    if (!user) {
        return <AuthScreen />;
    }

    return (
        <main className="min-h-screen bg-slate-50">
            <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold text-slate-900">Weather Verify</h1>
                        <p className="text-sm text-slate-500">Прогнозы по локациям</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-500">{user.email}</span>
                        <button
                            type="button"
                            className="text-xs font-medium text-slate-500 transition-colors hover:text-indigo-600"
                            onClick={logout}
                        >
                            Выйти
                        </button>
                    </div>
                </div>

                <AddLocation onAdded={loadLocations} />

                <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                        {locations.map((loc) => {
                            const active = loc.id === selectedId;
                            return (
                                <button
                                    key={loc.id}
                                    className={
                                        active
                                            ? "rounded-full border border-indigo-600 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-600 transition-colors"
                                            : "rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 transition-colors hover:border-slate-300"
                                    }
                                    onClick={() => {
                                        setSelectedId(loc.id);
                                        setMode("forecast");
                                    }}
                                >
                                    {loc.name}
                                    {loc.country ? `, ${loc.country}` : ""}
                                </button>
                            );
                        })}
                    </div>
                    {locations.length === 0 && (
                        <p className="text-xs text-slate-500">
                            Пока нет локаций — добавьте город через поиск выше.
                        </p>
                    )}
                </div>

                {selectedId && (
                    <div className="inline-flex gap-1 rounded-lg bg-slate-100 p-1">
                        {(
                            [
                                { key: "forecast", label: "Прогноз" },
                                { key: "comparison", label: "Сравнение" },
                                { key: "leadtime", label: "Ошибка по lead time" },
                            ] as const
                        ).map((tab) => (
                            <button
                                key={tab.key}
                                className={
                                    mode === tab.key
                                        ? "rounded-md bg-white px-3 py-1.5 text-sm font-medium text-indigo-600 shadow-sm transition-colors"
                                        : "rounded-md px-3 py-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-700"
                                }
                                onClick={() => setMode(tab.key)}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                )}

                {!selectedId && (
                    <p className="text-sm text-slate-500">
                        Выберите локацию выше, чтобы увидеть прогноз.
                    </p>
                )}

                {error && (
                    <div className="flex items-center justify-between gap-4 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                        <span>{error}</span>
                        <Button variant="secondary" className="shrink-0" onClick={() => setReloadKey((k) => k + 1)}>
                            Повторить
                        </Button>
                    </div>
                )}

                {loadingData && !error && (
                    <Card>
                        <TableSkeleton />
                    </Card>
                )}

                {!loadingData && mode === "forecast" && forecast.length > 0 && (
                    <Card title="Прогноз" description="Ежедневный прогноз для выбранной локации.">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                <tr className="divide-y divide-slate-100">
                                    <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate-500">Дата</th>
                                    <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-slate-500">Мин °C</th>
                                    <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-slate-500">Макс °C</th>
                                    <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-slate-500">Осадки, мм</th>
                                </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                {forecast.map((day) => (
                                    <tr key={day.targetDate} className="odd:bg-slate-50">
                                        <td className="px-3 py-2 text-left text-slate-700">{day.targetDate}</td>
                                        <td className="px-3 py-2 text-right text-slate-700">{day.tempMin ?? "—"}</td>
                                        <td className="px-3 py-2 text-right text-slate-700">{day.tempMax ?? "—"}</td>
                                        <td className="px-3 py-2 text-right text-slate-700">{day.precipMm ?? "—"}</td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                )}
                {!loadingData && mode === "comparison" && Object.keys(comparison).length > 0 && (
                    <>
                        {Object.entries(comparison).map(([provider, rows]) => (
                            <Card key={provider} title={provider} description="Прогноз против факта, по дням.">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                        <tr className="divide-y divide-slate-100">
                                            <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate-500">Дата</th>
                                            <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-slate-500">Lead</th>
                                            <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-slate-500">Прогноз макс</th>
                                            <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-slate-500">Факт макс</th>
                                            <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-slate-500">Ошибка</th>
                                        </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                        {rows.map((row) => (
                                            <tr key={`${provider}-${row.leadTimeDays}-${row.targetDate}`} className="odd:bg-slate-50">
                                                <td className="px-3 py-2 text-left text-slate-700">{row.targetDate}</td>
                                                <td className="px-3 py-2 text-right text-slate-700">{row.leadTimeDays}</td>
                                                <td className="px-3 py-2 text-right text-slate-700">{row.forecastMax ?? "—"}</td>
                                                <td className="px-3 py-2 text-right text-slate-700">{row.actualMax ?? "—"}</td>
                                                <td className="px-3 py-2 text-right">
                                                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${errorBadgeClasses(row.errorMax)}`}>
                                                        {row.errorMax != null ? formatError(row.errorMax) : "—"}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                        </tbody>
                                    </table>
                                </div>
                            </Card>
                        ))}
                        <Card title="Ошибка прогноза" description="Ошибка (прогноз − факт) по датам, горизонт lead = 1.">
                            <ErrorChart comparisonByProvider={comparison} />
                        </Card>
                    </>
                )}
                {!loadingData && mode === "comparison" && Object.keys(comparison).length === 0 && (
                    <p className="text-sm text-slate-500">Currently there is no matching between forecast and an observation. The data is still gathering.</p>
                )}
                {!loadingData && mode === "leadtime" && Object.keys(statsByProvider).length > 0 && (
                    <Card title="Ошибка по горизонту" description="MAE по заблаговременности прогноза — чем ниже, тем точнее.">
                        <LeadTimeChart statsByProvider={statsByProvider} />
                    </Card>
                )}
                {!loadingData && mode === "leadtime" && Object.keys(statsByProvider).length === 0 && (
                    <p className="text-sm text-slate-500">Currently there is no stats for lead time — expected gathered observation data.</p>
                )}

                <footer className="border-t border-slate-200 pt-6 text-center text-xs text-slate-500">
                    Weather data by{" "}
                    <a
                        href="https://open-meteo.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-600 underline decoration-slate-300 underline-offset-2 transition-colors hover:text-indigo-600"
                    >
                        Open-Meteo.com
                    </a>
                    {" "}· forecasts also from Gismeteo and WeatherAPI.com
                </footer>
            </div>
        </main>
    );
}
