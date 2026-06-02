require('dotenv').config()

const http = require('http')
const { Telegraf } = require('telegraf')

const token = process.env.TELEGRAM_BOT_TOKEN
if (!token) {
  throw new Error('TELEGRAM_BOT_TOKEN is missing. Add it to your .env file.')
}

const bot = new Telegraf(token)

// Link patterns — only group admins may post these
const linkPatterns = [
  'http://',
  'https://',
  't.me/',
  'telegram.me/',
  'www.'
]

// Other promotional / spam patterns
const spamPatterns = [
  'join my channel',
  'dm me',
  'earn money',
  'make money',
  'crypto signal',
  'casino',
  'betting',
  'forex',
  'free followers',
  'paid promotion',
  'click here',
  'subscribe now'
]

function hasLink (text, entities = []) {
  if (entities.some(e => e.type === 'url' || e.type === 'text_link')) {
    return true
  }

  const lower = text.toLowerCase()
  return linkPatterns.some(pattern => lower.includes(pattern))
}

// Check admin
async function isAdmin(ctx) {
  const admins = await ctx.getChatAdministrators()

  return admins.some(
    admin => admin.user.id === ctx.from.id
  )
}

// Main moderation
bot.on('message', async (ctx) => {
  try {
    // Ignore service messages
    if (!ctx.from) return

    // Ignore admins
    const adminCheck = await isAdmin(ctx)

    if (adminCheck) return

    const text = ctx.message.text || ctx.message.caption || ''
    const entities = [
      ...(ctx.message.entities || []),
      ...(ctx.message.caption_entities || [])
    ]

    const containsLink = hasLink(text, entities)
    const isSpam = spamPatterns.some(pattern =>
      text.toLowerCase().includes(pattern)
    )

    if (containsLink) {
      await ctx.deleteMessage()
      console.log(`Deleted link from ${ctx.from.first_name}`)
      return
    }

    if (isSpam) {
      await ctx.deleteMessage()
      console.log(`Deleted spam from ${ctx.from.first_name}`)
    }

  } catch (error) {
    console.log('Error:', error)
  }
})

// Render requires web services to bind to PORT
const port = process.env.PORT || 3000
const server = http.createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' })
  res.end('Bot is running')
})

server.listen(port, () => {
  console.log(`Health server listening on port ${port}`)
})

// Start bot
bot.launch()

console.log('✅ Moderation bot is running...')

// Graceful shutdown
const shutdown = (signal) => {
  bot.stop(signal)
  server.close()
}

process.once('SIGINT', () => shutdown('SIGINT'))
process.once('SIGTERM', () => shutdown('SIGTERM'))