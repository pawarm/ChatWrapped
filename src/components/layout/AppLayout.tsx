import { Outlet } from 'react-router-dom';
import { MainNav } from './MainNav';

export function AppLayout() {
  return (
    <div className="flex min-h-screen">
      <aside className="w-48 shrink-0 border-r border-sidebar-border bg-sidebar p-4">
        <h1 className="mb-4 text-lg font-semibold text-sidebar-foreground">
          Messages Overview
        </h1>
        <MainNav />
      </aside>
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
}
