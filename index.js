import { Telegraf, Markup } from 'telegraf'
import { message } from 'telegraf/filters'
import { fmt, link } from "telegraf/format"
import crypto from 'crypto'
import helpers from './src/helpers.js'

const token = Bun.env.TELEGRAM_BOT_TOKEN
const channel = Bun.env.TELEGRAM_CHANNEL

const bot = new Telegraf(token)

bot.on(message('link_preview_options'), async (ctx) => {
    const { message: { text: userMsg } } = ctx

    const booruId = helpers.getDanbooruId(userMsg)

    if (!booruId) {
        ctx.reply('Не знайдено постів за посиланням.')
        return
    }

    const post_callback = `post_${booruId}_${crypto.randomBytes(4).toString('hex')}`

    const message = await helpers.getMediaGroupMessage(booruId)

    ctx.sendMediaGroup(message).then(() => {
        ctx.reply('Запостити на каналі?', Markup.inlineKeyboard([
            Markup.button.callback('Запостити', post_callback)
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
})

bot.launch()
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))