import { assignableRoles, isRole, PERMISSIONS, permissionsOf } from './permissions.js'

describe('permissions', () => {
  it('gives the administrator everything', () => {
    expect(permissionsOf('admin')).toEqual(PERMISSIONS)
  })

  it('gives marketing everything except the audit log and integrations', () => {
    const marketing = permissionsOf('marketing')
    expect(marketing).not.toContain('audit.read')
    expect(marketing).not.toContain('integrations.manage')
    expect(marketing).toContain('applications.read')
    expect(marketing).toContain('users.manage')
    expect(marketing.length).toBe(PERMISSIONS.length - 2)
  })

  it('limits HR to vacancies, applications and vacancy statistics', () => {
    expect(permissionsOf('hr')).toEqual([
      'home.view',
      'vacancies.read',
      'vacancies.write',
      'vacancies.publish',
      'applications.read',
      'applications.write',
      'applications.export',
      'stats.vacancies',
      'trash.vacancies',
    ])
  })

  it('lets only an administrator create administrators', () => {
    expect(assignableRoles('admin')).toEqual(['admin', 'marketing', 'hr'])
    expect(assignableRoles('marketing')).toEqual(['marketing', 'hr'])
    expect(assignableRoles('hr')).toEqual([])
  })

  it('recognises roles', () => {
    expect(isRole('hr')).toBe(true)
    expect(isRole('root')).toBe(false)
  })
})
