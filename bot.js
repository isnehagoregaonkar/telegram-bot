const { Telegraf } = require('telegraf')

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN)

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

// Start bot
bot.launch()

console.log('✅ Moderation bot is running...')

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))