import React from 'react';
import { createRoot } from 'react-dom/client';
import { Button } from '@/components/ui/button';

const root = createRoot(document.getElementById('root')!);
root.render(
  <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
    <h2 className="text-2xl font-semibold">Hello from React!</h2>
    <Button>shadcn Button</Button>
  </div>,
);
