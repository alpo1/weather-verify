import { prisma } from "../db";
import { fetchOpenMeteoArchive } from "../openMeteoArchive";
import { withRetry } from "../utils/retry";
import type { Location } from "../generated/prisma/client";

/**
 * Подтянуть фактическую погоду (реанализ) для одной локации и сохранить в Observation.
 * @param location локация
 * @param days     сколько дней истории тянуть (по умолчанию 10)
 * @returns период и количество сохранённых дней
 */
export async function collectObservations(location: Location, days = 10) {
    // Период: [сегодня - days - 5] ... [сегодня - 5].
    // Сдвиг на 5 дней назад — потому что свежий факт появляется с задержкой.
    const toDate = new Date();
    toDate.setDate(toDate.getDate() - 5);
    const fromDate = new Date(toDate);
    fromDate.setDate(fromDate.getDate() - days);

    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    const observations = await withRetry(() =>
        fetchOpenMeteoArchive(
            location.lat,
            location.lon,
            location.timezone,
            fmt(fromDate),
            fmt(toDate)
        )
    );

    let saved = 0;
    for (const obs of observations) {
        await prisma.observation.upsert({
            where: {
                locationId_date: {
                    locationId: location.id,
                    date: new Date(obs.date),
                },
            },
            update: {
                tempMin: obs.tempMin,
                tempMax: obs.tempMax,
                precipMm: obs.precipMm,
            },
            create: {
                locationId: location.id,
                date: new Date(obs.date),
                tempMin: obs.tempMin,
                tempMax: obs.tempMax,
                precipMm: obs.precipMm,
            },
        });
        saved++;
    }

    return { from: fmt(fromDate), to: fmt(toDate), saved };
}