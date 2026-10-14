import { vacancyFromData, vacancyToData } from './vacancy-form'

describe('vacancy form', () => {
  it('keeps the hh.uz link through an edit, so the sync can tell it was edited', () => {
    const hh = { id: '101', hash: 'a'.repeat(64) }
    const form = vacancyFromData({
      shared: { directionId: 'd', employment: 'fullTime', hh },
      locales: { uz: { title: 'X', city: 'Toshkent', description: 'y' } },
    })
    expect(vacancyToData(form).shared.hh).toEqual(hh)
    const plain = vacancyFromData({ shared: {}, locales: { uz: {} } })
    expect(vacancyToData(plain).shared).not.toHaveProperty('hh')
  })
})
