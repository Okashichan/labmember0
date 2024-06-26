import { Telegraf, Markup } from 'telegraf'
import { message } from 'telegraf/filters'
import { fmt, link, bold } from "telegraf/format"
import { CronJob } from 'cron'
import { JSONFilePreset } from 'lowdb/node'
import crypto from 'crypto'
import helpers from './src/helpers.js'

const token = Bun.env.TELEGRAM_BOT_TOKEN
const channel = Bun.env.TELEGRAM_CHANNEL
const allowedUsers = Bun.env.ALLOWED_USERS
const cronSchedule = Bun.env.CRON

const initDb = { messages: [] }
const db = await JSONFilePreset('db.json', initDb)

const bot = new Telegraf(token)

const job = new CronJob(cronSchedule, () => {
    if (db.data.messages.length === 0) return

    bot.telegram.sendMediaGroup(channel, db.data.messages.at(0).message).then(() => {
        console.log(`Sending: ${db.data.messages.at(0).booruId}.`)
        db.update(({ messages }) => messages.shift())
    })
}, null, true, Bun.env.TZ)

bot.use(async (ctx, next) => {
    const {
        text: userMsg,
        from:
        {
            id: userId,
            username: userUsername
        }
    } = ctx.callbackQuery || ctx.message

    if (!allowedUsers.includes(userId)) {
        console.log(`${userUsername}|${userId} sent a message: ${userMsg}`)
        return
    }

    await next()
})

bot.on(message('link_preview_options'), async (ctx) => {
    const { message: { text: userMsg, from: { username } } } = ctx

    const booruId = helpers.getDanbooruId(userMsg)

    if (!booruId) {
        ctx.reply('Не знайдено постів за посиланням.')
        return
    }

    const post_callback = `post_${booruId}_${crypto.randomBytes(4).toString('hex')}`
    const scheduled_callback = `schedule_${booruId}_${crypto.randomBytes(4).toString('hex')}`

    const message = await helpers.getMediaGroupMessage(booruId)

    ctx.sendMediaGroup(message).then(() => {
        ctx.reply('Запостити на каналі?', Markup.inlineKeyboard([
            Markup.button.callback('Запостити', post_callback),
            Markup.button.callback('Запланувати', scheduled_callback)
        ]))
    })

    bot.action(post_callback, async (ctx) => {
        ctx.telegram.sendMediaGroup(channel, message).then((ref) => {
            ctx.deleteMessage().then(() => {
                ctx.reply(fmt`${link('Пост розміщено!', `https://t.me/${ref.at(0).chat.username}/${ref.at(0).message_id}`)}`,
                    { disable_web_page_preview: true })
            })
        })
    })

    bot.action(scheduled_callback, async (ctx) => {
        ctx.deleteMessage().then(async () => {
            if (db.data.messages.some(({ booruId: id }) => id === booruId)) {
                ctx.reply(fmt`${bold`Пост вже заплановано!`}`)
                return
            }

            db.update(({ messages }) => messages.push({ booruId, message, username }))

            ctx.reply(fmt`${bold`Пост заплановано!`}`)
        })
    })
})

bot.command('scheduled', async (ctx) => {
    if (db.data.messages.length === 0) {
        ctx.reply('Запланованих постів немає.')
        return
    }

    let scheduled = fmt`${bold`Заплановані пости:`}\n`

    db.data.messages.forEach(({ booruId, username }, index) => {
        const url = `https://danbooru.donmai.us/posts/${booruId}`

        scheduled = fmt`${scheduled}[${link(`${booruId}`, url)}] by ${username} at ${helpers.calculateNextCronTime(cronSchedule, index + 1)}\n`
    })

    ctx.reply(scheduled, { disable_web_page_preview: true })
})

bot.launch()

process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))