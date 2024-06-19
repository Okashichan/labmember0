import cronParser from 'cron-parser'
import { fmt, italic, link, } from "telegraf/format"

const calculateNextCronTime = (cronExpr, iterations = 1) => {
    const interval = cronParser.parseExpression(cronExpr, { tz: Bun.env.TZ })

    let next = undefined
    while (iterations--) {
        next = interval.next()
    }

    const ISO = next.toISOString()
    const UTC = new Date(ISO)

    return `${UTC.getHours().toString().padStart(2, '0')}:${UTC.getSeconds().toString().padStart(2, '0')} (${UTC.getDate().toString().padStart(2, '0')}/${(UTC.getMonth() + 1).toString().padStart(2, '0')})`
}

const stringNormalize = (str) => {
    let chunks = str.replace(/\([^)]*\)/g, '').split(' ')
    let normalized = chunks.map(name => {
        return name.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
    })

    return normalized
}

const getDanbooruId = (url) => {
    const regex = /https:\/\/danbooru\.donmai\.us\/posts\/(\d+)/
    const match = url.match(regex)
    if (match) {
        return match[1]
    }
    return null
}

const getRawPost = async (id) => {
    const response = await fetch(`https://danbooru.donmai.us/posts.json?tags=parent:${id}`)

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()

    return data
}

const getMedia = (data) => {
    const {
        tag_string_artist: artist,
        tag_string_character: characters,
        tag_string_copyright: copyright,
        source: sourceUrl,
        pixiv_id: pixivId
    } = data.at(0)

    const info = {
        artist: stringNormalize(artist).at(0),
        characters: stringNormalize(characters),
        copyright: stringNormalize(copyright).at(-1),
        sourceUrl,
        pixivId
    }

    const imagesUrl = data.map(el => el.large_file_url)

    return {
        info,
        imagesUrl
    }
}

const getMediaGroupMessage = async (id) => {
    const media = getMedia(await getRawPost(id))
    const url = media.info.pixivId ? `https://www.pixiv.net/artworks/${media.info.pixivId}` : media.info.sourceUrl

    const caption = media.info.copyright.toLowerCase() === 'original' ?
        fmt`${link(media.info.artist, url)} Original` :
        fmt`${link(media.info.artist, url)}
        \n${italic`Copyright`}\n${media.info.copyright}
    \n${media.info.characters.length > 1 ? italic`Characters` : italic`Character`}\n${media.info.characters.join('\n')}
    `
    const message = [{
        type: 'photo',
        media: media.imagesUrl.at(0),
        caption: caption.text,
        caption_entities: caption.entities
    }]

    message.push(...media.imagesUrl.slice(1).map(url => {
        return {
            type: 'photo',
            media: url
        }
    }))

    return message
}

export default { getDanbooruId, getMediaGroupMessage, calculateNextCronTime }