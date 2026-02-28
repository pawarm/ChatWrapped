import { NavLink } from 'react-router-dom';

const navItems = [
  { to: '/', label: 'Home' },
  { to: '/conversations', label: 'Conversations' },
  { to: '/stats', label: 'Stats' },
  { to: '/import', label: 'Import' },
] as const;

export function MainNav() {
  return (
    <nav className="flex flex-col gap-1">
      {navItems.map(({ to, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              isActive
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
            }`
          }
        >
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
