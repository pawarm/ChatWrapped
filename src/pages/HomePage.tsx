import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export function HomePage() {
  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-2xl font-semibold">Welcome to ChatWrapped</h2>
      <p className="max-w-md text-muted-foreground">
        Import your Meta/Facebook Messenger export and explore your messaging
        history with search, browsing, and analytics. All data stays on your
        device.
      </p>
      <Link to="/import">
        <Button>Import Messenger Data</Button>
      </Link>
    </div>
  );
}
