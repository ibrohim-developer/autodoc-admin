import { LogOut, Menu, UserRound } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import { ThemeToggle } from '@/components/theme-toggle'
import { Badge } from '@/components/ui/badge'
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

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2 px-3 py-4 font-semibold">
      <span className="grid size-8 place-items-center rounded-lg bg-primary font-bold text-primary-foreground text-sm">
        A
      </span>
      <span>
        Autodoc <span className="font-normal text-muted-foreground">· админ</span>
      </span>
    </Link>
  )
}

function Sidebar({ me, onNavigate }: { me: Me; onNavigate?: () => void }) {
  return (
    <nav aria-label="Разделы" className="flex flex-col gap-4 px-2 pb-6">
      {navFor(me).map((group) => (
        <div key={group.label ?? 'main'}>
          {group.label ? (
            <p className="px-3 pb-1 font-medium text-muted-foreground text-xs uppercase tracking-wide">
              {group.label}
            </p>
          ) : null}
          <ul className="flex flex-col gap-0.5">
            {group.items.map(({ to, label, icon: Icon, ready }) => (
              <li key={to}>
                {ready ? (
                  <NavLink
                    to={to}
                    end={to === '/'}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                        isActive
                          ? 'bg-accent font-medium text-accent-foreground'
                          : 'text-foreground/80 hover:bg-muted hover:text-foreground',
                      )
                    }
                  >
                    <Icon className="size-4 shrink-0" aria-hidden="true" />
                    {label}
                  </NavLink>
                ) : (
                  <span
                    className="flex cursor-default items-center gap-3 rounded-md px-3 py-2 text-muted-foreground/70 text-sm"
                    title="Раздел появится в следующих этапах"
                  >
                    <Icon className="size-4 shrink-0" aria-hidden="true" />
                    {label}
                    <Badge variant="outline" className="ml-auto font-normal text-[10px]">
                      скоро
                    </Badge>
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

function UserMenu({ me }: { me: Me }) {
  const navigate = useNavigate()
  const logout = useLogout()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 gap-2 px-2">
          <span className="grid size-7 place-items-center rounded-full bg-secondary font-medium text-xs">
            {me.name.slice(0, 1).toUpperCase()}
          </span>
          <span className="hidden text-left sm:block">
            <span className="block font-medium text-sm leading-tight">{me.name}</span>
            <span className="block text-muted-foreground text-xs leading-tight">
              {me.roleLabel}
            </span>
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
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

export function AdminLayout({ me }: { me: Me }) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 overflow-y-auto border-r bg-card md:block">
        <Brand />
        <Sidebar me={me} />
      </aside>

      <Dialog open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DialogContent className="top-0 left-0 h-dvh max-w-72 translate-x-0 translate-y-0 overflow-y-auto rounded-none p-0 sm:max-w-72">
          <DialogTitle className="sr-only">Меню</DialogTitle>
          <Brand />
          <Sidebar me={me} onNavigate={() => setDrawerOpen(false)} />
        </DialogContent>
      </Dialog>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Открыть меню"
            onClick={() => setDrawerOpen(true)}
          >
            <Menu aria-hidden="true" />
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <UserMenu me={me} />
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
