require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  ChannelType,
  PermissionsBitField,
  EmbedBuilder
} = require('discord.js');
const fetch = require('node-fetch');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

const BASE_URL = 'https://growagardenstock.vercel.app';

const STOCK_ENDPOINTS = {
  gear: { url: '/api/stock/gear', interval: 5 * 60 * 1000 },
  seeds: { url: '/api/stock/seeds', interval: 5 * 60 * 1000 },
  egg: { url: '/api/stock/egg', interval: 30 * 60 * 1000 },
  honey: { url: '/api/stock/honey', interval: 60 * 60 * 1000 },
  cosmetics: { url: '/api/stock/cosmetics', interval: 4 * 60 * 60 * 1000 }
};

const stockChannels = new Map(); // guildId -> channel
const lastStockMessages = {}; // key: `${guildId}:${type}` -> message

// Fetch and send weather update to all stock channels
async function fetchAndNotifyWeather() {
  try {
    const res = await fetch(`${BASE_URL}/api/weather`);
    const data = await res.json();
    if (!data) return;

    const embed = new EmbedBuilder()
      .setTitle('⛅ Weather Update')
      .setColor(0x3498db)
      .addFields(
        { name: '🌿 Effect', value: data.effect || 'None', inline: true },
        { name: '✨ Bonus', value: data.bonus || 'None', inline: true },
        { name: '🧬 Mutation', value: data.mutation || 'None', inline: true }
      )
      .setTimestamp(new Date())
      .setFooter({ text: 'Weather updates every 2 minutes' });

    for (const [guildId, channel] of stockChannels.entries()) {
      channel.send({ embeds: [embed] }).catch(err => {
        console.warn(`❌ [${guildId}] Failed to send weather:`, err.message);
      });
    }
  } catch (err) {
    console.error('❌ Error fetching weather:', err.message);
  }
}

// Fetch and send stock alert to all stock channels
async function fetchAndNotifyStock(type) {
  try {
    await fetch(`${BASE_URL}/api/refresh`);
    const res = await fetch(`${BASE_URL}${STOCK_ENDPOINTS[type].url}`);
    const data = await res.json();
    const items = data.items || [];
    if (!items.length) return;

    const embed = new EmbedBuilder()
      .setTitle(`🪴 ${type.toUpperCase()} STOCK ALERT`)
      .setColor(0x00c851)
      .setDescription(items.map(item => `• **${item.name}** is now in stock!`).join('\n'))
      .addFields({
        name: '⏳ Next Update',
        value: data.countdown?.formatted || 'Unknown'
      })
      .setTimestamp(new Date())
      .setFooter({ text: 'Grow A Garden Stock Notifier' });

    for (const [guildId, channel] of stockChannels.entries()) {
      try {
        const prev = lastStockMessages[`${guildId}:${type}`];
        if (prev) await prev.delete().catch(() => {});

        const sent = await channel.send({ embeds: [embed] });
        lastStockMessages[`${guildId}:${type}`] = sent;
      } catch (err) {
        console.warn(`❌ [${guildId}] Failed to send stock for ${type}:`, err.message);
      }
    }
  } catch (err) {
    console.error(`❌ Error fetching stock for ${type}:`, err.message);
  }
}

// When bot joins a new guild
client.on('guildCreate', async (guild) => {
  try {
    console.log(`➕ Joined new guild: ${guild.name}`);
    let channel = guild.channels.cache.find(
      ch => ch.name === '🌱-grow-a-garden-stock-notifier' && ch.type === ChannelType.GuildText
    );

    if (!channel) {
      channel = await guild.channels.create({
        name: '🌱-grow-a-garden-stock-notifier',
        type: ChannelType.GuildText,
        permissionOverwrites: [
          {
            id: guild.roles.everyone,
            allow: [PermissionsBitField.Flags.ViewChannel],
            deny: [PermissionsBitField.Flags.SendMessages]
          },
          {
            id: client.user.id,
            allow: [PermissionsBitField.Flags.SendMessages]
          }
        ]
      });
      console.log(`✅ Created 'stock-notifier' in ${guild.name}`);
    }

    stockChannels.set(guild.id, channel);
    fetchAndNotifyWeather();
    for (const type of Object.keys(STOCK_ENDPOINTS)) {
      fetchAndNotifyStock(type);
    }
  } catch (err) {
    console.error(`❌ Error in guildCreate for ${guild.name}:`, err.message);
  }
});

// On bot startup
client.once('ready', async () => {
  console.log(`🌱 Logged in as ${client.user.tag}`);

  for (const guild of client.guilds.cache.values()) {
    try {
      let channel = guild.channels.cache.find(
        ch => ch.name === '🌱-grow-a-garden-stock-notifier' && ch.type === ChannelType.GuildText
      );

      if (!channel) {
        channel = await guild.channels.create({
          name: '🌱-grow-a-garden-stock-notifier',
          type: ChannelType.GuildText,
          permissionOverwrites: [
            {
              id: guild.roles.everyone,
              allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
            }
          ]
        });
        console.log(`✅ Created 'stock-notifier' in ${guild.name}`);
      } else {
        console.log(`✅ Found existing 'stock-notifier' in ${guild.name}`);
      }

      stockChannels.set(guild.id, channel);
    } catch (err) {
      console.error(`❌ Error initializing guild ${guild.name}:`, err.message);
    }
  }

  // Start recurring updates
  for (const [type, { interval }] of Object.entries(STOCK_ENDPOINTS)) {
    fetchAndNotifyStock(type); // Run once immediately
    setInterval(() => fetchAndNotifyStock(type), interval);
  }
});

// Start weather updates
setInterval(fetchAndNotifyWeather, 2 * 60 * 1000); // every 2 mins
fetchAndNotifyWeather(); // run once on startup

// Login bot
client.login(process.env.DISCORD_TOKEN);

const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('🌱 Bot is alive!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🌐 Listening on port ${PORT}`);
});

