import { dayOf, deviceOf, isBot, pageOf, sourceOf } from './classify.js'

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const ANDROID_TABLET =
  'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36'
const ANDROID_PHONE =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36'
const MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15'

describe('deviceOf', () => {
  it('tells phones, tablets and computers apart', () => {
    expect(deviceOf(IPHONE)).toBe('mobile')
    expect(deviceOf(ANDROID_PHONE)).toBe('mobile')
    expect(deviceOf(ANDROID_TABLET)).toBe('tablet')
    expect(deviceOf(MAC, 1440)).toBe('desktop')
    // iPadOS says "Macintosh".
    expect(deviceOf(MAC, 820)).toBe('tablet')
  })
})

describe('isBot', () => {
  it('skips crawlers, link previews and scripts', () => {
    expect(isBot('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')).toBe(
      true,
    )
    expect(isBot('TelegramBot (like TwitterBot)')).toBe(true)
    expect(isBot('Mozilla/5.0 ... HeadlessChrome/129.0')).toBe(true)
    expect(isBot('curl/8.5.0')).toBe(true)
    expect(isBot('')).toBe(true)
    expect(isBot(IPHONE)).toBe(false)
  })
})

describe('sourceOf', () => {
  it('sorts visits by where they came from', () => {
    expect(sourceOf('', 'autodoc.uz')).toEqual({ source: 'direct', name: null })
    expect(sourceOf('https://www.google.com/', 'autodoc.uz')).toEqual({
      source: 'search',
      name: 'google',
    })
    expect(sourceOf('https://yandex.uz/search/?text=autodoc', 'autodoc.uz').source).toBe('search')
    expect(sourceOf('https://l.instagram.com/?u=x', 'autodoc.uz')).toEqual({
      source: 'social',
      name: 'instagram',
    })
    expect(sourceOf('https://t.me/autodoc', 'autodoc.uz').name).toBe('telegram')
    expect(sourceOf('https://kun.uz/news/1', 'autodoc.uz')).toEqual({
      source: 'referral',
      name: 'kun.uz',
    })
    expect(sourceOf('https://autodoc.uz/blog/', 'autodoc.uz').source).toBe('internal')
    expect(sourceOf('https://www.autodoc.uz/', 'autodoc.uz').source).toBe('internal')
    expect(sourceOf('https://google.com/', 'autodoc.uz', 'Newsletter')).toEqual({
      source: 'campaign',
      name: 'newsletter',
    })
    expect(sourceOf('javascript:alert(1)', 'autodoc.uz').source).toBe('direct')
  })
})

describe('pageOf', () => {
  it('normalises addresses and finds the post or vacancy behind them', () => {
    expect(pageOf('/blog/14/?utm_source=x#top')).toEqual({
      path: '/blog/14/',
      locale: 'uz',
      content: { type: 'post', slug: '14' },
    })
    expect(pageOf('/ru/vacancies/frontend-dasturchi')).toEqual({
      path: '/ru/vacancies/frontend-dasturchi/',
      locale: 'ru',
      content: { type: 'vacancy', slug: 'frontend-dasturchi' },
    })
    expect(pageOf('/en')).toEqual({ path: '/en/', locale: 'en', content: null })
    expect(pageOf('/vacancies/')?.content).toBeNull()
    expect(pageOf('https://evil.example/')).toBeNull()
    expect(pageOf('//evil.example/')).toBeNull()
  })
})

describe('dayOf', () => {
  it('counts days in Tashkent time', () => {
    expect(dayOf(new Date('2026-10-13T19:30:00Z'))).toBe('2026-10-14')
    expect(dayOf(new Date('2026-10-13T18:59:00Z'))).toBe('2026-10-13')
  })
})
