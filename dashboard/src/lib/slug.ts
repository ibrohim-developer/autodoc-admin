/**
 * The same transliteration as the API (api/src/content/slug.ts), so the address field shows
 * what the page will actually be called: "Регистрация транспорта" → "registratsiya-transporta".
 */
const CYRILLIC: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'yo',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'kh',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
  ў: 'o',
  қ: 'q',
  ғ: 'g',
  ҳ: 'h',
}

export const SLUG_MAX_LENGTH = 80

export function slugify(input: string, { trim = true } = {}): string {
  let latin = ''
  for (const char of input.toLowerCase()) latin += CYRILLIC[char] ?? char
  const slug = latin
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[ʻʼ'‘’`´]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/g, '')
    .slice(0, SLUG_MAX_LENGTH)
  // While typing, a trailing hyphen is the start of the next word.
  return trim ? slug.replace(/-+$/g, '') : slug
}
