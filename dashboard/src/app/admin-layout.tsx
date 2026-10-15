import { LogOut, Menu, UserRound } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useLogout } from '@/features/auth'
import { cn } from '@/lib/cn'
import type { Me } from '@/lib/session'
import { navFor } from './navigation'

function Brand({ dark = true }: { dark?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2.5 px-2.5 pt-1 pb-5">
      <span className="grid size-7 place-items-center rounded-[7px] bg-[#2449d8] font-bold text-sm text-white">
        A
      </span>
      <span className="flex flex-col leading-tight">
        <span className="font-semibold text-sm">autodoc.uz</span>
        <span className={cn('text-[11px]', dark ? 'text-sidebar-muted' : 'text-muted-foreground')}>
          Админ-панель
        </span>
      </span>
    </Link>
  )
}

function Sidebar({ me, onNavigate }: { me: Me; onNavigate?: () => void }) {
  return (
    <nav aria-label="Разделы" className="flex flex-col gap-1">
      {navFor(me).map((group, index) => (
        <div key={group.label}>
          <p
            className={cn(
              'px-2.5 pb-1 text-[11px] text-sidebar-label uppercase tracking-[0.04em]',
              index === 0 ? 'pt-2' : 'pt-4',
            )}
          >
            {group.label}
          </p>
          <ul className="flex flex-col gap-0.5">
            {group.items.map(({ to, label, ready }) => (
              <li key={to}>
                {ready ? (
                  <NavLink
                    to={to}
                    end={to === '/'}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center rounded-[7px] px-2.5 py-2 text-sm transition-colors',
                        isActive
                          ? 'bg-sidebar-active font-medium text-white'
                          : 'text-sidebar-muted hover:bg-sidebar-active/60 hover:text-sidebar-foreground',
                      )
                    }
                  >
                    {label}
                  </NavLink>
                ) : (
                  <span
                    className="flex cursor-default items-center gap-2 rounded-[7px] px-2.5 py-2 text-sidebar-muted/60 text-sm"
                    title="Раздел появится в следующих этапах"
                  >
                    {label}
                    <span className="ml-auto rounded-[4px] border border-sidebar-border px-1.5 text-[10px]">
                      скоро
                    </span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

/** "Дилноза Каримова" → "ДК". */
function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || '?'
  )
}

function UserMenu({ me }: { me: Me }) {
  const navigate = useNavigate()
  const logout = useLogout()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2.5 rounded-[7px] p-2.5 text-left outline-none transition-colors hover:bg-sidebar-active focus-visible:ring-2 focus-visible:ring-[#2449d8]"
        >
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#3a3a3f] text-white text-xs">
            {initials(me.name)}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[13px] text-sidebar-foreground leading-tight">
              {me.name}
            </span>
            <span className="block truncate text-[11px] text-sidebar-muted leading-tight">
              {me.roleLabel}
            </span>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <span className="block font-medium">{me.name}</span>
          <span className="block text-muted-foreground text-xs">{me.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate('/profile')}>
          <UserRound aria-hidden="true" />
          Профиль и безопасность
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => logout.mutate()} disabled={logout.isPending}>
          <LogOut aria-hidden="true" />
          Выйти
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** The bottom of the sidebar: the theme and the signed-in user (profile, log out). */
function SidebarFooter({ me }: { me: Me }) {
  return (
    <div className="mt-auto space-y-1 border-sidebar-border border-t pt-2">
      <ThemeToggle onDark />
      <UserMenu me={me} />
    </div>
  )
}

/** Brand on top, the sections in the middle (scrolling on their own), the user at the bottom. */
function SidebarPanel({ me, onNavigate }: { me: Me; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col bg-sidebar px-3 pt-5 pb-3 text-sidebar-foreground">
      <Brand />
      <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1 pb-3">
        <Sidebar me={me} onNavigate={onNavigate} />
      </div>
      <SidebarFooter me={me} />
    </div>
  )
}

export function AdminLayout({ me }: { me: Me }) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-58 shrink-0 md:block">
        <SidebarPanel me={me} />
      </aside>

      <Dialog open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DialogContent className="top-0 left-0 block h-dvh max-w-72 translate-x-0 translate-y-0 rounded-none border-0 p-0 sm:max-w-72 [&>button]:text-sidebar-foreground">
          <DialogTitle className="sr-only">Меню</DialogTitle>
          <SidebarPanel me={me} onNavigate={() => setDrawerOpen(false)} />
        </DialogContent>
      </Dialog>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Phones only: the sidebar (with the user and the theme) opens from here. */}
        <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur md:hidden">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Открыть меню"
            onClick={() => setDrawerOpen(true)}
          >
            <Menu aria-hidden="true" />
          </Button>
          <Brand dark={false} />
        </header>
        <main className="mx-auto w-full max-w-[1240px] flex-1 px-4 py-8 sm:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
