import { screen } from '@testing-library/react'
import { meFixtures, stubApi } from '@/test/fixtures'
import { renderWithProviders } from '@/test/render-with-providers'
import { AuditPage } from './audit-page'

const LEAD = '0d5f7a52-3c44-4f0e-9d7b-6a1e2b3c4d5e'

const entries = [
  {
    id: '2',
    createdAt: '2026-10-14T06:00:00.000Z',
    userId: meFixtures.marketing.id,
    userEmail: 'marketing@autodoc.uz',
    action: 'leads.update',
    entityType: 'lead',
    entityId: LEAD,
    summary: 'Заявка №1',
    ip: '10.0.0.1',
    userAgent: 'Firefox',
    meta: { status: { from: 'new', to: 'done' } },
  },
  {
    id: '1',
    createdAt: '2026-10-14T05:00:00.000Z',
    userId: null,
    userEmail: 'system',
    action: 'some.new_action',
    entityType: null,
    entityId: null,
    summary: null,
    ip: null,
    userAgent: null,
    meta: null,
  },
]

describe('AuditPage', () => {
  it('names actions in Russian, links to what they touched and shows the details', async () => {
    const fetchMock = stubApi({
      'GET admin/audit': { body: { items: entries, total: 2 } },
      'GET admin/users': { body: { items: [], assignableRoles: [] } },
    })
    vi.stubGlobal('fetch', fetchMock)
    const { user } = renderWithProviders(<AuditPage />, { session: meFixtures.admin })

    const action = await screen.findByRole('button', { name: 'Заявка: статус или комментарий' })
    expect(screen.getByRole('link', { name: 'Заявка №1' })).toHaveAttribute(
      'href',
      `/leads/${LEAD}`,
    )
    expect(screen.getByRole('button', { name: 'some.new_action' })).toBeInTheDocument()

    await user.click(action)
    expect(screen.getByText('10.0.0.1')).toBeInTheDocument()
    expect(screen.getByText(/"to": "done"/)).toBeInTheDocument()
  })
})
