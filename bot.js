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
  'dm me',
  'message me',
  'earn money',
  'make money',
  'crypto signal',
  'crypto signals',
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
  'hot offers'
]

/* =================================
   HELPERS
================================= */

function hasLink(text = '', entities = []) {
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

  return linkPatterns.some(pattern =>
    lower.includes(pattern.toLowerCase())
  )
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

bot.on('message', async (ctx) => {
  try {

    if (!ctx.chat || !ctx.from) return

    // Ignore private chats
    if (ctx.chat.type === 'private') return

    // Only groups
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
      `[MESSAGE] ${ctx.from.username || ctx.from.id}: ${text}`
    )

    // Skip admins
    const admin = await isAdmin(ctx)

    if (admin) {
      console.log('Admin message ignored')
      return
    }

    const containsLink = hasLink(text, entities)

    const containsSpam =
      spamPatterns.some(pattern =>
        text.includes(pattern)
      )

    if (containsLink) {
      await deleteMessage(ctx, 'LINK')
      return
    }

    if (containsSpam) {
      await deleteMessage(ctx, 'SPAM')
      return
    }

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