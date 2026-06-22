import * as cheerio from "cheerio";
import type { Location } from "./generated/prisma/client";
import type { ForecastDay } from "./providers";
import { z } from "zod";


const FiniteNumber = z.number();


function parseNum(raw: string | undefined, label: string): number {
    if (raw == null || raw.trim() === "") {
        throw new Error(`Gismeteo: empty (${label})`);
    }
    const n = Number(raw.replace(",", "."));
    if (!FiniteNumber.safeParse(n).success) {
        throw new Error(`Gismeteo: NaN (${label}) — resieved "${raw}"`);
    }
    return n;
}

function slugify(name: string): string {
    return name.trim().toLowerCase().replace(/\s+/g, "-");
}

// Собираем URL страницы прогноза на 10 дней.
export function gismeteoUrl(location: Location): string {
    const slug = slugify(location.name);
    return `https://www.gismeteo.ru/weather-${slug}-${location.gismeteoId}/10-days/`;
}

// Грузим сырой server-rendered HTML страницы.
export async function fetchGismeteoHtml(location: Location): Promise<string> {
    const url = gismeteoUrl(location);
    const response = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (weather-verify learning project)" },
    });
    if (!response.ok) {
        throw new Error(`Gismeteo HTTP ${response.status} for ${url}`);
    }
    return response.text();
}

// Адаптер-провайдер. Парсинг добавим следующим шагом.
export async function fetchGismeteoForecast(location: Location): Promise<ForecastDay[]> {
    if (location.gismeteoId == null) return [];
    const html = await fetchGismeteoHtml(location);
    const $ = cheerio.load(html);

    // Скоупимся СТРОГО на ряд температуры воздуха, иначе нахватаем
    // "по ощущению", "среднесуточную" и т.п. (см. ловушку из разведки).
    const row = $(".widget-row-chart-temperature-air .values .value");

    const maxs: number[] = [];
    const mins: number[] = [];

    row.each((i, el) => {
        const max = $(el).find(".maxt temperature-value").attr("value");
        const min = $(el).find(".mint temperature-value").attr("value");
        maxs.push(parseNum(max, `tempMax, день ${i}`));
        mins.push(parseNum(min, `tempMin, день ${i}`));
    });
    const precips: number[] = [];

    $(".widget-row-precipitation-bars .row-item .item-unit").each((i, el) => {
        const raw = $(el).text().trim();      // "1,6"  или  "0"
        precips.push(parseNum(raw, `precips, day ${i}`));
    });

    // База отсчёта: сегодня в UTC-полночь.
    const ymd = (d: Date): string => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
    };

    const today = new Date();

    const EXPECTED_DAYS = 10;
    if (
        maxs.length !== EXPECTED_DAYS ||
        mins.length !== EXPECTED_DAYS ||
        precips.length !== EXPECTED_DAYS
    ) {
        throw new Error(
            `Gismeteo: expected  ${EXPECTED_DAYS} values, received ` +
            `max=${maxs.length}, min=${mins.length}, precip=${precips.length} — probably HTML changed`
        );
    }

    const result: ForecastDay[] = [];

    for (let i = 0; i < maxs.length; i++) {
        // сегодня + i дней; new Date(y, m, d+i) сам перешагивает месяцы/годы
        const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
        result.push({
            targetDate: ymd(d),
            tempMax: maxs[i],
            tempMin: mins[i],
            precipMm: precips[i],
        });
    }

    return result;
}