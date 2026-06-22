require('dotenv').config()

const http = require('http')
const { Telegraf } = require('telegraf')

const token = process.env.TELEGRAM_BOT_TOKEN

if (!token) {
  throw new Error('TELEGRAM_BOT_TOKEN is missing')
}

const bot = new Telegraf(token)

/* =================================
   START COMMAND
================================= */

bot.start(async (ctx) => {
  await ctx.reply(
    '✅ Bot is running.\n\nAdd me as admin to a group and give me Delete Messages permission.'
  )
})

/* =================================
   CONFIG
================================= */

const linkPatterns = [
  'http://',
  'https://',
  'www.',
  't.me/',
  'telegram.me/',
  '.com',
  '.net',
  '.org',
  '.io'
]

const spamPatterns = [
  'join my channel',
  'join our channel',
  'join now',
  'join us',
  'dm me',
  'message me',
  'inbox me',
  'earn money',
  'make money',
  'passive income',
  'crypto signal',
  'crypto signals',
  'trading signal',
  'casino',
  'betting',
  'forex',
  'free followers',
  'paid promotion',
  'click here',
  'subscribe now',
  'follow me',
  'follow us',
  'promotion',
  'advertisement',
  'hot deal',
  'hot deals',
  'hot offer',
  'hot offers',
  'limited offer',
  'limited time',
  'whatsapp',
  'contact us',
  'investment opportunity',
  'double your',
  'guaranteed profit',
  'work from home',
  'airdrop',
  'giveaway'
]

const urlRegex =
  /(?:https?:\/\/|www\.|t\.me\/|telegram\.me\/|\b[a-z0-9][a-z0-9-]*\.(?:com|net|org|io|me|co|xyz|app|link|info|biz|online|store|shop|site|top|vip|pro|live|fun|click|bet|casino|in|uk|us|de|ru)\b)/i

/* =================================
   HELPERS
================================= */

function hasLink (text = '', entities = [], message = {}) {
  if (
    entities.some(
      e =>
        e.type === 'url' ||
        e.type === 'text_link'
    )
  ) {
    return true
  }

  const lower = text.toLowerCase()

  if (linkPatterns.some(pattern => lower.includes(pattern))) {
    return true
  }

  if (urlRegex.test(text)) {
    return true
  }

  const keyboard = message.reply_markup?.inline_keyboard
  if (keyboard?.some(row => row.some(btn => btn.url || btn.login_url))) {
    return true
  }

  return false
}

function isForwardedFromChannel (message = {}) {
  if (message.forward_from_chat?.type === 'channel') {
    return true
  }

  return message.forward_origin?.type === 'channel'
}

let botUserId = null

async function getBotUserId (telegram) {
  if (!botUserId) {
    botUserId = (await telegram.getMe()).id
  }

  return botUserId
}

async function isAdmin(ctx) {
  try {
    const admins = await ctx.getChatAdministrators()

    const adminIds = new Set(
      admins.map(admin => admin.user.id)
    )

    return adminIds.has(ctx.from.id)
  } catch (err) {
    console.error('Admin check failed:', err.message)
    return false
  }
}

async function deleteMessage(ctx, reason) {
  try {
    await ctx.deleteMessage()

    console.log(
      `✅ Deleted ${reason} | User: ${
        ctx.from?.username ||
        ctx.from?.first_name ||
        ctx.from?.id
      }`
    )
  } catch (err) {
    console.error(
      '❌ Delete failed:',
      err.description || err.message
    )
  }
}

/* =================================
   MODERATION
================================= */

async function moderateMessage (ctx) {
  if (!ctx.chat || !ctx.from || !ctx.message) return

  if (ctx.chat.type === 'private') return

  if (
    ctx.chat.type !== 'group' &&
    ctx.chat.type !== 'supergroup'
  ) {
    return
  }

  const text = (
    ctx.message.text ||
    ctx.message.caption ||
    ''
  ).toLowerCase()

  const entities = [
    ...(ctx.message.entities || []),
    ...(ctx.message.caption_entities || [])
  ]

  console.log(
    `[MESSAGE] ${ctx.from.username || ctx.from.id}: ${text || '(no text)'}`
  )

  const ourBotId = await getBotUserId(ctx.telegram)

  // Block all other bots
  if (ctx.from.is_bot && ctx.from.id !== ourBotId) {
    await deleteMessage(ctx, 'BOT')
    return
  }

  // Block inline-bot messages
  if (ctx.message.via_bot) {
    await deleteMessage(ctx, 'VIA_BOT')
    return
  }

  const admin = await isAdmin(ctx)

  if (admin) {
    console.log('Admin message ignored')
    return
  }

  const containsLink = hasLink(text, entities, ctx.message)
  const containsSpam = spamPatterns.some(pattern => text.includes(pattern))
  const isChannelForward = isForwardedFromChannel(ctx.message)

  if (containsLink) {
    await deleteMessage(ctx, 'LINK')
    return
  }

  if (containsSpam) {
    await deleteMessage(ctx, 'SPAM')
    return
  }

  if (isChannelForward) {
    await deleteMessage(ctx, 'CHANNEL_FORWARD')
  }
}

bot.on(['message', 'edited_message'], async (ctx) => {
  try {
    await moderateMessage(ctx)
  } catch (err) {
    console.error(
      'Moderation Error:',
      err.description || err.message
    )
  }
})

/* =================================
   TEST COMMAND
================================= */

bot.command('testdelete', async (ctx) => {
  try {
    await ctx.deleteMessage()
    console.log('Delete permission works')
  } catch (err) {
    console.error(
      'Bot lacks delete permission:',
      err.description || err.message
    )
  }
})

/* =================================
   HEALTH CHECK
================================= */

const PORT = process.env.PORT || 3000

const server = http.createServer(
  (_req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/plain'
    })

    res.end('Bot is running')
  }
)

server.listen(PORT, () => {
  console.log(
    `🌐 Health server listening on ${PORT}`
  )
})

/* =================================
   START BOT
================================= */

bot.launch()

console.log('🚀 Moderation bot started')

/* =================================
   SHUTDOWN
================================= */

process.once('SIGINT', () => {
  bot.stop('SIGINT')
  server.close()
})

process.once('SIGTERM', () => {
  bot.stop('SIGTERM')
  server.close()
})