import { expect, test } from "bun:test";
import type { Notification } from "./notification-service";
import {
  TelegramNotificationHandler,
  type TelegramMessageSender,
} from "./telegram-notification-handler";

const notification = (index: number): Notification => ({
  type: "watched-scripthash-requested",
  clientLabel: `wallet:${index}`,
  id: index,
  method: "blockchain.scripthash.subscribe",
  scriptHash: `${index}`.repeat(64).slice(0, 64),
  watchedAddress: {
    address: `bc1qaddress${index}`,
    index,
    path: `m/0/${index}`,
    scriptHash: `${index}`.repeat(64).slice(0, 64),
  },
});

test("debounces notifications into one Telegram message", async () => {
  const sent: Array<{ chatId: string; text: string }> = [];
  const sender: TelegramMessageSender = {
    async sendMessage(chatId, text) {
      sent.push({ chatId, text });
    },
  };
  const handler = new TelegramNotificationHandler({
    chatId: "12345",
    debounceMs: 10,
    sender,
  });

  handler.handle(notification(1));
  handler.handle(notification(2));

  await sleep(25);

  expect(sent).toHaveLength(1);
  expect(sent[0]).toMatchObject({
    chatId: "12345",
  });
  expect(sent[0]?.text).toContain("electrs-duress alert: 2 watched requests");
  expect(sent[0]?.text).toContain("address: bc1qaddress1");
  expect(sent[0]?.text).toContain("address: bc1qaddress2");
});

test("resets the debounce timer when new notifications arrive", async () => {
  const sent: Array<{ chatId: string; text: string }> = [];
  const sender: TelegramMessageSender = {
    async sendMessage(chatId, text) {
      sent.push({ chatId, text });
    },
  };
  const handler = new TelegramNotificationHandler({
    chatId: "12345",
    debounceMs: 20,
    sender,
  });

  handler.handle(notification(1));
  await sleep(15);
  handler.handle(notification(2));
  await sleep(10);

  expect(sent).toEqual([]);

  await sleep(20);

  expect(sent).toHaveLength(1);
  expect(sent[0]?.text).toContain("2 watched requests");
});

test("flushes pending Telegram notifications immediately when requested", async () => {
  const sent: Array<{ chatId: string; text: string }> = [];
  const sender: TelegramMessageSender = {
    async sendMessage(chatId, text) {
      sent.push({ chatId, text });
    },
  };
  const handler = new TelegramNotificationHandler({
    chatId: "12345",
    debounceMs: 10_000,
    sender,
  });

  handler.handle(notification(1));
  await handler.flush();

  expect(sent).toHaveLength(1);
  expect(sent[0]?.text).toContain("1 watched request");
});

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
