import { prisma } from "../db";
import { collectForecast } from "./collectForecast";
import { collectObservations } from "./collectObservations";
import { PROVIDERS } from "../providers";


export async function runDailyCollection(): Promise<void> {
    console.log("[daily] collection started", new Date().toISOString());

    const locations = await prisma.location.findMany();
    console.log(`[daily] locations for handling: ${locations.length}`);

    for (const location of locations) {
        // Прогноз: каждый провайдер в своём try — сбой одного не срывает других.
        for (const provider of PROVIDERS) {
            try {
                const saved = await collectForecast(location, provider);
                console.log(`[daily] ${location.name} / ${provider.id}: forecast saved ${saved}`);
            } catch (err) {
                console.error(
                    `[daily] ${location.name} / ${provider.id}: forecast error`,
                    err instanceof Error ? err.message : err,
                );
            }
        }


        try {
            const obs = await collectObservations(location);
            console.log(`[daily] ${location.name}: observation saved (${obs.saved})`);
        } catch (err) {
            console.error(
                `[daily] ${location.name}: observation error`,
                err instanceof Error ? err.message : err,
            );
        }
    }

    console.log("[daily] collection finished");
}