import { screen } from '@testing-library/react'
import { useState } from 'react'
import { renderWithProviders } from '@/test/render-with-providers'
import { DatePicker, normalizeTime, TimePicker } from './date-picker'

function Harness({ initial = '', min }: { initial?: string; min?: string }) {
  const [value, setValue] = useState(initial)
  return (
    <>
      <DatePicker aria-label="Дата" value={value} onChange={setValue} min={min} clearable />
      <output>{value || 'пусто'}</output>
    </>
  )
}

describe('DatePicker', () => {
  it('shows the date in words and picks another day from the calendar', async () => {
    const { user } = renderWithProviders(<Harness initial="2026-10-15" />)
    expect(screen.getByRole('button', { name: 'Дата' })).toHaveTextContent('15 октября 2026 г.')

    await user.click(screen.getByRole('button', { name: 'Дата' }))
    expect(screen.getByText('Октябрь 2026')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^четверг, 15 октября 2026/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await user.click(screen.getByRole('button', { name: /^вторник, 20 октября 2026/ }))
    expect(screen.getByRole('status')).toHaveTextContent('2026-10-20')
  })

  it('moves by keyboard across months and clears', async () => {
    const { user } = renderWithProviders(<Harness initial="2026-10-31" />)
    await user.click(screen.getByRole('button', { name: 'Дата' }))
    screen.getByRole('button', { name: /^суббота, 31 октября/ }).focus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByText('Ноябрь 2026')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^воскресенье, 1 ноября/ })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('status')).toHaveTextContent('2026-11-01')

    await user.click(screen.getByRole('button', { name: 'Дата' }))
    await user.click(screen.getByRole('button', { name: 'Очистить' }))
    expect(screen.getByRole('status')).toHaveTextContent('пусто')
  })

  it('does not offer days before the minimum', async () => {
    const { user } = renderWithProviders(<Harness initial="2026-10-15" min="2026-10-10" />)
    await user.click(screen.getByRole('button', { name: 'Дата' }))
    expect(screen.getByRole('button', { name: /^пятница, 9 октября/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /^суббота, 10 октября/ })).toBeEnabled()
  })
})

describe('TimePicker', () => {
  it('reads a typed time and offers half hours', async () => {
    function Time() {
      const [value, setValue] = useState('10:00')
      return (
        <>
          <TimePicker aria-label="Время" value={value} onChange={setValue} />
          <output>{value}</output>
        </>
      )
    }
    const { user } = renderWithProviders(<Time />)
    const input = screen.getByRole('textbox', { name: 'Время' })
    await user.clear(input)
    await user.type(input, '930{Enter}')
    expect(screen.getByRole('status')).toHaveTextContent('09:30')

    await user.click(screen.getByRole('button', { name: 'Выбрать время' }))
    await user.click(screen.getByRole('button', { name: '14:30' }))
    expect(screen.getByRole('status')).toHaveTextContent('14:30')
  })

  it('normalizes what people type', () => {
    expect(normalizeTime('9')).toBe('09:00')
    expect(normalizeTime('9:5')).toBe('09:05')
    expect(normalizeTime('09.30')).toBe('09:30')
    expect(normalizeTime('1745')).toBe('17:45')
    expect(normalizeTime('25:00')).toBeNull()
    expect(normalizeTime('abc')).toBeNull()
  })
})
