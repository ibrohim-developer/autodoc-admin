import { createBrowserRouter } from 'react-router'
// Imported from each feature's barrel, not from a file inside it.
import { LoginPage, SetPasswordPage } from '@/features/auth'
import { MediaPage } from '@/features/media'
import { NewsCategoriesPage, NewsEditorPage, NewsListPage } from '@/features/news'
import { LegalEditorPage, PageEditorPage, PagesListPage } from '@/features/pages'
import { ProfilePage } from '@/features/profile'
import { RedirectsPage } from '@/features/redirects'
import { SettingsPage } from '@/features/settings'
import { SiteTextsPage } from '@/features/texts'
import { TrashPage } from '@/features/trash'
import { UsersPage } from '@/features/users'
import { VacanciesListPage, VacancyDirectionsPage, VacancyEditorPage } from '@/features/vacancies'
import { ErrorPage } from './pages/error-page'
import { HomePage } from './pages/home-page'
import { NotFoundPage } from './pages/not-found-page'
import { RequirePermission, RequireSession } from './require-session'

/**
 * React Router v8 "data mode": routes are objects, not JSX.
 *
 * Note the import is from `react-router` — `react-router-dom` stopped at 7.18.2
 * and was never published for v8.
 */
export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage />, errorElement: <ErrorPage /> },
  // Invite and password-reset links: /set-password#<token>
  { path: '/set-password', element: <SetPasswordPage />, errorElement: <ErrorPage /> },
  {
    path: '/',
    element: <RequireSession />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'profile', element: <ProfilePage /> },
      {
        path: 'news',
        element: <RequirePermission permission="content.read" />,
        children: [
          { index: true, element: <NewsListPage /> },
          { path: 'categories', element: <NewsCategoriesPage /> },
          { path: ':id', element: <NewsEditorPage /> },
        ],
      },
      {
        path: 'pages',
        element: <RequirePermission permission="content.read" />,
        children: [
          { index: true, element: <PagesListPage /> },
          { path: 'legal/:key', element: <LegalEditorPage /> },
          { path: ':key', element: <PageEditorPage /> },
        ],
      },
      {
        path: 'redirects',
        element: (
          <RequirePermission permission="content.read">
            <RedirectsPage />
          </RequirePermission>
        ),
      },
      {
        path: 'settings',
        element: (
          <RequirePermission permission="content.read">
            <SettingsPage />
          </RequirePermission>
        ),
      },
      {
        path: 'texts',
        element: (
          <RequirePermission permission="content.read">
            <SiteTextsPage />
          </RequirePermission>
        ),
      },
      {
        path: 'vacancies',
        element: <RequirePermission permission="vacancies.read" />,
        children: [
          { index: true, element: <VacanciesListPage /> },
          { path: 'directions', element: <VacancyDirectionsPage /> },
          { path: ':id', element: <VacancyEditorPage /> },
        ],
      },
      {
        path: 'users',
        element: (
          <RequirePermission permission="users.read">
            <UsersPage />
          </RequirePermission>
        ),
      },
      {
        // Not /media: that prefix belongs to the uploaded files, which the server (and the dev
        // proxy) hands to the file handler, so a reload there would never reach the dashboard.
        path: 'library',
        element: (
          <RequirePermission permission="media.read">
            <MediaPage />
          </RequirePermission>
        ),
      },
      {
        // Every role has a trash; the API decides what is in it.
        path: 'trash',
        element: (
          <RequirePermission permission="trash.vacancies">
            <TrashPage />
          </RequirePermission>
        ),
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
