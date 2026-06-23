import cron from "node-cron";
import { runDailyCollection } from "./services/runDailyCollections";

export function startCron() {
    console.log("[cron] started");

    cron.schedule(
        "0 3 * * *",
        async () => {
            console.log("[cron] triggered", new Date().toISOString());
            try {
                await runDailyCollection();
            } catch (err) {
                console.error(
                    "[cron] daily collection failed",
                    err instanceof Error ? err.message : err,
                );
            }
        },
        { timezone: "Asia/Jerusalem" },
    );
}