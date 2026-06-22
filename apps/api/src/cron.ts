import cron from "node-cron";
import { prisma } from "./db";
import { collectForecast } from "./services/collectForecast";
import {collectObservations} from "./services/collectObservations";
import {PROVIDERS} from "./providers";

export function startCron() {
    console.log("[cron] started");

    cron.schedule("0 3 * * *", async () => {
        console.log("[cron] forecast collection started", new Date().toISOString());

        const locations = await prisma.location.findMany();
        console.log(`[cron] locations for handling: ${locations.length}`);

            for (const location of locations) {
                // Прогноз: каждый провайдер в своём try — сбой одного не срывает других.
                for (const provider of PROVIDERS) {
                    try {
                        const saved = await collectForecast(location, provider);
                        console.log(`[cron] ${location.name} / ${provider.id}: forecast saved ${saved}`);
                    } catch (err) {
                        console.error(
                            `[cron] ${location.name} / ${provider.id}: forecast error`,
                            err instanceof Error ? err.message : err,
                        );
                    }
                }

                // Факт собираем один раз на локацию (эталон ERA5, провайдер ни при чём).
                try {
                    const obs = await collectObservations(location);
                    console.log(`[cron] ${location.name}: observation saved (${obs.saved})`);
                } catch (err) {
                    console.error(
                        `[cron] ${location.name}: observation error`,
                        err instanceof Error ? err.message : err,
                    );
                }
            }

        console.log("[cron] сбор завершён");
    },
        {timezone: "Asia/Jerusalem"});
}