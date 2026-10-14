import { isSafeHref, normalizeHref } from './rich-text'

describe('isSafeHref', () => {
  it('matches the API: web, mail, phone, on-site paths', () => {
    for (const href of [
      'https://autodoc.uz',
      'mailto:info@autodoc.uz',
      'tel:+998555057575',
      '/ru/about/',
      '#news',
    ]) {
      expect(isSafeHref(href)).toBe(true)
    }
    for (const href of ['javascript:alert(1)', 'data:text/html,x', '//evil.example']) {
      expect(isSafeHref(href)).toBe(false)
    }
  })
})

describe('normalizeHref', () => {
  it('turns what people type into a link', () => {
    expect(normalizeHref('autodoc.uz/about')).toBe('https://autodoc.uz/about')
    expect(normalizeHref(' info@autodoc.uz ')).toBe('mailto:info@autodoc.uz')
    expect(normalizeHref('+998 55 505 75 75')).toBe('tel:+998555057575')
    expect(normalizeHref('/ru/contacts/')).toBe('/ru/contacts/')
    expect(normalizeHref('')).toBe('')
  })
})
