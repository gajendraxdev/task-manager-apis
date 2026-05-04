import Fastify, { type FastifyInstance } from "fastify";
import fastifyCors from "@fastify/cors";
import { registerRoutes } from "./components/registerRoutes.ts";
import { ALLOWED_ORIGINS, PORT } from "./constants/env.ts";
import { isProdEnvironment } from "./components/utils/isProd.ts";
import prisma from "./lib/prisma.ts";

const app: FastifyInstance = Fastify({
  logger: isProdEnvironment()
    ? true
    : {
        transport: {
          target: "pino-pretty",
          options: {
            colorized: true,
            singleLine: true,
            translateTime: "HH:MM:ss.l",
          },
        },
      },
});

app.register(fastifyCors, {
  origin: ALLOWED_ORIGINS,
  methods: ["POST", "PATCH", "GET", "DELETE"],
  allowedHeaders: ["*"],
});

app.get("/api/health", () => {
  return { status: true, message: "Server Looks good 👍" };
});

// Graceful shutdown — disconnect Prisma on close
app.addHook("onClose", async () => {
  await prisma.$disconnect();
});

registerRoutes(app);

app.listen({ port: PORT, host: "0.0.0.0" }, (err) => {
  console.log("Server Started...");
  if (err) throw err;
});
