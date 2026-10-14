import { bracesBalanced, placeholdersOf, TEXT_KEY } from './site-texts.js'

describe('site texts', () => {
  it('finds the arguments a text uses', () => {
    expect(placeholdersOf('Поделиться в {network}')).toEqual(['network'])
    expect(placeholdersOf('{count, plural, one {# проект} other {# проектов}} у {name}')).toEqual([
      'count',
      'name',
    ])
    expect(placeholdersOf('Без аргументов')).toEqual([])
  })

  it('checks that braces pair up', () => {
    expect(bracesBalanced('Город: {city}')).toBe(true)
    expect(bracesBalanced('{count, plural, one {#} other {#}}')).toBe(true)
    expect(bracesBalanced('Город: {city')).toBe(false)
    expect(bracesBalanced('Город: city}')).toBe(false)
  })

  it('accepts message keys only', () => {
    expect(TEXT_KEY.test('Hero.title')).toBe(true)
    expect(TEXT_KEY.test('Career.vacancies.employment.fullTime')).toBe(true)
    expect(TEXT_KEY.test('Hero..title')).toBe(false)
    expect(TEXT_KEY.test('__proto__')).toBe(false)
    expect(TEXT_KEY.test('Hero.title; drop')).toBe(false)
  })
})
