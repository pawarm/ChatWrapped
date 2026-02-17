import { Outlet } from 'react-router-dom';
import { MainNav } from './MainNav';

export function AppLayout() {
  return (
    <div className="flex h-full overflow-hidden">
      <aside className="w-48 shrink-0 border-r border-sidebar-border bg-sidebar p-4">
        <h1 className="mb-4 text-lg font-semibold text-sidebar-foreground">
          ChatWrapped
        </h1>
        <MainNav />
      </aside>
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden p-6">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
