import { expect, test } from "bun:test";
import { NotificationService, type Notification } from "./notification-service";

const notification: Notification = {
  type: "watched-scripthash-requested",
  clientLabel: "wallet:1",
  id: 1,
  method: "blockchain.scripthash.subscribe",
  scriptHash: "a".repeat(64),
  watchedAddress: {
    address: "1Exq3M51dXqk8eHnosigC5DPDVYbxz9934",
    index: 0,
    path: "m/0/0",
    scriptHash: "a".repeat(64),
  },
};

test("publishes notifications to all registered handlers", async () => {
  const notificationService = new NotificationService();
  const handled: string[] = [];

  notificationService.register({
    handle(received) {
      handled.push(`first:${received.type}`);
    },
  });
  notificationService.register({
    handle(received) {
      handled.push(`second:${received.type}`);
    },
  });

  await notificationService.notify(notification);

  expect(handled).toEqual([
    "first:watched-scripthash-requested",
    "second:watched-scripthash-requested",
  ]);
});

test("returns an unregister function for handlers", async () => {
  const notificationService = new NotificationService();
  const handled: Notification[] = [];
  const unregister = notificationService.register({
    handle(received) {
      handled.push(received);
    },
  });

  unregister();
  await notificationService.notify(notification);

  expect(handled).toEqual([]);
});
