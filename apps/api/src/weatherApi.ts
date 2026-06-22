import type { Location } from "./generated/prisma/client";
import { z } from "zod";

type ForecastDay = {
    targetDate: string;        // "YYYY-MM-DD", местная календарная дата
    tempMax: number | null;
    tempMin: number | null;
    precipMm: number | null;
};

// На бесплатном тарифе WeatherAPI максимум прогноза — 3 дня.
const DAYS = 3;

const WeatherApiSchema = z.object({
    forecast: z.object({
        forecastday: z
            .array(
                z.object({
                    date: z.string(),
                    day: z.object({
                        maxtemp_c: z.number(),
                        mintemp_c: z.number(),
                        totalprecip_mm: z.number(),
                    }),
                })
            )
            .min(1, "forecastday пуст — нет дней прогноза"),
    }),
});

export async function fetchWeatherApiForecast(location: Location): Promise<ForecastDay[]> {
    const { lat, lon } = location;
    const key = process.env.WEATHERAPI_KEY;
    if (!key) {
        throw new Error("Не задан WEATHERAPI_KEY в .env");
    }

    const params = new URLSearchParams({
        key,
        q: `${lat},${lon}`,
        days: String(DAYS),
    });
    const url = `https://api.weatherapi.com/v1/forecast.json?${params}`;

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`WeatherAPI ответил ${response.status}`);
    }

    const parsed = WeatherApiSchema.safeParse(await response.json());
    if (!parsed.success) {
        const why = parsed.error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; ");
        throw new Error(`WeatherAPI: неожиданная форма ответа — ${why}`);
    }
    const forecastDays = parsed.data.forecast.forecastday;

    return forecastDays.map((fd) => ({
        targetDate: fd.date,
        tempMax: fd.day.maxtemp_c ?? null,
        tempMin: fd.day.mintemp_c ?? null,
        precipMm: fd.day.totalprecip_mm ?? null,
    }));
}