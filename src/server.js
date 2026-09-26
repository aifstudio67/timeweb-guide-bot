import "dotenv/config";
import express from "express";
import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { createGuideBot } from "./bot.js";
import { loadConfig } from "./config.js";
import { createLeadRepository } from "./database.js";

const config = loadConfig();
await access(config.guideFilePath, constants.R_OK);

const repository = createLeadRepository(config);
await repository.initialize();

const bot = createGuideBot({ config, repository });
const app = express();

app.disable("x-powered-by");
app.get("/health", (_request, response) => {
  response.status(200).json({ status: "ok" });
});

const server = app.listen(config.port, "0.0.0.0", () => {
  console.log(`Health endpoint listening on port ${config.port}`);
  bot.start({
    onStart: (botInfo) => console.log(`Bot @${botInfo.username} started`),
  });
});

async function shutdown(signal) {
  console.log(`${signal} received, stopping bot`);
  bot.stop();
  await repository.close();
  server.close(() => process.exit(0));
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
