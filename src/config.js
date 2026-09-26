import { resolve } from "node:path";

function required(name, value) {
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function port(value) {
  const parsed = Number.parseInt(value ?? "3000", 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65_535) {
    throw new Error("PORT must be a valid TCP port");
  }
  return parsed;
}

export function loadConfig(env = process.env) {
  const guideFilePath = resolve(
    process.cwd(),
    env.GUIDE_FILE_PATH ?? "assets/timeweb-cloud-app-deploy-guide.pdf",
  );

  return {
    botToken: required("TELEGRAM_BOT_TOKEN", env.TELEGRAM_BOT_TOKEN),
    channelId: required("CHANNEL_ID", env.CHANNEL_ID),
    channelUrl: required("CHANNEL_URL", env.CHANNEL_URL),
    databaseUrl: required("DATABASE_URL", env.DATABASE_URL),
    databaseSsl: env.DATABASE_SSL === "true",
    guideFilePath,
    port: port(env.PORT),
  };
}
