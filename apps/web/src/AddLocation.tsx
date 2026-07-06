import { useState, type FormEvent } from "react";
import { api } from "./api";

// Один результат geocoding Open-Meteo (берём только нужные поля; остальные игнорируем).
interface GeoResult {
    id: number;
    name: string;
    latitude: number;
    longitude: number;
    timezone: string;
    country_code?: string;
    country?: string;
    admin1?: string;
}

export function AddLocation({ onAdded }: { onAdded: () => void }) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<GeoResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [addingId, setAddingId] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Поиск города — ВНЕШНИЙ публичный API Open-Meteo. Обычный fetch:
    // нашу cookie третьей стороне не шлём (никакого credentials: "include").
    async function search(e: FormEvent) {
        e.preventDefault();
        const q = query.trim();
        if (!q) return;

        setError(null);
        setSearching(true);
        setResults([]);
        try {
            const url =
                "https://geocoding-api.open-meteo.com/v1/search" +
                `?name=${encodeURIComponent(q)}&count=5&language=en&format=json`;
            const res = await fetch(url);
            const data: { results?: GeoResult[] } = await res.json();
            const found = data.results ?? [];
            setResults(found);
            if (found.length === 0) setError("Ничего не найдено");
        } catch {
            setError("Не удалось выполнить поиск");
        } finally {
            setSearching(false);
        }
    }

    // Добавление — НАШ роут, через api() (с cookie). Сервер сам дедуплицирует по координатам.
    async function add(r: GeoResult) {
        setAddingId(r.id);
        setError(null);
        try {
            const res = await api("/api/locations", {
                method: "POST",
                body: JSON.stringify({
                    name: r.name,
                    country: r.country_code, // если нет — ключ просто выпадет из JSON
                    lat: r.latitude,
                    lon: r.longitude,
                    timezone: r.timezone,
                    geonameId: r.id
                }),
            });
            if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                throw new Error(d.error ?? "Не удалось добавить локацию");
            }
            // успех: чистим поиск и просим родителя перезагрузить список
            setQuery("");
            setResults([]);
            onAdded();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Ошибка при добавлении");
        } finally {
            setAddingId(null);
        }
    }

    return (
        <div className="add-location">
            <form className="add-form" onSubmit={search}>
                <input
                    type="text"
                    placeholder="Добавить город, например Haifa"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
                <button type="submit" disabled={searching}>
                    {searching ? "…" : "Найти"}
                </button>
            </form>

            {error && <div className="card err">{error}</div>}

            {results.length > 0 && (
                <ul className="geo-results">
                    {results.map((r) => (
                        <li key={r.id}>
                            <span>
                                {r.name}
                                {r.admin1 ? `, ${r.admin1}` : ""}
                                {r.country ? ` (${r.country})` : ""}
                            </span>
                            <button
                                type="button"
                                onClick={() => add(r)}
                                disabled={addingId === r.id}
                            >
                                {addingId === r.id ? "…" : "Добавить"}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
