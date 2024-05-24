import "dotenv/config";

import Enmap from "enmap";
import moment from "moment";

const xpDb = new Enmap({
  name: "xpDatabase",
  dataDir: "./db/xp",
});

const pointsDb = new Enmap({
  name: "pointsDatabase",
  dataDir: "./db/points",
});

const votesDb = new Enmap({
  name: "votesDatabase",
  dataDir: "./db/votes",
});

// import fs from "fs";
// const oldVotes = JSON.parse(fs.readFileSync("./oldVotes.json", "utf8"));
// Object.keys(oldVotes).forEach((key) => {
//   votesDb.ensure(key, oldVotes[key]);
// });

const countDb = new Enmap({
  name: "countDatabase",
  dataDir: "./db/count",
});
countDb.ensure("count", 0);
countDb.ensure("lastCounted", []);

const messagesDb = new Enmap({
  name: "messagesDatabase",
  dataDir: "./db/messages",
});
messagesDb.ensure("messages", 0);

const linkedDb = new Enmap({
  name: "linkedDatabase",
  dataDir: "./db/linked",
});
const linkCodes = new Map();

const latestVideosDb = new Enmap({
  name: "latestVideosDatabase",
  dataDir: "./db/latest-videos",
});
latestVideosDb.ensure("UCX6OQ3DkcsbYNE6H8uQQuVA", {
  video: "",
  short: "",
});
latestVideosDb.ensure("UCgG5aRcYGzPPB4UG3mS-ZNg", {
  video: "WCLeZeUC2vE",
  short: "sNpv-WPE0a0",
});

const activeUsers = new Map();

import axios from "axios";
import { Masterchat, stringify } from "masterchat";
const mc = await Masterchat.init(process.env.LIVESTREAM_ID, {
  credentials: process.env.CREDENTIALS,
  axiosInstance: axios.create({
    timeout: 30000,
  }),
});

const random = (min, max) =>
  Math.floor(Math.random() * (Math.floor(max) - Math.ceil(min) + 1)) + min;
const duration = 60 * 1000;

setInterval(() => {
  const keys = [...activeUsers.keys()];
  for (const key of keys) {
    const date = activeUsers.get(key).date;
    if (new Date() - new Date(date) > duration) {
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
      } been given points!`,
    );
}, duration);

function getLatestVideos(channelId, channelName) {
  const ISO8601Duration = (ISO) => {
    const units = {
      Y: 31536000,
      M: 2592000,
      D: 86400,
      H: 3600,
      M: 60,
      S: 1,
    };

    const unitsKeys = Object.keys(units);
    let newISO = ISO.replace("P", "").replace("T", "");
    let foundedKeys = [];
    let durationISO = [];

    for (let i = 0; i < newISO.length; i++) {
      if (unitsKeys.includes(newISO[i]) == true) {
        foundedKeys.push(newISO[i]);
        newISO = newISO.replace(newISO[i], " ");
      }
    }

    newISO = newISO.split(" ");
    newISO.pop();

    for (let i = 0; i < foundedKeys.length; i++) {
      durationISO[i] = Number(newISO[i]) * units[foundedKeys[i]];
    }

    let duration = durationISO.reduce((a, b) => a + b, 0);

    return duration;
  };

  fetch(
    `https://yt.lemnoslife.com/noKey/playlistItems?part=snippet&fields=items/snippet/resourceId/videoId&order=date&maxResults=10&playlistId=${channelId.replace("UC", "UU")}`,
  )
    .then((res) => res.json())
    .then((videos) => {
      let vidIds = videos.items.map((video) => {
        return video.snippet.resourceId.videoId;
      });

      if (vidIds !== null) {
        fetch(
          `https://yt.lemnoslife.com/noKey/videos?part=snippet,liveStreamingDetails,contentDetails&fields=items(id,snippet/title,snippet/publishedAt,liveStreamingDetails,contentDetails/duration)&id=${vidIds.join(
            ",",
          )}`,
        )
          .then((res) => res.json())
          .then((filteredVideos) => {
            let filteredVids = filteredVideos.items;
            const currentVideo = filteredVids.filter(
              (filteredVid) =>
                ISO8601Duration(filteredVid.contentDetails.duration) > 60,
            )[0];
            const currentVideoId = currentVideo.id;
            const currentShort = filteredVids.filter(
              (filteredVid) =>
                ISO8601Duration(filteredVid.contentDetails.duration) <= 60,
            )[0];
            const currentShortId = currentShort.id;

            const { video: lastVideoId, short: lastShortId } =
              latestVideosDb.get(channelId);
            if (lastVideoId !== currentVideoId) {
              latestVideosDb.set(channelId, currentVideoId, "video");
              sendMessage(
                `${channelName} just uploaded a new video titled "${currentVideo.snippet.title}": https://youtu.be/${currentVideoId}`,
              );
            }
            if (lastShortId !== currentShortId) {
              latestVideosDb.set(channelId, currentShortId, "short");
              sendMessage(
                `${channelName} just uploaded a new short titled "${currentShort.snippet.title}": https://youtube.com/shorts/${currentShortId}`,
              );
            }
          });
      }
    });
}

getLatestVideos("UCX6OQ3DkcsbYNE6H8uQQuVA", "MrBeast");
getLatestVideos("UCgG5aRcYGzPPB4UG3mS-ZNg", "Graphify");
setInterval(() => getLatestVideos("UCX6OQ3DkcsbYNE6H8uQQuVA", "MrBeast"), 4000);
setInterval(
  () => getLatestVideos("UCgG5aRcYGzPPB4UG3mS-ZNg", "Graphify"),
  30000,
);

const ignoredCommands = [
  "!sr",
  "!songrequest",
  "!skip",
  "!currentsong",
  "!nextsong",
  "!pizza",
  "!uptime",
  "!hours",
  "!top",
  "!tophours",
  "!give",
  "!addcommand",
  "!removecommand",
  "!editcommand",
  "!enable",
  "!playlist",
  "!rules",
  "!discord",
];

const gambleCooldowns = new Map();

setTimeout(() => {
  mc.on("chat", (chat) => {
    const message = {
      content: stringify(chat.message ?? ""),
      author: {
        name: chat.authorName,
        id: chat.authorChannelId,
        avatar: chat.authorPhoto,
      },
    };

    // messagesDb.math("messages", "+", 1);
    if (!message.content.startsWith("[Discord]")) {
      fetch(process.env.DISCORD_WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: message.author.name,
          avatar_url: chat.authorPhoto,
          content: message.content,
          allowed_mentions: {
            parse: [],
            roles: [],
            users: [],
            replied_user: false,
          },
        }),
      });
    }

    if (chat.authorChannelId === process.env.BOT_ID) return;

    if (
      message.content.toLowerCase().startsWith("!rank") ||
      message.content.toLowerCase().startsWith("!xp")
    ) {
      xpDb.ensure(message.author.id, {
        xp: 0,
        level: 0,
      });
      sendMessage(
        `${message.author.name}, you have ${xpDb
          .get(message.author.id, "xp")
          .toLocaleString()} xp and you're level ${xpDb
          .get(message.author.id, "level")
          .toLocaleString()}. To reach the next level, you need to reach ${calculateLevelXp(
          xpDb.get(message.author.id, "level") + 1,
        )} xp.`,
      );
      return;
    } else if (message.content.toLowerCase().startsWith("!points")) {
      pointsDb.ensure(message.author.id, {
        points: 0,
      });
      sendMessage(
        `${message.author.name}, you have ${pointsDb.get(
          message.author.id,
          "points",
        )} points.`,
      );
      return;
    } else if (
      message.content.toLowerCase().startsWith("!givepoints") &&
      (chat.isOwner || chat.isModerator)
    ) {
      const amount = parseInt(
        message.content.split("!")[1].split(" ")[1].split(",").join(""),
      );

      const keys = [...activeUsers.keys()];
      for (const key of keys) {
        const date = activeUsers.get(key).date;
        if (new Date() - new Date(date) > duration) {
          activeUsers.delete(key);
          continue;
        }
        pointsDb.ensure(key, {
          points: 0,
        });
        pointsDb.math(key, "+", amount, "points");
      }

      if (activeUsers.size !== 0)
        sendMessage(
          `${activeUsers.size} ${
            activeUsers.size === 1 ? "person has" : "people have"
          } been given points!`,
        );
      else sendMessage("No one's active so I didn't give anyone points!");

      return;
    } else if (
      message.content.startsWith("!link") &&
      message.content.split("!link")[1].length
    ) {
      const code = message.content.split("!link")[1].split(" ")[1];

      const discordInfo = linkCodes.get(code);
      if (!discordInfo)
        return sendMessage(
          `${message.author.name}, you specified an invalid code!`,
        );
      if (linkedDb.find((x) => x.youtube.id === message.author.id))
        return sendMessage(
          `${message.author.name}, you're already linked to ${
            linkedDb.find((x) => x.youtube.id === message.author.id).discord
              .name
          }.`,
        );

      linkedDb.set(discordInfo.id, {
        discord: discordInfo,
        youtube: message.author,
      });
      linkCodes.delete(code);
      sendMessage(
        `${message.author.name}, you've been successfully linked to ${discordInfo.name}!`,
      );
    } else if (message.content.startsWith("!unlink")) {
      const user = linkedDb.find((x) => x.youtube.id === message.author.id);
      if (!user)
        return sendMessage(
          `${message.author.name}, you're not linked to any Discord account.`,
        );

      linkedDb.delete(user.discord.id);

      sendMessage(
        `${message.author.name}, you've been successfully unlinked from ${user.discord.name}.`,
      );
    } else if (
      message.content.startsWith("!gamble") &&
      message.content.split("!gamble")[1].length
    ) {
      pointsDb.ensure(message.author.id, {
        points: 0,
      });

      if (
        gambleCooldowns.has(message.author.id) &&
        new Date() - new Date(gambleCooldowns.get(message.author.id)) > duration
      )
        return sendMessage(
          `${
            message.author.name
          }, you're on cooldown. You can gamble again in ${moment(
            gambleCooldowns.get(message.author.id),
          ).fromNow()}`,
        );

      const amount = parseInt(
        message.content.split("!gamble")[1].split(" ")[1],
      );
      if (isNaN(amount))
        return sendMessage(
          `${message.author.name}, you need to specify a number to gamble.`,
        );
      if (amount < 50)
        return sendMessage(
          `${message.author.name}, you must gamble at least 50 points or more.`,
        );

      if (amount > pointsDb.get(message.author.id, "points"))
        return sendMessage(
          `${
            message.author.name
          }, you don't have enough points to gamble ${amount.toLocaleString()}.`,
        );

      const won = Math.random > 0.5;
      switch (won) {
        case true:
          {
            const amountWon = Number(
              (amount * (Math.random() + 0.55)).toFixed(0),
            );
            pointsDb.math(message.author.id, "+", amountWon, "points");
            sendMessage(
              `${
                message.author.name
              }, you won ${amountWon.toLocaleString()} points! You now have ${pointsDb
                .get(message.author.id, "points")
                .toLocaleString()} points.`,
            );
          }
          break;
        case false:
          {
            pointsDb.math(message.author.id, "-", amount, "points");
            sendMessage(
              `${
                message.author.name
              }, you lost ${amount.toLocaleString()} points. You now have ${pointsDb
                .get(message.author.id, "points")
                .toLocaleString()} points.`,
            );
          }
          break;
      }

      gambleCooldowns.set(message.author.id, Date.now());
    } else if (
      message.content.startsWith("!") &&
      message.content.split("!")[1].length &&
      !ignoredCommands.some((command) =>
        message.content.toLowerCase().startsWith(command),
      )
    ) {
      const votee = message.content.split("!")[1].split(" ")[0].toLowerCase();

      votesDb.ensure(votee, 0);
      votesDb.math(votee, "+", 1);

      sendMessage(
        `${message.author.name} has voted for ${votee}, and so has ${votesDb
          .get(votee)
          .toLocaleString()} other people!`,
      );
      return;
    } else if (message.content.toLowerCase() === "h") {
      votesDb.ensure("h", 0);
      votesDb.math("h", "+", 1);

      sendMessage(`h. ${votesDb.get("h")} other people have h'ed.`);
      return;
    }

    handlePoints(message);
    handleLevels(message);
    handleCounting(message);

    const hellos = ["hello", "hi", "hey"];
    if (hellos.some((hello) => message.content.startsWith(hello))) {
      sendMessage(
        `Hello ${message.author.name}! Welcome to the Graphify stream! We hope you enjoy your stay.`,
      );
      return;
    }

    const goodbyes = ["bye", "cya", "gtg", "goodbye"];
    if (goodbyes.some((goodbye) => message.content.startsWith(goodbye))) {
      sendMessage(
        `Goodbye ${message.author.name}! We hope to see you here again soon!`,
      );
      return;
    }
  });
}, 1000);

mc.on("error", (err) => console.error(err));
process.on("unhandledRejection", (err) => console.error(err));
process.on("uncaughtException", (err) => console.error(err));

/**
 * @param {{ content: string; author: { name: string, id: string; avatar: string; } }} message
 */
function handlePoints(message) {
  activeUsers.set(message.author.id, {
    ...activeUsers.get(message.author.id),
    name: message.author.name,
    date: Date.now(),
    avatar: message.author.avatar,
  });
  if (activeUsers.get(message.author.id).messages === undefined)
    activeUsers.get(message.author.id).messages = 0;
  activeUsers.get(message.author.id).messages += 1;
  pointsDb.ensure(message.author.id, {
    messages: 0,
  });
  pointsDb.math(message.author.id, "+", 1, "messages");
}

const xpCooldowns = new Set();
const calculateLevelXp = (level) => 100 * level || 100;

/**
 * @param {{ content: string; author: { name: string, id: string; } }} message
 */
function handleLevels(message) {
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
        .toLocaleString()}.`,
    );
  }
}

/**
 * @param {{ content: string; author: { name: string, id: string; avatar: string; } }} message
 */
function handleCounting(message) {
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
      avatar: message.author.avatar,
    });

    countDb.set("lastCounted", lastCounted);
  }
}

mc.listen();
sendMessage("I've arrived!");

const dbs = {
  xp: xpDb,
  votes: votesDb,
  points: pointsDb,
  count: countDb,
  messages: messagesDb,
  activeUsers,
};

import server from "./server.js";
server(dbs);

import discord from "./discord.js";
discord(sendMessage, { ...dbs, xpCooldowns, linked: linkedDb, linkCodes });

function sendMessage(text) {
  // fetch(
  //   "https://www.youtube.com/youtubei/v1/live_chat/send_message?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8&prettyPrint=false",
  //   {
  //     headers: {
  //       accept: "*/*",
  //       "accept-language": "en-US,en;q=0.9",
  //       authorization:
  //         "SAPISIDHASH 1698304344_79cbd953e1cab1abbbb4b26221fb7faaa661741e",
  //       "content-type": "application/json",
  //       "sec-ch-ua":
  //         '"Chromium";v="118", "Google Chrome";v="118", "Not=A?Brand";v="99"',
  //       "sec-ch-ua-arch": '"x86"',
  //       "sec-ch-ua-bitness": '"64"',
  //       "sec-ch-ua-full-version": '"118.0.5993.90"',
  //       "sec-ch-ua-full-version-list":
  //         '"Chromium";v="118.0.5993.90", "Google Chrome";v="118.0.5993.90", "Not=A?Brand";v="99.0.0.0"',
  //       "sec-ch-ua-mobile": "?0",
  //       "sec-ch-ua-model": '""',
  //       "sec-ch-ua-platform": '"Windows"',
  //       "sec-ch-ua-platform-version": '"15.0.0"',
  //       "sec-ch-ua-wow64": "?0",
  //       "sec-fetch-dest": "empty",
  //       "sec-fetch-mode": "same-origin",
  //       "sec-fetch-site": "same-origin",
  //       "x-client-data":
  //         "CIq2yQEIpLbJAQipncoBCLmMywEIkqHLAQia/swBCIWgzQEIjbLNAQjcvc0BCOnFzQEIksrNAQi5ys0BCKPWzQEIp9jNAQil3M0BCOzdzQEI+cDUFRj0yc0B",
  //       "x-goog-authuser": "0",
  //       "x-goog-pageid": "111227380988305128728",
  //       "x-goog-visitor-id": "Cgt2NW5HYU1BSWItayjmoeipBjIICgJQSBICGgA%3D",
  //       "x-origin": "https://www.youtube.com",
  //       "x-youtube-bootstrap-logged-in": "true",
  //       "x-youtube-client-name": "1",
  //       "x-youtube-client-version": "2.20231023.04.02",
  //       cookie:
  //         "VISITOR_INFO1_LIVE=v5nGaMAIb-k; VISITOR_PRIVACY_METADATA=CgJQSBICGgA%3D; PREF=f4=4000000&tz=Asia.Manila&f6=40000400&f5=20000&f7=100; SID=cQj72uZMsTxPY4lRsntLlBDCYEH7Dh9LXFEpWPrmSjVZdMe7rcoJiAn2k2PnjgPNwDGhTQ.; __Secure-1PSID=cQj72uZMsTxPY4lRsntLlBDCYEH7Dh9LXFEpWPrmSjVZdMe7yrO-F9NrpTbPVTJ11efGEg.; __Secure-3PSID=cQj72uZMsTxPY4lRsntLlBDCYEH7Dh9LXFEpWPrmSjVZdMe7zBQpYbce3CtrKVXikahTTA.; HSID=AIEuGtv5zE5G7OoAd; SSID=AtQT0HRiiojgJg47a; APISID=--lOQ7dykGf1ti6c/AmVq3Kf9rDiCRkUnY; SAPISID=Yi751Sg5v_rp754p/A8y6SbcOott9dpsLG; __Secure-1PAPISID=Yi751Sg5v_rp754p/A8y6SbcOott9dpsLG; __Secure-3PAPISID=Yi751Sg5v_rp754p/A8y6SbcOott9dpsLG; YSC=rllKgAP1hQQ; __Secure-1PSIDTS=sidts-CjIB3e41hWxpkniuqQQZ23dWn3WnVzB0_f0OEdkeeKWHe_eWsmTxiBDVlgl-BAuoBU9zfRAA; __Secure-3PSIDTS=sidts-CjIB3e41hWxpkniuqQQZ23dWn3WnVzB0_f0OEdkeeKWHe_eWsmTxiBDVlgl-BAuoBU9zfRAA; LOGIN_INFO=AFmmF2swRAIgX-qefuRIU9fhF2iqYNj7-W1uENONKPl84Ybb4DBkdOECIFSE3RRcwzjvzuMFTAYV19KMqYH1w_J0jFD0oYE8iFkH:QUQ3MjNmeTJmdi1IZHpLYXRiTWM2enF6eW9sRDlleVd0c211elRQeDRKMC16Nl9uSHlKc2hNeWJVank1M3dYTUtEWkFBVFJ0bTUyb1V0eVJ5MktKNGVLM2ZZZmFSc3p6OVMzX0RJVnpQN0FDRHBqR3UxVkoyS2N3elc5M0Q0WHcxMTI0SmlUUEg2NEJtcFBCdDlPbG5EYlN4bWJoSFZVWGoyaC1ud2JMNWc1UlhzOXhtRl9LX2xLR1ZydTlhYXh4NEFLenVjdjNhV1FpRUo5MVFReE9kV0p2alZqbnJhQmZ2QQ==; SIDCC=ACA-OxPaEq0waT16CZ4_C7mMQcSwcHRP00-YwIJxG57vriTvSgC5UDcpLXXsCGdbj-Yg76-uu4o; __Secure-1PSIDCC=ACA-OxNWLyS7fJ0lOnjxZjenFzcHp9q9h7lCnPXndWXF8Ibzw5FjGvZI3EUKhIHnVfy4OCBmfw3o; __Secure-3PSIDCC=ACA-OxOfdWhjxv_rrraDMSwN44SXAoJ4cSlypMcvyPBF4_k-iLQTA_Okmsi5UqiOBafP4EerFXgC",
  //       Referer:
  //         "https://www.youtube.com/live_chat?continuation=0ofMyAN-Gl5DaWtxSndvWVZVTm5SelZoVW1OWlIzcFFVRUkwVlVjemJWTXRXazVuRWd0clEybHBXakpyWDFOeE9Cb1Q2cWpkdVFFTkNndHJRMmxwV2pKclgxTnhPQ0FCTUFBJTNEMAGCAQYIBBgCIACIAQGgAYfbxqGUk4IDqAEAsgEA",
  //       "Referrer-Policy": "strict-origin-when-cross-origin",
  //     },
  //     body: JSON.stringify({
  //       context: {
  //         client: {
  //           hl: "en",
  //           gl: "PH",
  //           remoteHost: "112.201.72.200",
  //           deviceMake: "",
  //           deviceModel: "",
  //           visitorData: "Cgt2NW5HYU1BSWItayjmoeipBjIICgJQSBICGgA%3D",
  //           userAgent:
  //             "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36,gzip(gfe)",
  //           clientName: "WEB",
  //           clientVersion: "2.20231023.04.02",
  //           osName: "Windows",
  //           osVersion: "10.0",
  //           originalUrl:
  //             "https://www.youtube.com/live_chat?continuation=0ofMyAN-Gl5DaWtxSndvWVZVTm5SelZoVW1OWlIzcFFVRUkwVlVjemJWTXRXazVuRWd0clEybHBXakpyWDFOeE9Cb1Q2cWpkdVFFTkNndHJRMmxwV2pKclgxTnhPQ0FCTUFBJTNEMAGCAQYIBBgCIACIAQGgAYfbxqGUk4IDqAEAsgEA",
  //           screenPixelDensity: 2,
  //           platform: "DESKTOP",
  //           clientFormFactor: "UNKNOWN_FORM_FACTOR",
  //           configInfo: {
  //             appInstallData:
  //               "COah6KkGEKiBsAUQp_evBRDV5a8FELzrrwUQ_IWwBRDT4a8FEN_YrwUQ2cmvBRCmgbAFELiLrgUQ86ivBRClwv4SEInorgUQ5LP-EhDX6a8FEL_3rwUQrLevBRCa8K8FENyCsAUQtMmvBRDd6P4SELz5rwUQt-r-EhCU2f4SEMyu_hIQ-r6vBRCehbAFEO6irwUQzN-uBRD1-a8FEP_1_hIQ6-j-EhDj2K8FEOe6rwUQg9-vBRCrgrAFEMn3rwUQvbauBRDUoa8FEJfn_hIQ6sOvBRCyxq8FEOLUrgUQp-r-EhC1pq8FENuvrwUQvvmvBRCB9v4SEOno_hIQ65OuBRCp968FENDirwUQrvqvBRCI468FELbvrwUQgNivBRD8568FEL3erwU%3D",
  //           },
  //           screenDensityFloat: 1.5,
  //           userInterfaceTheme: "USER_INTERFACE_THEME_DARK",
  //           timeZone: "Asia/Manila",
  //           browserName: "Chrome",
  //           browserVersion: "118.0.0.0",
  //           acceptHeader:
  //             "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
  //           deviceExperimentId:
  //             "ChxOekk1TkRFMk1URXlPRE0wTnpjek5UZzBNQT09EOah6KkGGOah6KkG",
  //           screenWidthPoints: 401,
  //           screenHeightPoints: 551,
  //           utcOffsetMinutes: 480,
  //           connectionType: "CONN_CELLULAR_4G",
  //           memoryTotalKbytes: "4000000",
  //           mainAppWebInfo: {
  //             graftUrl:
  //               "https://www.youtube.com/live_chat?continuation=0ofMyAN-Gl5DaWtxSndvWVZVTm5SelZoVW1OWlIzcFFVRUkwVlVjemJWTXRXazVuRWd0clEybHBXakpyWDFOeE9Cb1Q2cWpkdVFFTkNndHJRMmxwV2pKclgxTnhPQ0FCTUFBJTNEMAGCAQYIBBgCIACIAQGgAYfbxqGUk4IDqAEAsgEA",
  //             webDisplayMode: "WEB_DISPLAY_MODE_BROWSER",
  //             isWebNativeShareAvailable: true,
  //           },
  //         },
  //         user: { lockedSafetyMode: false },
  //         request: {
  //           useSsl: true,
  //           internalExperimentFlags: [],
  //           consistencyTokenJars: [],
  //         },
  //         clickTracking: {
  //           clickTrackingParams: "CBYQ8FsiEwjDnvCilJOCAxWEvFYBHblVDAA=",
  //         },
  //         adSignalsInfo: {
  //           params: [
  //             { key: "dt", value: "1698304173137" },
  //             { key: "flash", value: "0" },
  //             { key: "frm", value: "1" },
  //             { key: "u_tz", value: "480" },
  //             { key: "u_his", value: "3" },
  //             { key: "u_h", value: "1080" },
  //             { key: "u_w", value: "1920" },
  //             { key: "u_ah", value: "1050" },
  //             { key: "u_aw", value: "1920" },
  //             { key: "u_cd", value: "24" },
  //             { key: "bc", value: "31" },
  //             { key: "bih", value: "627" },
  //             { key: "biw", value: "1269" },
  //             { key: "brdim", value: "0,30,0,30,1920,30,1920,1050,401,551" },
  //             { key: "vis", value: "1" },
  //             { key: "wgl", value: "true" },
  //             { key: "ca_type", value: "image" },
  //           ],
  //         },
  //       },
  //       params:
  //         "Q2lrcUp3b1lWVU5uUnpWaFVtTlpSM3BRVUVJMFZVY3piVk10V2s1bkVndHJRMmxwV2pKclgxTnhPQkFCR0FRJTNE",
  //       clientMessageId: "CP7z8qKUk4IDFYS8VgEduVUMAA0",
  //       richMessage: { textSegments: [{ text }] },
  //     }),
  //     method: "POST",
  //   }
  // )
  //   .then((res) => res.json())
  //   .then(console.log);
  // !! DOESN'T WORK CURRENTLY !!
  mc.sendMessage(text);
}
