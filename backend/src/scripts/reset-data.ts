// npm run reset-data — puts the sample data back in the database, wiping any changes.
import "dotenv/config";
import prisma from "../lib/prisma.js";
import { loadData } from "../store/importData.js";
import { createSeedData, DEMO_PASSWORD } from "../store/seed.js";

await loadData(createSeedData());
await prisma.$disconnect();
console.log("Sample data written to the database.");
console.log(`Every sample account uses the password: ${DEMO_PASSWORD}`);
