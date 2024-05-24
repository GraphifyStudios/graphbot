import {
  ApplicationCommandOptionType,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  codeBlock,
  time,
} from "discord.js";
import fs from "fs";
import { nanoid } from "nanoid";
import os from "os";
import path from "path";

const random = (min, max) =>
  Math.floor(Math.random() * (Math.floor(max) - Math.ceil(min) + 1)) + min;
const calculateLevelXp = (level) => 100 * level || 100;

/**
 * @param {{ xp: import("enmap").default, votes: import("enmap").default, points: import("enmap").default, count: import("enmap").default, messages: import("enmap").default, activeUsers: Map,  xpCooldowns: Map, linked: import("enmap").default, linkCodes: Map<string, string> }} dbs
 */
export default (sendMessage, dbs) => {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  client.on("ready", () => {
    console.log(`Logged in on Discord as ${client.user.tag}.`);

    /** @type {import('discord.js').ApplicationCommandDataResolvable[]} */
    const commands = [
      {
        name: "link",
        description: "Link your Discord account to your YouTube account.",
      },
      {
        name: "unlink",
        description: "Unlink your Discord account from your YouTube account.",
      },
      {
        name: "points",
        description: "Retrive the amount of points you have on our livestream.",
        options: [
          {
            name: "user",
            description: "The user to retrive the points of.",
            type: ApplicationCommandOptionType.User,
            required: false,
          },
        ],
      },
      {
        name: "xp",
        description: "Retrive the amount of XP you have on our livestream.",
        options: [
          {
            name: "user",
            description: "The user to retrive the XP of.",
            type: ApplicationCommandOptionType.User,
            required: false,
          },
        ],
      },
    ];

    client.guilds.cache.get("1205702353332871178").commands.set(commands);

    const streamlabsDir = path.join(
      os.homedir(),
      "AppData/Roaming/Streamlabs/Streamlabs Chatbot/Services/Youtube/Files"
    );
    fs.watchFile(path.join(streamlabsDir, "CurrentSong.txt"), async () => {
      const currentSong = fs.readFileSync(
        path.join(streamlabsDir, "CurrentSong.txt"),
        "utf8"
      );
      const currentlyPlaying = fs.readFileSync(
        path.join(streamlabsDir, "CurrentlyPlaying.txt"),
        "utf8"
      );

      const channel = await client.channels.fetch("1205751120606138418");
      if (!channel || !channel.isTextBased()) return;

      channel.send({
        embeds: [
          new EmbedBuilder()
            .setAuthor({
              name: "Graphify",
              iconURL:
                "https://yt3.googleusercontent.com/F_yIm93STWJYCOtg1E_YVqJa2dQ88jGRg7364DfOG5oooadYPTW4d9PTcp84FMAteYmRmTJDnA=s176-c-k-c0x00ffffff-no-rj",
            })
            .setTitle("🎶 Now playing")
            .setDescription(currentSong.trim())
            .addFields(
              {
                name: "Requested by",
                value: currentlyPlaying.split(currentSong)[1],
                inline: true,
              },
              {
                name: "Started playing",
                value: time(new Date(), "R"),
                inline: true,
              }
            )
            .setColor("#0094fe"),
        ],
      });
    });

    const updateStatistics = async () => {
      const data = await fetch(
        "https://api-v2.nextcounts.com/api/youtube/channel/UCgG5aRcYGzPPB4UG3mS-ZNg"
      ).then((res) => res.json());

      const updateStatistic = async (options) => {
        const channel = await client.channels.fetch(options.channelId);
        if (!channel || !channel.isVoiceBased()) return;
        channel.setName(`${options.name}: ${options.count.toLocaleString()}`);
      };

      updateStatistic({
        channelId: "1205859107102523392",
        name: "Subscribers",
        count: data.subcount,
      });
      updateStatistic({
        channelId: "1205859109111599195",
        name: "Views",
        count: data.viewcount,
      });
    };

    updateStatistics();
    setInterval(() => {
      updateStatistics();
    }, 5 * 60 * 1000);
  });

  client.on("messageCreate", (message) => {
    if (
      message.author.bot ||
      !message.guild ||
      message.channel.id !== "1205743912325488650"
    )
      return;

    if (dbs.linked.has(message.author.id)) {
      dbs.activeUsers.set(dbs.linked.get(message.author.id, "youtube.id"), {
        ...dbs.activeUsers.get(dbs.linked.get(message.author.id, "youtube.id")),
        name: dbs.linked.get(message.author.id, "youtube.name"),
        date: Date.now(),
        avatar: dbs.linked.get(message.author.name, "youtube.avatar"),
      });
      if (
        dbs.activeUsers.get(dbs.linked.get(message.author.id, "youtube.id"))
          .messages === undefined
      )
        dbs.activeUsers.get(
          dbs.linked.get(message.author.id, "youtube.id")
        ).messages = 0;
      dbs.activeUsers.get(
        dbs.linked.get(message.author.id, "youtube.id")
      ).messages += 1;
      dbs.points.ensure(dbs.linked.get(message.author.id, "youtube.id"), {
        messages: 0,
      });
      dbs.points.math(
        dbs.linked.get(message.author.id, "youtube.id"),
        "+",
        1,
        "messages"
      );

      if (dbs.xpCooldowns.has(dbs.linked.get(message.author.id, "youtube.id")))
        return;

      const xpToGive = random(5, 15);

      dbs.xp.math(
        dbs.linked.get(message.author.id, "youtube.id"),
        "+",
        xpToGive,
        "xp"
      );

      dbs.xpCooldowns.add(dbs.linked.get(message.author.id, "youtube.id"));
      setTimeout(
        () =>
          dbs.xpCooldowns.delete(
            dbs.linked.get(message.author.id, "youtube.id")
          ),
        30_000
      );

      const user = dbs.xp.get(dbs.linked.get(message.author.id, "youtube.id"));
      if (user.xp > calculateLevelXp(user.level)) {
        dbs.xp.math(
          dbs.linked.get(message.author.id, "youtube.id"),
          "+",
          1,
          "level"
        );

        sendMessage(
          `LEVEL UP! ⬆️ ${dbs.linked.get(
            message.author.id,
            "youtube.name"
          )} has leveled up to level ${dbs.xp
            .get(dbs.linked.get(message.author.id, "youtube.id"), "level")
            .toLocaleString()}.`
        );
      }
    }

    const firstArg = message.content.split(" ")[0].split(",").join("");
    if (!isNaN(firstArg)) {
      const num = parseInt(firstArg);
      if (num !== dbs.count.get("count") + 1) return;

      dbs.count.set("count", num);

      let lastCounted = dbs.count.get("lastCounted");
      if (lastCounted.length > 9) lastCounted = lastCounted.slice(0, 9);

      lastCounted.unshift({
        name: dbs.linked.has(message.author.id)
          ? dbs.linked.get(message.author.id, "youtube.name")
          : message.member.displayName,
        id: dbs.linked.has(message.author.id)
          ? dbs.linked.get(message.author.id, "youtube.id")
          : message.member.displayName,
        count: num,
        avatar: dbs.linked.has(message.author.id)
          ? dbs.linked.get(message.author.id, "youtube.avatar")
          : message.member.displayAvatarURL(),
      });

      dbs.count.set("lastCounted", lastCounted);
    }

    sendMessage(
      `[Discord] ${
        dbs.linked.has(message.author.id)
          ? dbs.linked.get(message.author.id, "youtube.name")
          : message.member.displayName
      }: ${message.content}`
    );
  });

  const codeExpiry = 1 * 60 * 1000;
  client.on("interactionCreate", (interaction) => {
    if (!interaction.isChatInputCommand() || !interaction.inGuild()) return;

    switch (interaction.commandName) {
      case "link":
        {
          if (dbs.linked.has(interaction.user.id))
            return interaction.reply({
              content: `You're already linked to ${dbs.linked.get(
                interaction.user.id,
                "youtube.name"
              )}.`,
              ephemeral: true,
            });

          let code;
          if (
            [...dbs.linkCodes.entries()].find(
              ({ 1: v }) => v.id === interaction.user.id
            )
          )
            code = [...dbs.linkCodes.entries()].find(
              ({ 1: v }) => v.id === interaction.user.id
            )[0];
          else code = nanoid(6);

          dbs.linkCodes.set(code, {
            id: interaction.user.id,
            name: interaction.member.displayName,
          });
          setTimeout(() => dbs.linkCodes.delete(code), codeExpiry);

          interaction.reply({
            content: `Type this on [our livestream](<https://youtube.com/@GraphifyStatistics/live>) as the account you want to link:\n${codeBlock(
              `!link ${code}`
            )}\nThis code expires ${time(
              new Date(new Date().getTime() + codeExpiry),
              "R"
            )}`,
            ephemeral: true,
          });
        }
        break;
      case "points":
        {
          const user =
            interaction.options.getMember("user") ?? interaction.member;

          if (!dbs.linked.has(user.id))
            return interaction.reply({
              content: `${
                user.id === interaction.user.id
                  ? "You're"
                  : `${user.displayName} is`
              } not linked to any YouTube account.${
                user.id === interaction.user.id
                  ? ` Try running </link:${
                      client.guilds.cache
                        .get("1205702353332871178")
                        .commands.cache.find(
                          (command) => command.name === "link"
                        ).id
                    }> first.`
                  : ""
              }`,
              ephemeral: true,
            });

          dbs.points.ensure(dbs.linked.get(interaction.user.id, "youtube.id"), {
            points: 0,
          });
          interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setAuthor({
                  name: dbs.linked.get(interaction.user.id, "youtube.name"),
                  iconURL: dbs.linked.get(
                    interaction.user.id,
                    "youtube.avatar"
                  ),
                })
                .addFields({
                  name: "Points",
                  value: dbs.points
                    .get(
                      dbs.linked.get(interaction.user.id, "youtube.id"),
                      "points"
                    )
                    .toLocaleString(),
                })
                .setColor("#0094fe"),
            ],
          });
        }
        break;
      case "xp":
        {
          const user =
            interaction.options.getMember("user") ?? interaction.member;

          if (!dbs.linked.has(user.id))
            return interaction.reply({
              content: `${
                user.id === interaction.user.id
                  ? "You're"
                  : `${user.displayName} is`
              } not linked to any YouTube account.${
                user.id === interaction.user.id
                  ? ` Try running </link:${
                      client.guilds.cache
                        .get("1205702353332871178")
                        .commands.cache.find(
                          (command) => command.name === "link"
                        ).id
                    }> first.`
                  : ""
              }`,
              ephemeral: true,
            });

          dbs.xp.ensure(dbs.linked.get(interaction.user.id, "youtube.id"), {
            xp: 0,
            level: 0,
          });
          interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setAuthor({
                  name: dbs.linked.get(interaction.user.id, "youtube.name"),
                  iconURL: dbs.linked.get(
                    interaction.user.id,
                    "youtube.avatar"
                  ),
                })
                .addFields(
                  {
                    name: "XP",
                    value: dbs.xp
                      .get(
                        dbs.linked.get(interaction.user.id, "youtube.id"),
                        "xp"
                      )
                      .toLocaleString(),
                  },
                  {
                    name: "Level",
                    value: `${dbs.xp
                      .get(
                        dbs.linked.get(interaction.user.id, "youtube.id"),
                        "level"
                      )
                      .toLocaleString()} (${calculateLevelXp(
                      dbs.xp.get(
                        dbs.linked.get(interaction.user.id, "youtube.id"),
                        "level"
                      )
                    ).toLocaleString()} XP to reach level ${(
                      dbs.xp.get(
                        dbs.linked.get(interaction.user.id, "youtube.id"),
                        "level"
                      ) + 1
                    ).toLocaleString()})`,
                  }
                )
                .setColor("#0094fe"),
            ],
          });
        }
        break;
      case "unlink":
        {
          if (!dbs.linked.has(interaction.user.id))
            return interaction.reply({
              content: `You're not linked to any YouTube account. Try running </link:${
                client.guilds.cache
                  .get("1205702353332871178")
                  .commands.cache.find((command) => command.name === "link").id
              }> first.`,
              ephemeral: true,
            });

          const youtubeName = dbs.linked.get(
            interaction.user.id,
            "youtube.name"
          );

          dbs.linked.delete(interaction.user.id);

          interaction.reply({
            content: `You've been successfully unlinked from ${youtubeName}`,
            ephemeral: true,
          });
        }
        break;
    }
  });

  client.login(process.env.DISCORD_TOKEN);
};