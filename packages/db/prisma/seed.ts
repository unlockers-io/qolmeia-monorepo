import "dotenv/config";

import { createPrismaClient } from "../src/client";
import { seedProductDefaults } from "../src/product-seed";

const prisma = createPrismaClient(process.env.DATABASE_URL ?? "");

await seedProductDefaults(prisma);

await prisma.$disconnect();
