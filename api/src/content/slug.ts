/** URL slugs: lowercase Latin letters, digits and single hyphens. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
export const SLUG_MAX_LENGTH = 80

/** Russian and Uzbek Cyrillic to Latin, close to how people already write these words in URLs. */
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
  // Uzbek Cyrillic
  ў: 'o',
  қ: 'q',
  ғ: 'g',
  ҳ: 'h',
}

/**
 * "Avtomobillarni roʻyxatdan oʻtkazish" → "avtomobillarni-royxatdan-otkazish",
 * "Регистрация транспорта" → "registratsiya-transporta".
 */
export function slugify(input: string, maxLength = SLUG_MAX_LENGTH): string {
  let latin = ''
  for (const char of input.toLowerCase()) latin += CYRILLIC[char] ?? char

  return (
    latin
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      // Uzbek Latin oʻ / gʻ and stray apostrophes: drop the mark, keep the letter.
      .replace(/[ʻʼ'‘’`´]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, maxLength)
      .replace(/-+$/g, '')
  )
}

export function isSlug(value: string): boolean {
  return value.length <= SLUG_MAX_LENGTH && SLUG_PATTERN.test(value)
}
