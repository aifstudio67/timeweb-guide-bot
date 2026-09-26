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
function health(_request, response) {
  response.status(200).json({ status: "ok" });
}

// /health is configured in Timeweb. / also keeps the process healthy if its
// default root-path check is used instead.
app.get("/health", health);
app.get("/", health);

const server = app.listen(config.port, "0.0.0.0", () => {
  console.log(`Health endpoint listening on port ${config.port}`);
  void bot.start({
    onStart: (botInfo) => console.log(`Bot @${botInfo.username} started`),
  }).catch((error) => {
    console.error("Telegram bot failed to start", error);
    shutdown("Bot startup failure");
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
