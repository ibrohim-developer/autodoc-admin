import { monthsAgo } from './retention.js'

describe('monthsAgo', () => {
  it('goes back whole months, keeping the time', () => {
    expect(monthsAgo(new Date('2026-10-14T03:00:00Z'), 12).toISOString()).toBe(
      '2025-10-14T03:00:00.000Z',
    )
    expect(monthsAgo(new Date('2026-10-14T03:00:00Z'), 13).toISOString()).toBe(
      '2025-09-14T03:00:00.000Z',
    )
  })

  it('lands on the last day of a shorter month', () => {
    expect(monthsAgo(new Date('2026-03-31T00:00:00Z'), 1).toISOString()).toBe(
      '2026-02-28T00:00:00.000Z',
    )
    expect(monthsAgo(new Date('2028-03-31T00:00:00Z'), 1).toISOString()).toBe(
      '2028-02-29T00:00:00.000Z',
    )
  })
})
