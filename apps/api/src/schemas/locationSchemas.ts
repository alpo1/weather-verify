import { z } from "zod";

function isValidTimeZone(tz: string): boolean {
    try {
        Intl.DateTimeFormat(undefined, { timeZone: tz });
        return true;
    } catch {
        return false;
    }
}
// Схема тела запроса для POST /api/locations
export const LocationCreateSchema = z.object({
    name: z.string().min(1, "name: expected not to be empty"),
    country: z.string().optional(),
    lat: z.number().min(-90, "lat: from -90 till 90").max(90, "lat: from -90 till 90"),
    lon: z.number().min(-180, "lon: from -180 till 180").max(180, "lon: from -180 till 180"),
    timezone: z
        .string()
        .min(1, "timezone: expected not to be empty")
        .refine(isValidTimeZone, "timezone: unknown IANA zone (e.g. Asia/Jerusalem)"),
    geonameId: z.number().int().positive().optional(),
});

export const IdParamSchema = z.object({
    id: z.uuid("id: expected location UUID"),
});

export const ObservationsQuerySchema = z.object({
    days: z.coerce
        .number("days: expected number")
        .int("days: expected integer")
        .positive("days: must be > 0")
        .max(60, "days: <= 60")
        .default(10),
});

// Тип, выведенный ИЗ схемы (если где-то понадобится назвать его явно)
export type LocationCreateInput = z.infer<typeof LocationCreateSchema>;