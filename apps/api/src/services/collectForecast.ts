import { prisma } from "../db";
import type { Location } from "../generated/prisma/client";
import { withRetry } from "../utils/retry";
import type { Provider } from "../providers";

/**
 * Сходить в Open-Meteo за прогнозом для одной локации и сохранить дни в Forecast.
 * Возвращает количество сохранённых (созданных/обновлённых) дней.
 */
export async function collectForecast(location: Location, provider: Provider): Promise<number> {
    const forecast = await withRetry(() => provider.fetch(location));

    // Сегодняшняя дата (день, когда прогноз "выпущен").
    const issued = new Date();
    const issuedDateOnly = new Date(issued.toISOString().slice(0, 10));


    let saved = 0;
    for (const day of forecast) {
        const target = new Date(day.targetDate);

        // Заблаговременность: сколько дней между "сегодня" и целевым днём.
        const leadTimeDays = Math.round(
            (target.getTime() - issuedDateOnly.getTime()) / (1000 * 60 * 60 * 24)
        );

        await prisma.forecast.upsert({
            where: {
                locationId_provider_issuedDate_targetDate: {
                    locationId: location.id,
                    issuedDate: issuedDateOnly,
                    targetDate: target,
                    provider: provider.id,
                },
            },
            update: {
                tempMin: day.tempMin,
                tempMax: day.tempMax,
                precipMm: day.precipMm,
            },
            create: {
                locationId: location.id,
                provider: provider.id,
                issuedDate: issuedDateOnly,
                targetDate: target,
                leadTimeDays,
                tempMin: day.tempMin,
                tempMax: day.tempMax,
                precipMm: day.precipMm,
            },
        });
        saved++;
    }

    return saved;
}