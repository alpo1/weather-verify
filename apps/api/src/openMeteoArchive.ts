import { z } from "zod";

export interface DailyObservation {
    date: string; // YYYY-MM-DD
    tempMin: number | null;
    tempMax: number | null;
    precipMm: number | null;
}

const ArchiveSchema = z.object({
    daily: z.object({
        time: z.array(z.string()).min(1, "daily.time пуст — нет дней факта"),
        temperature_2m_max: z.array(z.number().nullable()),
        temperature_2m_min: z.array(z.number().nullable()),
        precipitation_sum: z.array(z.number().nullable()),
    }),
});

export async function fetchOpenMeteoArchive(
    lat: number,
    lon: number,
    timezone: string,
    startDate: string, // YYYY-MM-DD
    endDate: string // YYYY-MM-DD
): Promise<DailyObservation[]> {
    const url = new URL("https://archive-api.open-meteo.com/v1/archive");
    url.searchParams.set("latitude", String(lat));
    url.searchParams.set("longitude", String(lon));
    url.searchParams.set("start_date", startDate);
    url.searchParams.set("end_date", endDate);
    url.searchParams.set(
        "daily",
        "temperature_2m_max,temperature_2m_min,precipitation_sum"
    );
    url.searchParams.set("timezone", timezone);

    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Open-Meteo Archive return status ${res.status}`);
    }

    const parsed = ArchiveSchema.safeParse(await res.json());
    if (!parsed.success) {
        const why = parsed.error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; ");
        throw new Error(`Open-Meteo Archive: unexpectable response form — ${why}`);
    }
    const daily = parsed.data.daily;

    return daily.time.map((date, i) => ({
        date,
        tempMax: daily.temperature_2m_max[i] ?? null,
        tempMin: daily.temperature_2m_min[i] ?? null,
        precipMm: daily.precipitation_sum[i] ?? null,
    }));
}