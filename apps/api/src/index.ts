import Fastify from "fastify";
import type { HealthResponse, ComparisonRow } from "@weather-verify/shared";
import {prisma} from "./db";
import { fetchOpenMeteoForecast} from "./openMeteo";
import {fetchOpenMeteoArchive} from "./openMeteoArchive";
import { fetchPreviousRuns } from "./openMeteoPreviousRuns";
import { startCron } from "./cron";
import {collectForecast} from "./services/collectForecast";
import {collectObservations} from "./services/collectObservations";
import {PROVIDERS} from "./providers";
import {LocationCreateSchema, IdParamSchema, ObservationsQuerySchema} from "./schemas/locationSchemas";
import {ZodError} from "zod";


const app = Fastify({
    logger: {
        transport: {
            target: "pino-pretty",
            options: { translateTime: "HH:MM:ss", ignore: "pid,hostname" },
        },
    },
});
app.setErrorHandler((error, request, reply) => {

    if (error instanceof ZodError) {
        const details = error.issues.map((i) => ({
            field: i.path.join(".") || "(request)",
            message: i.message,
        }));
        reply.code(400);
        return { error: "Invalid request data", details };
    }

    request.log.error(error);
    const statusCode =
        error instanceof Error &&
        "statusCode" in error &&
        typeof error.statusCode === "number"
            ? error.statusCode
            : 500;

    reply.code(statusCode);
    return {
        error: error instanceof Error ? error.message : "Internal Server Error",
    };
});

function round2(x: number): number {
    return Math.round(x * 100) / 100;
}

app.get("/api/health", async (): Promise<HealthResponse> => {
    return {
        status: "ok",
        service: "weather-verify-api",
        time: new Date().toISOString(),
    };
});

const port = Number(process.env.PORT ?? 3000);
app.get("/api/locations/count", async () => {
    const count = await prisma.location.count();
    return { count };
});
app.post("/api/locations", async (request, reply) => {
    const body = LocationCreateSchema.parse(request.body);

    const location = await prisma.location.create({
        data: body,
    });

    return location;
});

// Вернуть все локации.
app.get("/api/locations", async () => {
    return prisma.location.findMany();
});



app.get("/api/locations/:id/forecast", async (request, reply) => {
    const { id } = IdParamSchema.parse(request.params);

    const location = await prisma.location.findUnique({ where: { id } });
    if (!location) {
        return reply.code(404).send({ error: "Локация не найдена" });
    }

    const forecast = await fetchOpenMeteoForecast(location);

    return { location: location.name, forecast };
});

// Тянет прогноз Open-Meteo и СОХРАНЯЕТ его в базу.
app.post("/api/locations/:id/forecast", async (request, reply) => {
    const { id } = IdParamSchema.parse(request.params);

    const location = await prisma.location.findUnique({ where: { id } });
    if (!location) {
        return reply.code(404).send({ error: "Локация не найдена" });
    }
    const saved: Record<string, number> = {};
    for (const provider of PROVIDERS) {
        saved[provider.id] = await collectForecast(location, provider);
    }

    return { location: location.name, saved };
});
app.post("/api/locations/:id/observations", async (request, reply) => {
    const { id } = IdParamSchema.parse(request.params);
    const { days } = ObservationsQuerySchema.parse(request.query);

    const location = await prisma.location.findUnique({where: {id}});
    if (!location) {
        return reply.code(404).send({error: "Локация не найдена"});
    }

    const result = await collectObservations(location, days);
    return {location: location.name, ...result};
});
app.get("/api/locations/:id/comparison", async (request, reply) => {
    const { id } = IdParamSchema.parse(request.params);

    const location = await prisma.location.findUnique({ where: { id } });
    if (!location) {
        return reply.code(404).send({ error: "Локация не найдена" });
    }

    // Берём все факты и все прогнозы этой локации.
    const observations = await prisma.observation.findMany({
        where: { locationId: id },
    });
    const forecasts = await prisma.forecast.findMany({
        where: { locationId: id },
    });

    // Раскладываем факт в "карту" по дате (для быстрого поиска).
    const obsByDate = new Map<string, (typeof observations)[number]>();
    for (const obs of observations) {
        obsByDate.set(obs.date.toISOString().slice(0, 10), obs);
    }

    // Для каждого прогноза ищем факт на тот же targetDate.
    const comparisonByProvider: Record<string, ComparisonRow[]> = {};
    for (const fc of forecasts) {
        const dateKey = fc.targetDate.toISOString().slice(0, 10);
        const obs = obsByDate.get(dateKey);
        if (!obs) continue; // нет факта на этот день — пропускаем

        // Ошибка прогноза = прогноз минус факт.
        const errMax =
            fc.tempMax != null && obs.tempMax != null
                ? Number((fc.tempMax - obs.tempMax).toFixed(1))
                : null;
        const errMin =
            fc.tempMin != null && obs.tempMin != null
                ? Number((fc.tempMin - obs.tempMin).toFixed(1))
                : null;

        const row = {
            targetDate: dateKey,
            leadTimeDays: fc.leadTimeDays,
            forecastMax: fc.tempMax,
            actualMax: obs.tempMax,
            errorMax: errMax,
            forecastMin: fc.tempMin,
            actualMin: obs.tempMin,
            errorMin: errMin,
        };

        if (!comparisonByProvider[fc.provider]) {
            comparisonByProvider[fc.provider] = [];
        }
        comparisonByProvider[fc.provider].push(row);
    }

    for (const rows of Object.values(comparisonByProvider)) {
        rows.sort((a, b) => a.leadTimeDays - b.leadTimeDays);
    }

    return { location: location.name, comparisonByProvider };
});

// Загружает "прошлый прогноз" на уже прошедшие даты (для демонстрации сравнения).
// Использует тот же Archive API, что и факт, но кладёт данные в Forecast.
app.post("/api/locations/:id/backfill-forecast", async (request, reply) => {
    const { id } = IdParamSchema.parse(request.params);

    const location = await prisma.location.findUnique({ where: { id } });
    if (!location) {
        return reply.code(404).send({ error: "Локация не найдена" });
    }

    // Тот же период, что у факта: [сегодня-15] ... [сегодня-5].
    const toDate = new Date();
    toDate.setDate(toDate.getDate() - 5);
    const fromDate = new Date(toDate);
    fromDate.setDate(fromDate.getDate() - 10);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    const past = await fetchOpenMeteoArchive(
        location.lat,
        location.lon,
        location.timezone,
        fmt(fromDate),
        fmt(toDate)
    );

    // issuedDate ставим равным targetDate, leadTimeDays = -1 как пометку
    // "это backfill, а не настоящий прогноз с горизонтом".
    const provider = "open-meteo"
    let saved = 0;
    for (const day of past) {
        const target = new Date(day.date);
        await prisma.forecast.upsert({
            where: {
                locationId_provider_issuedDate_targetDate: {
                    locationId: location.id,
                    issuedDate: target,
                    targetDate: target,
                    provider,
                },
            },
            update: {
                tempMin: day.tempMin,
                tempMax: day.tempMax,
                precipMm: day.precipMm,
            },
            create: {
                locationId: location.id,
                issuedDate: target,
                targetDate: target,
                leadTimeDays: -1,
                tempMin: day.tempMin,
                tempMax: day.tempMax,
                precipMm: day.precipMm,
                provider,
            },
        });
        saved++;
    }

    return { location: location.name, from: fmt(fromDate), to: fmt(toDate), saved };
});

app.post("/api/locations/:id/backfill-previous-runs", async (request, reply) => {
    const { id } = IdParamSchema.parse(request.params);

    const location = await prisma.location.findUnique({ where: { id } });
    if (!location) {
        return reply.status(404).send({ error: "Локация не найдена" });
    }

    const days = await fetchPreviousRuns(location.lat, location.lon, location.timezone);

    const provider = "open-meteo"
    let saved = 0;
    for (const d of days) {
        // targetDate — местная календарная дата; issuedDate = targetDate минус N дней.
        const targetDate = new Date(`${d.date}T00:00:00Z`);
        const issuedDate = new Date(targetDate);
        issuedDate.setUTCDate(issuedDate.getUTCDate() - d.leadTimeDays);

        await prisma.forecast.upsert({
            where: {
                locationId_provider_issuedDate_targetDate: {
                    locationId: id,
                    provider,
                    issuedDate,
                    targetDate,
                },
            },
            update: {
                leadTimeDays: d.leadTimeDays,
                tempMin: d.tempMin,
                tempMax: d.tempMax,
            },
            create: {
                locationId: id,
                provider,
                issuedDate,
                targetDate,
                leadTimeDays: d.leadTimeDays,
                tempMin: d.tempMin,
                tempMax: d.tempMax,
            },
        });
        saved += 1;
    }

    return { saved, location: location.name };
});

app.get("/api/locations/:id/lead-time-stats", async (request) => {
    const { id } = IdParamSchema.parse(request.params);

    const [forecasts, observations] = await Promise.all([
        prisma.forecast.findMany({ where: { locationId: id } }),
        prisma.observation.findMany({ where: { locationId: id } }),
    ]);

    const obsByDate = new Map(
        observations.map((o) => [o.date.toISOString().slice(0, 10), o]),
    );

    type Group = {
        count: number;
        sumAbsMax: number; nMax: number;
        sumAbsMin: number; nMin: number;
    };

    // Двухуровневая группировка: provider -> (leadTimeDays -> Group).
    const byProvider = new Map<string, Map<number, Group>>();

    for (const f of forecasts) {
        if (f.leadTimeDays < 1) continue;
        const obs = obsByDate.get(f.targetDate.toISOString().slice(0, 10));
        if (!obs) continue;

        // Достаём (или заводим) карту групп для этого провайдера.
        let groups = byProvider.get(f.provider);
        if (!groups) {
            groups = new Map<number, Group>();
            byProvider.set(f.provider, groups);
        }

        let g = groups.get(f.leadTimeDays);
        if (!g) {
            g = { count: 0, sumAbsMax: 0, nMax: 0, sumAbsMin: 0, nMin: 0 };
            groups.set(f.leadTimeDays, g);
        }
        g.count += 1;

        if (f.tempMax != null && obs.tempMax != null) {
            g.sumAbsMax += Math.abs(f.tempMax - obs.tempMax);
            g.nMax += 1;
        }
        if (f.tempMin != null && obs.tempMin != null) {
            g.sumAbsMin += Math.abs(f.tempMin - obs.tempMin);
            g.nMin += 1;
        }
    }

    // Превращаем вложенные Map в обычный объект { provider: stats[] }.
    const statsByProvider: Record<string, Array<{ leadTimeDays: number; count: number; maeMax: number | null; maeMin: number | null }>
        > = {};

    for (const [provider, groups] of byProvider) {
        statsByProvider[provider] = [...groups.entries()]
            .map(([leadTimeDays, g]) => ({
                leadTimeDays,
                count: g.count,
                maeMax: g.nMax > 0 ? round2(g.sumAbsMax / g.nMax) : null,
                maeMin: g.nMin > 0 ? round2(g.sumAbsMin / g.nMin) : null,
            }))
            .sort((a, b) => a.leadTimeDays - b.leadTimeDays);
    }

    return { statsByProvider };
});

app.listen({ port, host: "0.0.0.0" }).then(()=> {startCron()}).catch((err) => {
    app.log.error(err);

    process.exit(1);
});