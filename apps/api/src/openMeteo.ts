import {z} from "zod"

import type { Location } from "./generated/prisma/client";
import type {ForecastDay} from "./providers";

// export interface DailyForecast {
//     targetDate: string; // YYYY-MM-DD (локальная дата)
//     tempMin: number | null;
//     tempMax: number | null;
//     precipMm: number | null;
// }

const OpenMeteoForecastSchema = z.object({
    daily: z.object({
        time: z.array(z.string()).min(1, "daily.time is empty"),
        temperature_2m_max: z.array(z.number().nullable()),
        temperature_2m_min: z.array(z.number().nullable()),
        precipitation_sum: z.array(z.number().nullable()),
    }),
});

export async function fetchOpenMeteoForecast(location: Location): Promise<ForecastDay[]> {
    const { lat, lon, timezone } = location;
    const days = 7;
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(lat));
    url.searchParams.set("longitude", String(lon));
    url.searchParams.set(
        "daily",
        "temperature_2m_max,temperature_2m_min,precipitation_sum"
    );
    url.searchParams.set("timezone", timezone);
    url.searchParams.set("forecast_days", String(days));

    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Open-Meteo вернул статус ${res.status}`);
    }

    const parsed = OpenMeteoForecastSchema.safeParse(await res.json());
    if (!parsed.success) {
        const why = parsed.error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; ");
        throw new Error(`Open-Meteo: неожиданная форма ответа — ${why}`);
    }
    const daily = parsed.data.daily;

    return daily.time.map((date, i) => ({
        targetDate: date,
        tempMax: daily.temperature_2m_max[i] ?? null,
        tempMin: daily.temperature_2m_min[i] ?? null,
        precipMm: daily.precipitation_sum[i] ?? null,
    }));
}