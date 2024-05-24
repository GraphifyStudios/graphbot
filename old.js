require("dotenv/config");

const { LiveChat } = require("youtube-chat");
const botID = "UC8qtw3cJ0A0ItDcLCnJzstg";

const chat = new LiveChat({
  liveId: require("./config.json").livestreamId,
});

const Enmap = require("enmap");

/** @type {Enmap.default} */
const xpDb = new Enmap({
  name: "xpDatabase",
  dataDir: "./db/xp",
});

/** @type {Enmap.default} */
const pointsDb = new Enmap({
  name: "pointsDatabase",
  dataDir: "./db/points",
});

/** @type {Enmap.default} */
const votesDb = new Enmap({
  name: "votesDatabase",
  dataDir: "./db/votes",
});
Object.keys(require("./oldVotes.json")).forEach((key) => {
  votesDb.ensure(key, require("./oldVotes.json")[key]);
});

/** @type {Enmap.default} */
const countDb = new Enmap({
  name: "countDatabase",
  dataDir: "./db/count",
});
countDb.ensure("count", 0);
countDb.ensure("lastCounted", []);

const activeUsers = new Map();

chat.on("start", () => {
  setTimeout(() => {
    chat.on("chat", chatHandler);
  }, 4000);
});

chat.start();
require("./server.js")({
  xp: xpDb,
  votes: votesDb,
  points: pointsDb,
  count: countDb,
  activeUsers,
});

const ignoredCommands = [
  "!sr",
  "!songrequest",
  "!skip",
  "!currentsong",
  "!nextsong",
  "!pizza",
  "!uptime",
  "!points",
  "!hours",
  "!top",
  "!tophours",
  "!addpoints",
  "!removepoints",
  "!give",
  "!gamble",
  "!addcommand",
  "!removecommand",
  "!editcommand",
  "!enable",
  "!playlist",
  "!rules",
  "!discord",
];

const random = (min, max) =>
  Math.floor(Math.random() * (Math.floor(max) - Math.ceil(min) + 1)) + min;

setInterval(() => {
  const keys = [...activeUsers.keys()];
  for (const key of keys) {
    const date = activeUsers.get(key).date;
    if (new Date() - new Date(date) > 1 * 60 * 1000) {
      activeUsers.delete(key);
      continue;
    }
    pointsDb.ensure(key, {
      points: 0,
    });
    pointsDb.math(key, "+", random(1, 5), "points");
  }
  if (activeUsers.size !== 0)
    sendMessage(
      `${activeUsers.size} ${
        activeUsers.size === 1 ? "person has" : "people have"
      } been given points!`
    );
}, 1 * 60 * 1000);

/**
 * @param {import('youtube-chat/dist/types/data').ChatItem} chat
 */
function chatHandler(chat) {
  console.log(chat);

  if (chat.author.channelId === botID) return;

  const message = chat.message
    .map((item) => (item.emojiText ? `:${item.emojiText}:` : item.text))
    .join(" ");

  if (message.startsWith("!rank") || message.startsWith("!xp")) {
    xpDb.ensure(chat.author.channelId, {
      xp: 0,
      level: 0,
    });
    sendMessage(
      `${chat.author.name}, you have ${xpDb
        .get(chat.author.channelId, "xp")
        .toLocaleString()} xp and you're level ${xpDb
        .get(chat.author.channelId, "level")
        .toLocaleString()}. To reach the next level, you need to reach ${calculateLevelXp(
        xpDb.get(chat.author.channelId, "level") + 1
      )} xp.`
    );
    return;
  } else if (message.startsWith("!points")) {
    pointsDb.ensure(chat.author.channelId, {
      points: 0,
    });
    sendMessage(
      `${chat.author.name}, you have ${pointsDb.get(
        chat.author.channelId,
        "points"
      )} points.`
    );
    return;
  } else if (
    message.startsWith("!") &&
    !ignoredCommands.some((command) =>
      message.toLowerCase().startsWith(command)
    )
  ) {
    const votee = message.split("!")[1].split(" ")[0].toLowerCase();

    votesDb.ensure(votee, 0);
    votesDb.math(votee, "+", 1);

    sendMessage(
      `${chat.author.name} has voted for ${votee}, and so has ${votesDb
        .get(votee)
        .toLocaleString()} other people!`
    );
    return;
  } else if (message.toLowerCase() === "h") {
    votesDb.ensure("h", 0);
    votesDb.math("h", "+", 1);

    sendMessage(`h. ${votesDb.get("h")} other people have h'ed.`);
    return;
  }

  const messageObj = {
    content: message,
    author: { name: chat.author.name, id: chat.author.channelId },
  };

  level(messageObj);
  points(messageObj);
  counting(messageObj);

  const hellos = ["hello", "hi", "hey"];
  if (hellos.some((hello) => message.startsWith(hello))) {
    sendMessage(
      `Hello ${chat.author.name}! Welcome to the Graphify stream! We hope you enjoy your stay.`
    );
    return;
  }

  const goodbyes = ["bye", "cya", "gtg", "goodbye"];
  if (goodbyes.some((goodbye) => message.startsWith(goodbye))) {
    sendMessage(
      `Goodbye ${chat.author.name}! We hope to see you here again soon!`
    );
    return;
  }
}

const xpCooldowns = new Set();
const calculateLevelXp = (level) => 100 * level || 1;

/**
 * @param {{ content: string; author: { name: string, id: string; } }} message
 */
function level(message) {
  if (xpCooldowns.has(message.author.id)) return;

  const xpToGive = random(5, 15);

  xpDb.ensure(message.author.id, {
    xp: 0,
    level: 0,
  });

  xpDb.math(message.author.id, "+", xpToGive, "xp");

  xpCooldowns.add(message.author.id);
  setTimeout(() => xpCooldowns.delete(message.author.id), 30_000);

  const user = xpDb.get(message.author.id);
  if (user.xp > calculateLevelXp(user.level)) {
    xpDb.math(message.author.id, "+", 1, "level");

    sendMessage(
      `LEVEL UP! ⬆️ ${message.author.name} has leveled up to level ${xpDb
        .get(message.author.id, "level")
        .toLocaleString()}.`
    );
  }
}

/**
 * @param {{ content: string; author: { name: string, id: string; } }} message
 */
function points(message) {
  activeUsers.set(message.author.id, {
    name: message.author.name,
    date: Date.now(),
  });
  pointsDb.ensure(message.author.id, {
    messages: 0,
  });
  pointsDb.math(message.author.id, "+", 1, "messages");
}
/**
 * @param {{ content: string; author: { name: string, id: string; } }} message
 */
function counting(message) {
  const firstArg = message.content.split(" ")[0].split(",").join("");

  if (!isNaN(firstArg)) {
    const num = parseInt(firstArg);
    if (num !== countDb.get("count") + 1) return;

    countDb.set("count", num);

    let lastCounted = countDb.get("lastCounted");
    if (lastCounted.length > 9) lastCounted = lastCounted.slice(0, 9);

    lastCounted.unshift({
      name: message.author.name,
      id: message.author.id,
      count: num,
    });

    countDb.set("lastCounted", lastCounted);
  }
}

const axios = require("axios").default;
async function sendMessage(text) {
  const body = {
    ...require("./body.json"),
    richMessage: { textSegments: [{ text }] },
  };
  const { data } = await axios.post(
    "https://www.youtube.com/youtubei/v1/live_chat/send_message?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8&prettyPrint=false",
    body,
    {
      headers: {
        accept: "*/*",
        "accept-language": "en-US,en;q=0.9",
        authorization: process.env.AUTHORIZATION,
        "content-type": "application/json",
        "sec-ch-ua":
          '"Not/A)Brand";v="99", "Google Chrome";v="115", "Chromium";v="115"',
        "sec-ch-ua-arch": '"x86"',
        "sec-ch-ua-bitness": '"64"',
        "sec-ch-ua-full-version": '"115.0.5790.110"',
        "sec-ch-ua-full-version-list":
          '"Not/A)Brand";v="99.0.0.0", "Google Chrome";v="115.0.5790.110", "Chromium";v="115.0.5790.110"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-model": '""',
        "sec-ch-ua-platform": '"Windows"',
        "sec-ch-ua-platform-version": '"15.0.0"',
        "sec-ch-ua-wow64": "?0",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "same-origin",
        "sec-fetch-site": "same-origin",
        "x-client-data": process.env.CLIENT_DATA,
        "x-goog-authuser": "0",
        "x-goog-pageid": process.env.GOOG_PAGE_ID,
        "x-goog-visitor-id": process.env.GOOG_VISITOR_ID,
        "x-origin": "https://www.youtube.com",
        "x-youtube-bootstrap-logged-in": "true",
        "x-youtube-client-name": "1",
        "x-youtube-client-version": "2.20230728.00.00",
        cookie: process.env.COOKIE,
        Referer:
          "https://www.youtube.com/live_chat?continuation=0ofMyAN-Gl5DaWtxSndvWVZVTm5SelZoVW1OWlIzcFFVRUkwVlVjemJWTXRXazVuRWd0RWEzcGtjMEl0TlU5NVl4b1Q2cWpkdVFFTkNndEVhM3BrYzBJdE5VOTVZeUFCTUFBJTNEMAGCAQYIBBgCIACIAQGgAbzmxqyXs4ADqAEAsgEA",
        "Referrer-Policy": "strict-origin-when-cross-origin",
      },
    }
  );
  return data;
}
