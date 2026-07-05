import { useEffect, useState } from "react";
import { ErrorChart } from "./ErrorChart";
import {LeadTimeChart} from "./LeadTimeChart";
import type {ComparisonRow, LeadTimeStat} from "@weather-verify/shared";
import { useAuth } from "./AuthContext";       // ← ДОБАВЛЕНО
import { AuthScreen } from "./AuthScreen";     // ← ДОБАВЛЕНО
import { api } from "./api";                   // ← ДОБАВЛЕНО

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

// Класс для подсветки: близко к нулю — хорошо, далеко — плохо.
function errorClass(err: number | null): string {
    if (err == null) return "";
    const abs = Math.abs(err);
    if (abs < 1) return "err-good";
    if (abs < 3) return "err-mid";
    return "err-bad";
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

    // ← ИЗМЕНЕНО: грузим локации только когда залогинены, через api() (шлёт cookie).
    useEffect(() => {
        if (!user) return;
        api("/api/locations")
            .then((res) => res.json())
            .then((data: Location[]) => setLocations(data))
            .catch(() => setError("Не удалось загрузить локации"));
    }, [user]);

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
    }, [selectedId, mode]);

    // ← ДОБАВЛЕНО: гейтинг. Обязательно ПОСЛЕ всех хуков, ДО главного return.
    if (loading) {
        return <main className="shell"><p className="muted">Загрузка…</p></main>;
    }
    if (!user) {
        return <AuthScreen />;
    }

    return (
        <main className="shell">
            <h1>Weather Verify</h1>
            <p className="sub">Прогнозы по локациям</p>

            {/* ← ДОБАВЛЕНО: шапка с email и выходом */}
            <div className="topbar">
                <span className="muted">{user.email}</span>
                <button type="button" className="link" onClick={logout}>Выйти</button>
            </div>

            <div className="locations">
                {locations.map((loc) => (
                    <button
                        key={loc.id}
                        className={loc.id === selectedId ? "loc active" : "loc"}
                        onClick={() => {
                            setSelectedId(loc.id);
                            setMode("forecast");
                        }}
                    >
                        {loc.name}
                        {loc.country ? `, ${loc.country}` : ""}
                    </button>
                ))}
            </div>
            {selectedId && (
                <div className="modes">
                    <button
                        className={mode === "forecast" ? "mode active" : "mode"}
                        onClick={() => setMode("forecast")}
                    >
                        Прогноз
                    </button>
                    <button
                        className={mode === "comparison" ? "mode active" : "mode"}
                        onClick={() => setMode("comparison")}
                    >
                        Сравнение
                    </button>
                    <button
                        className={mode === "leadtime" ? "mode active" : "mode"}
                        onClick={() => setMode("leadtime")}
                    >
                        Ошибка по lead time
                    </button>
                </div>
            )}

            {loadingData && <p className="muted">Загружаю прогноз…</p>}
            {error && <div className="card err">{error}</div>}

            {mode === "forecast" && forecast.length > 0 && (
                <table className="forecast">
                    <thead>
                    <tr>
                        <th>Дата</th>
                        <th>Мин °C</th>
                        <th>Макс °C</th>
                        <th>Осадки, мм</th>
                    </tr>
                    </thead>
                    <tbody>
                    {forecast.map((day) => (
                        <tr key={day.targetDate}>
                            <td>{day.targetDate}</td>
                            <td>{day.tempMin ?? "—"}</td>
                            <td>{day.tempMax ?? "—"}</td>
                            <td>{day.precipMm ?? "—"}</td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            )}
            {mode === "comparison" && Object.keys(comparison).length > 0 && (
                <>
                    {Object.entries(comparison).map(([provider, rows]) => (
                        <div key={provider} className="provider-section">
                            <h3>{provider}</h3>
                            <table className="forecast">
                                <thead>
                                <tr>
                                    <th>Дата</th>
                                    <th>Lead</th>
                                    <th>Прогноз макс</th>
                                    <th>Факт макс</th>
                                    <th>Ошибка</th>
                                </tr>
                                </thead>
                                <tbody>
                                {rows.map((row) => (
                                    <tr key={`${provider}-${row.leadTimeDays}-${row.targetDate}`}>
                                        <td>{row.targetDate}</td>
                                        <td>{row.leadTimeDays}</td>
                                        <td>{row.forecastMax ?? "—"}</td>
                                        <td>{row.actualMax ?? "—"}</td>
                                        <td className={errorClass(row.errorMax)}>
                                            {row.errorMax != null ? formatError(row.errorMax) : "—"}
                                        </td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                    ))}
                    <ErrorChart comparisonByProvider={comparison} />
                </>
            )}
            {mode === "comparison" && !loadingData && Object.keys(comparison).length === 0 && (
                <p className="muted">Currently there is no matching between forecast and an observation. The data is still gathering.</p>
            )}
            {mode === "leadtime" && Object.keys(statsByProvider).length > 0 && (
                <LeadTimeChart statsByProvider={statsByProvider} />
            )}
            {mode === "leadtime" && !loadingData && Object.keys(statsByProvider).length === 0 && (
                <p className="muted">Currently there is no stats for lead time — expected gathered observation data.</p>
            )}

        </main>
    );
}
