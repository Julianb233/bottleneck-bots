/**
 * CircuitBreakerBanner Component
 *
 * Shows a warning banner when GHL API circuit breaker is open.
 * Auto-refreshes status every 10s. Dismissible but reappears if still open.
 */

import React, { useState, useEffect } from 'react';
import { AlertTriangle, X, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';

interface CircuitBreakerBannerProps {
  className?: string;
}

export function CircuitBreakerBanner({ className }: CircuitBreakerBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  // Query GHL circuit breaker status
  const { data: cbStatus, refetch } = trpc.ghl.circuitBreakerStatus.useQuery(undefined, {
    refetchInterval: 10_000, // Poll every 10s
    refetchOnWindowFocus: true,
    retry: false,
  });

  // Reset dismissed when state changes to open
  useEffect(() => {
    if (cbStatus?.state === 'open' && dismissed) {
      setDismissed(false);
    }
  }, [cbStatus?.state]);

  // Countdown timer for next retry
  useEffect(() => {
    if (!cbStatus?.nextRetryAt) {
      setSecondsLeft(null);
      return;
    }

    const updateCountdown = () => {
      const now = Date.now();
      const retryAt = cbStatus.nextRetryAt!;
      const diff = Math.max(0, Math.ceil((retryAt - now) / 1000));
      setSecondsLeft(diff);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [cbStatus?.nextRetryAt]);

  // Don't show if no data, closed state, or dismissed
  if (!cbStatus || cbStatus.state === 'closed' || dismissed) {
    return null;
  }

  const isOpen = cbStatus.state === 'open';
  const isHalfOpen = cbStatus.state === 'half-open';

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-lg border text-sm',
        isOpen
          ? 'bg-red-50 border-red-200 text-red-800'
          : 'bg-amber-50 border-amber-200 text-amber-800',
        className
      )}
      role="alert"
    >
      <div className={cn(
        'p-1.5 rounded-md shrink-0',
        isOpen ? 'bg-red-100' : 'bg-amber-100'
      )}>
        {isOpen ? (
          <WifiOff className="h-4 w-4" />
        ) : (
          <AlertTriangle className="h-4 w-4" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-medium">
          {isOpen
            ? 'GHL API Temporarily Unavailable'
            : 'GHL API Connection Recovering'
          }
        </p>
        <p className="text-xs opacity-80 mt-0.5">
          {isOpen && secondsLeft !== null && secondsLeft > 0
            ? `Circuit breaker is open after ${cbStatus.failureCount} failures. Retrying in ${secondsLeft}s.`
            : isOpen
              ? `Circuit breaker is open after ${cbStatus.failureCount} failures. Retrying shortly.`
              : 'Connection is being tested. Operations may be slower temporarily.'
          }
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2"
          onClick={() => refetch()}
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2"
          onClick={() => setDismissed(true)}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
