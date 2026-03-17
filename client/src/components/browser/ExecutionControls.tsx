/**
 * ExecutionControls
 *
 * Pause/Resume/Cancel controls for agent execution.
 * Displays inline with execution status and wires to agentStore actions.
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Pause,
  Play,
  Square,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { useAgentStore } from '@/stores/agentStore';
import { toast } from 'sonner';

interface ExecutionControlsProps {
  className?: string;
  /** Compact mode for inline display */
  compact?: boolean;
}

export function ExecutionControls({ className = '', compact = false }: ExecutionControlsProps) {
  const currentExecution = useAgentStore((s) => s.currentExecution);
  const pauseExecution = useAgentStore((s) => s.pauseExecution);
  const resumeExecution = useAgentStore((s) => s.resumeExecution);
  const cancelExecution = useAgentStore((s) => s.cancelExecution);

  const [isPausing, setIsPausing] = useState(false);
  const [isResuming, setIsResuming] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  if (!currentExecution) return null;

  const isPaused = currentExecution.status === 'paused';
  const isActive = ['running', 'executing', 'planning', 'started'].includes(currentExecution.status);
  const isFinished = ['completed', 'success', 'failed', 'cancelled', 'timeout'].includes(currentExecution.status);

  if (isFinished) return null;

  const handlePause = async () => {
    setIsPausing(true);
    try {
      await pauseExecution();
      toast.success('Execution paused');
    } catch {
      toast.error('Failed to pause execution');
    } finally {
      setIsPausing(false);
    }
  };

  const handleResume = async () => {
    setIsResuming(true);
    try {
      await resumeExecution();
      toast.success('Execution resumed');
    } catch {
      toast.error('Failed to resume execution');
    } finally {
      setIsResuming(false);
    }
  };

  const handleCancel = async () => {
    setIsCancelling(true);
    try {
      await cancelExecution();
      toast.success('Execution cancelled');
    } catch {
      toast.error('Failed to cancel execution');
    } finally {
      setIsCancelling(false);
      setShowCancelDialog(false);
    }
  };

  if (compact) {
    return (
      <div className={`flex items-center gap-1.5 ${className}`}>
        {isActive && (
          <Button
            variant="outline"
            size="sm"
            onClick={handlePause}
            disabled={isPausing}
            className="h-7 px-2 gap-1 text-xs"
          >
            {isPausing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Pause className="h-3 w-3" />
            )}
            Pause
          </Button>
        )}

        {isPaused && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleResume}
            disabled={isResuming}
            className="h-7 px-2 gap-1 text-xs border-green-300 text-green-700 hover:bg-green-50"
          >
            {isResuming ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Play className="h-3 w-3" />
            )}
            Resume
          </Button>
        )}

        {(isActive || isPaused) && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCancelDialog(true)}
            disabled={isCancelling}
            className="h-7 px-2 gap-1 text-xs border-red-300 text-red-600 hover:bg-red-50"
          >
            {isCancelling ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Square className="h-3 w-3" />
            )}
            Cancel
          </Button>
        )}

        <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Cancel Execution?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This will stop the agent execution immediately. Any in-progress browser actions
                will be abandoned and the session will be cleaned up. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isCancelling}>Keep Running</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleCancel}
                disabled={isCancelling}
                className="bg-red-600 hover:bg-red-700"
              >
                {isCancelling ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Square className="h-4 w-4 mr-2" />
                )}
                Cancel Execution
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Badge
        variant="secondary"
        className={`gap-1.5 ${
          isPaused
            ? 'bg-amber-100 text-amber-700 border-amber-300'
            : isActive
            ? 'bg-blue-100 text-blue-700 border-blue-300'
            : 'bg-slate-100 text-slate-600'
        }`}
      >
        {isActive && <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />}
        {isPaused && <Pause className="h-3 w-3" />}
        {isPaused ? 'Paused' : isActive ? 'Running' : currentExecution.status}
      </Badge>

      <div className="h-6 w-px bg-slate-200" />

      {isActive && (
        <Button
          variant="outline"
          size="sm"
          onClick={handlePause}
          disabled={isPausing}
          className="gap-1.5"
        >
          {isPausing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Pause className="h-4 w-4" />
          )}
          Pause
        </Button>
      )}

      {isPaused && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleResume}
          disabled={isResuming}
          className="gap-1.5 border-green-300 text-green-700 hover:bg-green-50"
        >
          {isResuming ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          Resume
        </Button>
      )}

      {(isActive || isPaused) && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowCancelDialog(true)}
          disabled={isCancelling}
          className="gap-1.5 border-red-300 text-red-600 hover:bg-red-50"
        >
          {isCancelling ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Square className="h-4 w-4" />
          )}
          Cancel
        </Button>
      )}

      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Cancel Execution?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will stop the agent execution immediately. Any in-progress browser actions
              will be abandoned and the session will be cleaned up. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelling}>Keep Running</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              disabled={isCancelling}
              className="bg-red-600 hover:bg-red-700"
            >
              {isCancelling ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Square className="h-4 w-4 mr-2" />
              )}
              Cancel Execution
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
