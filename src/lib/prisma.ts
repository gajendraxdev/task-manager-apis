import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { DATABASE_URL } from "../constants/env.ts";

const adapter = new PrismaPg({ connectionString: DATABASE_URL });

// Singleton pattern — reuse the same client across the app
const prisma = new PrismaClient({ adapter });

export default prisma;
