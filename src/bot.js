import { Bot, GrammyError, HttpError, InlineKeyboard, InputFile } from "grammy";
import { isActiveChannelMember, parseStartSource } from "./membership.js";

function claimKeyboard(config) {
  return new InlineKeyboard()
    .url("Подписаться на канал", config.channelUrl)
    .row()
    .text("Проверить и получить гайд", "check_subscription");
}

function interestKeyboard() {
  return new InlineKeyboard()
    .text("Лендинг или сайт", "interest:site")
    .text("Next.js", "interest:nextjs")
    .row()
    .text("Бот или API", "interest:bot_api")
    .text("Пока изучаю", "interest:learning")
    .row()
    .text("Нужна помощь с запуском", "request_help");
}

async function register(repository, from, source) {
  await repository.upsertLead(from, source);
  await repository.recordEvent(from.id, "bot_started", source);
}

export function createGuideBot({ config, repository }) {
  const bot = new Bot(config.botToken);

  bot.command("start", async (ctx) => {
    const source = parseStartSource(ctx.match);
    await register(repository, ctx.from, source);

    await ctx.reply(
      "Привет! Здесь можно получить PDF-инструкцию: как подготовить проект с ИИ, загрузить его на GitHub и развернуть через Timeweb Cloud.\n\n1. Подпишитесь на канал.\n2. Нажмите «Проверить и получить гайд».\n\nПосле проверки бот сразу пришлёт файл.",
      { reply_markup: claimKeyboard(config) },
    );
  });

  bot.callbackQuery("check_subscription", async (ctx) => {
    const source = "check_subscription";
    await register(repository, ctx.from, source);

    try {
      const member = await ctx.api.getChatMember(config.channelId, ctx.from.id);

      if (!isActiveChannelMember(member)) {
        await repository.recordEvent(ctx.from.id, "subscription_check_failed");
        await ctx.answerCallbackQuery({ text: "Подписка пока не найдена" });
        await ctx.reply(
          "Похоже, вы ещё не подписались. Откройте канал, подпишитесь и нажмите кнопку ещё раз.",
          { reply_markup: claimKeyboard(config) },
        );
        return;
      }

      await ctx.answerCallbackQuery({ text: "Подписка подтверждена" });
      await repository.markSubscribed(ctx.from.id);
      await repository.recordEvent(ctx.from.id, "subscription_confirmed");

      await ctx.replyWithDocument(new InputFile(config.guideFilePath), {
        caption: "Готово! Вот ваш PDF-гайд по развёртыванию приложения через Timeweb Cloud.",
      });
      await repository.markGuideSent(ctx.from.id);
      await repository.recordEvent(ctx.from.id, "guide_sent");

      await ctx.reply(
        "Чтобы присылать вам полезные материалы по делу, выберите, что вы хотите развернуть:",
        { reply_markup: interestKeyboard() },
      );
    } catch (error) {
      console.error("Subscription check failed", error);
      await ctx.answerCallbackQuery({
        text: "Не удалось проверить подписку. Попробуйте ещё раз.",
        show_alert: true,
      });
    }
  });

  bot.callbackQuery(/^interest:(site|nextjs|bot_api|learning)$/, async (ctx) => {
    const interest = ctx.match[1];
    await repository.setInterest(ctx.from.id, interest);
    await repository.recordEvent(ctx.from.id, `interest_${interest}`);
    await ctx.answerCallbackQuery({ text: "Сохранил, спасибо" });
    await ctx.reply("Принято. В канале будут разборы и материалы по этой теме.");
  });

  bot.callbackQuery("request_help", async (ctx) => {
    await repository.markHelpRequested(ctx.from.id);
    await repository.recordEvent(ctx.from.id, "help_requested");
    await ctx.answerCallbackQuery({ text: "Заявка отмечена" });
    await ctx.reply(
      "Опишите одним сообщением, что вы хотите запустить и на каком вы сейчас этапе. Если есть ссылка на репозиторий или ошибка деплоя - приложите её.",
    );
  });

  bot.on("message:text", async (ctx) => {
    await repository.recordEvent(ctx.from.id, "freeform_message");
    await ctx.reply(
      "Спасибо, сообщение получено. Я отвечу, когда посмотрю задачу. Пока можно изучить гайд и материалы в канале.",
    );
  });

  bot.catch((error) => {
    const { ctx } = error;
    console.error(`Update ${ctx.update.update_id} failed`);

    if (error.error instanceof GrammyError) {
      console.error("Telegram API error", error.error.description);
    } else if (error.error instanceof HttpError) {
      console.error("Telegram network error", error.error);
    } else {
      console.error("Unhandled bot error", error.error);
    }
  });

  return bot;
}
