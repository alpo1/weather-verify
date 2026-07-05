import { prisma } from "../db";

export function getOwnedLocation(userId: string, locationId: string) {
    return prisma.location.findFirst({
        where: {
            id: locationId,
            userLocations: { some: { userId } },
        },
    });
}