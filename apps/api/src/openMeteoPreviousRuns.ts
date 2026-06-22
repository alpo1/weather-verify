import { z } from "zod";


export interface PreviousRunDay {
    leadTimeDays: number;   // 1..7 — на сколько дней вперёд был сделан прогноз
    date: string;           // местная дата "YYYY-MM-DD"
    tempMin: number;
    tempMax: number;
}

const PreviousRunsSchema = z.object({
    hourly: z.object({
        time: z.array(z.string()).min(1, "hourly.time is null"),
        temperature_2m_previous_day1: z.array(z.number().nullable()),
        temperature_2m_previous_day2: z.array(z.number().nullable()),
        temperature_2m_previous_day3: z.array(z.number().nullable()),
        temperature_2m_previous_day4: z.array(z.number().nullable()),
        temperature_2m_previous_day5: z.array(z.number().nullable()),
        temperature_2m_previous_day6: z.array(z.number().nullable()),
        temperature_2m_previous_day7: z.array(z.number().nullable()),
    }),
});

export async function fetchPreviousRuns(
    lat: number,
    lon: number,
    timezone: string,
): Promise<PreviousRunDay[]> {
    // 1..7 -> "temperature_2m_previous_day1", ... "temperature_2m_previous_day7"
    const leadTimes = [1, 2, 3, 4, 5, 6, 7];
    const vars = leadTimes.map((n) => `temperature_2m_previous_day${n}`);

    const url =
        `https://previous-runs-api.open-meteo.com/v1/forecast` +
        `?latitude=${lat}&longitude=${lon}` +
        `&hourly=${vars.join(",")}` +
        `&past_days=7&forecast_days=1` +
        `&timezone=${encodeURIComponent(timezone)}`;

    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Previous Runs API вернул статус ${res.status}`);
    }

    const parsed = PreviousRunsSchema.safeParse(await res.json());
    if (!parsed.success) {
        const why = parsed.error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; ");
        throw new Error(`Previous Runs: неожиданная форма ответа — ${why}`);
    }
    const hourly = parsed.data.hourly;

    // карта "горизонт -> часовая колонка": явные ключи вместо динамических
    const columns: Record<number, (number | null)[]> = {
        1: hourly.temperature_2m_previous_day1,
        2: hourly.temperature_2m_previous_day2,
        3: hourly.temperature_2m_previous_day3,
        4: hourly.temperature_2m_previous_day4,
        5: hourly.temperature_2m_previous_day5,
        6: hourly.temperature_2m_previous_day6,
        7: hourly.temperature_2m_previous_day7,
    };

    const times = hourly.time;
    const result: PreviousRunDay[] = [];

    // Отдельно для каждого горизонта складываем часы в суточные корзины.
    for (const n of leadTimes) {
        const values = columns[n];

        // дата -> массив часовых температур этого дня
        const buckets = new Map<string, number[]>();

        for (let i = 0; i < times.length; i++) {
            const t = values[i];
            if (t == null) continue;             // дырка в прогнозе — пропускаем

            const date = times[i].slice(0, 10);  // "2026-06-14T13:00" -> "2026-06-14"
            let bucket = buckets.get(date);
            if (!bucket) {
                bucket = [];
                buckets.set(date, bucket);
            }
            bucket.push(t);
        }

        for (const [date, temps] of buckets) {
            result.push({
                leadTimeDays: n,
                date,
                tempMin: Math.min(...temps),
                tempMax: Math.max(...temps),
            });
        }
    }

    return result;
}