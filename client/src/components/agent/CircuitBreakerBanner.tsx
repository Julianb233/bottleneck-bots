/**
 * CircuitBreakerBanner
 * Displays a warning banner when GHL API circuit breakers are open/half-open.
 * Auto-refreshes every 10 seconds.
 */

import { trpc } from '@/lib/trpc';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import { useState } from 'react';

export function CircuitBreakerBanner() {
  const [dismissed, setDismissed] = useState(false);

  const query = trpc.ghl.circuitBreakerStatus.useQuery(undefined, {
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
  });

  if (dismissed || !query.data?.hasOpenBreakers) return null;

  const openBreakers = query.data.statuses.filter(
    (s) => s.state === 'open' || s.state === 'half-open'
  );

  if (openBreakers.length === 0) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-800">
            GHL API Temporarily Unavailable
          </p>
          <div className="mt-1 space-y-1">
            {openBreakers.map((breaker) => {
              const retryIn = Math.max(
                0,
                Math.ceil((breaker.nextRetry - Date.now()) / 1000)
              );
              return (
                <p
                  key={breaker.locationId}
                  className="text-xs text-amber-700"
                >
                  Location {breaker.locationId.slice(0, 8)}... is{' '}
                  {breaker.state === 'open' ? (
                    <>unavailable (retrying in {retryIn}s)</>
                  ) : (
                    <>recovering (testing connection)</>
                  )}{' '}
                  &mdash; {breaker.failures} consecutive failures
                </p>
              );
            })}
          </div>
          <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
            <RefreshCw className="w-3 h-3" />
            Auto-refreshing every 10s
          </p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-amber-500 hover:text-amber-700 shrink-0"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
