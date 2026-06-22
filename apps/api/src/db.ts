import { PrismaClient } from "./generated/prisma/client";

// Один экземпляр клиента на всё приложение — через него идут все запросы к базе.
export const prisma = new PrismaClient();