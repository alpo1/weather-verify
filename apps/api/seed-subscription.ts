import { prisma } from "./src/db";

const email = "me@example.com";

async function main() {
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    const locations = await prisma.location.findMany();
    for (const loc of locations) {
        await prisma.userLocation.upsert({
            where: { userId_locationId: { userId: user.id, locationId: loc.id } },
            update: {},
            create: { userId: user.id, locationId: loc.id },
        });
    }
    console.log(`subscribed ${user.email} to ${locations.length} location(s)`);
}

main().then(() => process.exit(0));