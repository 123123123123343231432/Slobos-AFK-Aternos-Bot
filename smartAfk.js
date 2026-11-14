"use strict";

const mc = require("minecraft-protocol");

function randomMs(minMs, maxMs) {
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

function setupSmartOnlineAfk(bot, createBot, config, botState, addLog) {
  const serverIp = config.server.ip;
  const serverPort = config.server.port || 25565;
  const serverVersion =
    config.server.version && config.server.version.trim() !== ""
      ? config.server.version
      : false;

  const smartConfig = config["smart-afk"] || {};
  const leaveAboveOnline = smartConfig["leave-above-online"] ?? 1;
  const rejoinAtOnline = smartConfig["rejoin-at-online"] ?? 0;
  const pingMin = smartConfig["ping-interval-min"] ?? 10000;
  const pingMax = smartConfig["ping-interval-max"] ?? 20000;

  let jumpTimer = null;
  let jumpOffTimer = null;
  let pingTimer = null;
  let stopped = false;

  function cleanupTimers() {
    if (jumpTimer) clearTimeout(jumpTimer);
    if (jumpOffTimer) clearTimeout(jumpOffTimer);
    if (pingTimer) clearTimeout(pingTimer);
    jumpTimer = jumpOffTimer = pingTimer = null;
  }

  function scheduleNextJump() {
    if (stopped || !bot.entity) return;

    bot.setControlState("jump", true);
    jumpOffTimer = setTimeout(() => {
      if (bot.entity) bot.setControlState("jump", false);
    }, 300);

    const nextJump = randomMs(20000, 5 * 60 * 1000);
    jumpTimer = setTimeout(scheduleNextJump, nextJump);
  }

  function checkInGamePlayers() {
    if (stopped || !bot.players) return;

    const playerNames = Object.keys(bot.players);
    const totalPlayers = playerNames.length;

    if (totalPlayers > leaveAboveOnline) {
      addLog(
        `[SmartAFK] Онлайн стал ${totalPlayers} (${playerNames.join(", ")}). Выхожу с сервера...`,
      );
      botState.pausedBySmartAfk = true;
      stopped = true;
      cleanupTimers();

      try {
        bot.quit();
      } catch (e) {}

      startServerPingLoop();
    }
  }

  function startServerPingLoop() {
    const checkInterval = randomMs(pingMin, pingMax);

    pingTimer = setTimeout(() => {
      mc.ping(
        {
          host: serverIp,
          port: serverPort,
          version: serverVersion,
        },
        (err, response) => {
          if (err) {
            addLog(`[SmartAFK] Ошибка пинга: ${err.message}`);
            startServerPingLoop();
            return;
          }

          const onlineCount = response.players?.online ?? 0;
          const motd = JSON.stringify(response.description || "");

          addLog(
            `[SmartAFK] Пинг OK | Онлайн: ${onlineCount} | MOTD: ${motd.slice(0, 80)}`,
          );

          const isOfflineAternos =
            motd.toLowerCase().includes("offline") ||
            motd.toLowerCase().includes("starting") ||
            motd.toLowerCase().includes("loading") ||
            motd.toLowerCase().includes("queue");

          if (!isOfflineAternos && onlineCount <= rejoinAtOnline) {
            addLog(
              `[SmartAFK] Сервер пуст (онлайн: ${onlineCount}). Возвращаюсь в игру...`,
            );
            botState.pausedBySmartAfk = false;
            cleanupTimers();
            if (typeof createBot === "function") {
              createBot();
            }
          } else {
            startServerPingLoop();
          }
        },
      );
    }, checkInterval);
  }

  bot.once("spawn", () => {
    stopped = false;
    botState.pausedBySmartAfk = false;
    cleanupTimers();

    addLog("[SmartAFK] Слежение за онлайном активно.");
    scheduleNextJump();
    setTimeout(checkInGamePlayers, 2000);
  });

  bot.on("playerJoined", (player) => {
    if (player.username !== bot.username) {
      checkInGamePlayers();
    }
  });

  bot.on("end", () => {
    cleanupTimers();
    if (!botState.pausedBySmartAfk) {
      stopped = true;
    }
  });

  bot.on("kicked", () => {
    if (!botState.pausedBySmartAfk) cleanupTimers();
  });

  bot.on("error", () => {
    if (!botState.pausedBySmartAfk) cleanupTimers();
  });
}

module.exports = setupSmartOnlineAfk;
