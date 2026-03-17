/**
 * ExecutionErrorDisplay Component
 *
 * User-friendly error display with:
 * - Categorized error messages with plain-language explanations
 * - Suggested actions and retry button
 * - Collapsible technical details
 * - Copy error details for support
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  AlertTriangle,
  XCircle,
  RefreshCw,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  WifiOff,
  Clock,
  Lock,
  Bug,
  Zap,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ErrorInfo {
  category: 'network' | 'timeout' | 'auth' | 'rate_limit' | 'browser' | 'validation' | 'internal' | 'unknown';
  title: string;
  explanation: string;
  suggestions: string[];
  icon: React.ElementType;
  color: string;
}

interface ExecutionErrorDisplayProps {
  error: string;
  executionId?: number;
  taskDescription?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

function categorizeError(error: string): ErrorInfo {
  const errorLower = error.toLowerCase();

  if (errorLower.includes('timeout') || errorLower.includes('timed out') || errorLower.includes('deadline exceeded')) {
    return {
      category: 'timeout',
      title: 'Task Timed Out',
      explanation: 'The task took longer than expected to complete. This can happen with complex workflows or slow target websites.',
      suggestions: [
        'Try breaking the task into smaller steps',
        'Check if the target website is responding normally',
        'Retry - the issue may be temporary',
      ],
      icon: Clock,
      color: 'text-amber-600',
    };
  }

  if (errorLower.includes('network') || errorLower.includes('econnrefused') || errorLower.includes('fetch failed') || errorLower.includes('dns')) {
    return {
      category: 'network',
      title: 'Connection Error',
      explanation: 'Unable to reach the target service. This is usually a temporary network issue.',
      suggestions: [
        'Check your internet connection',
        'Verify the target URL is correct and accessible',
        'Wait a moment and retry',
      ],
      icon: WifiOff,
      color: 'text-red-600',
    };
  }

  if (errorLower.includes('unauthorized') || errorLower.includes('forbidden') || errorLower.includes('auth') || errorLower.includes('permission')) {
    return {
      category: 'auth',
      title: 'Authentication Failed',
      explanation: 'The agent could not authenticate with the target service. Your credentials may need to be updated.',
      suggestions: [
        'Verify your API keys and credentials are current',
        'Check if your account has the required permissions',
        'Re-authorize the service connection in Settings',
      ],
      icon: Lock,
      color: 'text-orange-600',
    };
  }

  if (errorLower.includes('rate limit') || errorLower.includes('too many requests') || errorLower.includes('429') || errorLower.includes('quota')) {
    return {
      category: 'rate_limit',
      title: 'Rate Limited',
      explanation: 'Too many requests were made in a short period. The agent will automatically back off and retry.',
      suggestions: [
        'Wait a few minutes before retrying',
        'Reduce the frequency of scheduled tasks',
        'Consider upgrading your plan for higher limits',
      ],
      icon: Zap,
      color: 'text-purple-600',
    };
  }

  if (errorLower.includes('browser') || errorLower.includes('page') || errorLower.includes('selector') || errorLower.includes('element not found') || errorLower.includes('navigation')) {
    return {
      category: 'browser',
      title: 'Browser Automation Error',
      explanation: 'The agent encountered an issue while interacting with the browser. The target page may have changed or loaded differently.',
      suggestions: [
        'Verify the target page is accessible in a regular browser',
        'The page layout may have changed - try re-running',
        'Check if the page requires login or has CAPTCHAs',
      ],
      icon: Bug,
      color: 'text-blue-600',
    };
  }

  if (errorLower.includes('validation') || errorLower.includes('invalid') || errorLower.includes('required field') || errorLower.includes('schema')) {
    return {
      category: 'validation',
      title: 'Invalid Input',
      explanation: 'The task configuration contains invalid or missing data.',
      suggestions: [
        'Review and correct the task parameters',
        'Make sure all required fields are filled in',
        'Check the format of URLs, dates, or other inputs',
      ],
      icon: AlertTriangle,
      color: 'text-yellow-600',
    };
  }

  if (errorLower.includes('internal') || errorLower.includes('unexpected') || errorLower.includes('server error') || errorLower.includes('500')) {
    return {
      category: 'internal',
      title: 'Internal Error',
      explanation: 'Something unexpected went wrong on our end. Our team has been notified.',
      suggestions: [
        'This is usually temporary - try again in a few minutes',
        'If the issue persists, contact support',
      ],
      icon: XCircle,
      color: 'text-red-600',
    };
  }

  return {
    category: 'unknown',
    title: 'Execution Failed',
    explanation: 'The task could not be completed. Review the error details below for more information.',
    suggestions: [
      'Try running the task again',
      'Simplify the task description',
      'Check the error details for specific issues',
    ],
    icon: HelpCircle,
    color: 'text-gray-600',
  };
}

export function ExecutionErrorDisplay({
  error,
  executionId,
  taskDescription,
  onRetry,
  onDismiss,
  className,
}: ExecutionErrorDisplayProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  const errorInfo = categorizeError(error);
  const IconComponent = errorInfo.icon;

  const handleCopy = async () => {
    const details = [
      `Error: ${errorInfo.title}`,
      `Category: ${errorInfo.category}`,
      executionId ? `Execution ID: ${executionId}` : '',
      taskDescription ? `Task: ${taskDescription}` : '',
      `Details: ${error}`,
      `Time: ${new Date().toISOString()}`,
    ].filter(Boolean).join('\n');

    try {
      await navigator.clipboard.writeText(details);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard not available
    }
  };

  return (
    <Card className={cn('border-red-200 bg-red-50/50', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className={cn('p-2 rounded-lg bg-white shadow-sm', errorInfo.color)}>
              <IconComponent className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base text-gray-900">{errorInfo.title}</CardTitle>
              <p className="text-sm text-gray-600 mt-1">{errorInfo.explanation}</p>
            </div>
          </div>
          <Badge variant="outline" className="text-xs shrink-0">
            {errorInfo.category}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Suggested actions */}
        <div>
          <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
            What you can do
          </h4>
          <ul className="space-y-1.5">
            {errorInfo.suggestions.map((suggestion, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-gray-600">
                <ChevronRight className="w-3.5 h-3.5 mt-0.5 text-gray-400 shrink-0" />
                {suggestion}
              </li>
            ))}
          </ul>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {onRetry && (
            <Button onClick={onRetry} size="sm" className="bg-emerald-600 hover:bg-emerald-700">
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Retry Task
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleCopy}>
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 mr-1.5 text-green-500" />
                Copied
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 mr-1.5" />
                Copy Details
              </>
            )}
          </Button>
          {onDismiss && (
            <Button variant="ghost" size="sm" onClick={onDismiss}>
              Dismiss
            </Button>
          )}
        </div>

        {/* Technical details (collapsible) */}
        <Collapsible open={showDetails} onOpenChange={setShowDetails}>
          <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors">
            {showDetails ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
            Technical Details
          </CollapsibleTrigger>
          <CollapsibleContent>
            <pre className="mt-2 text-xs bg-gray-900 text-gray-100 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap break-words">
              {error}
            </pre>
            {executionId && (
              <p className="mt-1 text-[10px] text-gray-400">
                Execution ID: {executionId}
              </p>
            )}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
