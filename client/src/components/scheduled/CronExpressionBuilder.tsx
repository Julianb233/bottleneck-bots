import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Clock, Calendar, AlertCircle, CheckCircle, Info, Loader2 } from 'lucide-react';

interface CronExpressionBuilderProps {
  value: string;
  onChange: (cronExpression: string, scheduleType: string) => void;
  timezone?: string;
}

// Local cron builder fallback (no API needed)
function buildCronLocally(
  scheduleType: string,
  hour: number,
  minute: number,
  dayOfWeek?: number,
  dayOfMonth?: number,
  intervalMinutes?: number,
  intervalHours?: number
): string {
  switch (scheduleType) {
    case 'every_minute':
      return `*/${intervalMinutes || 5} * * * *`;
    case 'hourly':
      return `${minute} */${intervalHours || 1} * * *`;
    case 'daily':
      return `${minute} ${hour} * * *`;
    case 'weekly':
      return `${minute} ${hour} * * ${dayOfWeek ?? 0}`;
    case 'monthly':
      return `${minute} ${hour} ${dayOfMonth ?? 1} * *`;
    default:
      return `${minute} ${hour} * * *`;
  }
}

// Simple human-readable description fallback
function describeCronLocally(cron: string): string {
  const parts = cron.split(' ');
  if (parts.length !== 5) return cron;
  const [min, hr, dom, , dow] = parts;

  // Handle interval patterns
  if (min.startsWith('*/')) {
    const interval = parseInt(min.replace('*/', ''));
    return `Every ${interval} minute${interval > 1 ? 's' : ''}`;
  }
  if (hr.startsWith('*/')) {
    const interval = parseInt(hr.replace('*/', ''));
    const atMin = min === '0' ? '' : ` at :${min.padStart(2, '0')}`;
    return `Every ${interval} hour${interval > 1 ? 's' : ''}${atMin}`;
  }

  const time = `${hr.padStart(2, '0')}:${min.padStart(2, '0')}`;

  if (dom === '*' && dow === '*') return `Every day at ${time}`;
  if (dom === '*' && dow !== '*') {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    if (dow.includes('-')) {
      const [start, end] = dow.split('-').map(Number);
      return `${days[start]} through ${days[end]} at ${time}`;
    }
    return `Every ${days[parseInt(dow)] || dow} at ${time}`;
  }
  if (dom !== '*') return `Monthly on day ${dom} at ${time}`;
  return cron;
}

const DAYS_OF_WEEK = [
  { value: '0', label: 'Sunday' },
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
];

const FREQUENCY_OPTIONS = [
  { value: 'every_minute', label: 'Every N Minutes', description: 'Run every few minutes' },
  { value: 'hourly', label: 'Hourly', description: 'Run every hour or N hours' },
  { value: 'daily', label: 'Daily', description: 'Run once per day' },
  { value: 'weekly', label: 'Weekly', description: 'Run on specific day of week' },
  { value: 'monthly', label: 'Monthly', description: 'Run on specific day of month' },
];

export function CronExpressionBuilder({
  value,
  onChange,
  timezone = 'UTC',
}: CronExpressionBuilderProps) {
  const [mode, setMode] = useState<'simple' | 'advanced'>('simple');
  const [scheduleType, setScheduleType] = useState('daily');
  const [hour, setHour] = useState(9);
  const [minute, setMinute] = useState(0);
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [intervalMinutes, setIntervalMinutes] = useState(5);
  const [intervalHours, setIntervalHours] = useState(1);
  const [rawCron, setRawCron] = useState(value || '0 9 * * *');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Use tRPC to validate cron and get next run times
  const currentCron =
    mode === 'advanced'
      ? rawCron
      : buildCronLocally(scheduleType, hour, minute, dayOfWeek, dayOfMonth, intervalMinutes, intervalHours);

  const { data: cronValidation, isLoading: isValidating } = trpc.scheduledTasks.validateCron.useQuery(
    { cronExpression: currentCron, timezone },
    {
      enabled: currentCron.trim().split(/\s+/).length === 5 && !validationError,
      retry: false,
    }
  );

  // Parse initial value into simple mode fields
  useEffect(() => {
    if (!value) return;
    const parts = value.split(' ');
    if (parts.length !== 5) return;
    const [min, hr, dom, , dow] = parts;

    setRawCron(value);

    // Handle interval patterns
    if (min.startsWith('*/')) {
      setScheduleType('every_minute');
      setIntervalMinutes(parseInt(min.replace('*/', '')) || 5);
      return;
    }
    if (hr.startsWith('*/')) {
      setScheduleType('hourly');
      setIntervalHours(parseInt(hr.replace('*/', '')) || 1);
      setMinute(parseInt(min) || 0);
      return;
    }

    setMinute(parseInt(min) || 0);
    setHour(parseInt(hr) || 0);

    if (dom === '*' && dow === '*') {
      setScheduleType('daily');
    } else if (dom === '*' && dow !== '*') {
      setScheduleType('weekly');
      setDayOfWeek(parseInt(dow) || 0);
    } else if (dom !== '*') {
      setScheduleType('monthly');
      setDayOfMonth(parseInt(dom) || 1);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Validate cron locally (no API round-trip needed)
  const localValidation = useMemo(() => {
    if (validationError) return { valid: false as const, error: validationError };
    const parts = currentCron.trim().split(/\s+/);
    if (parts.length !== 5) return { valid: false as const, error: 'Must have 5 fields' };
    const ranges = [[0, 59], [0, 23], [1, 31], [1, 12], [0, 7]];
    for (let i = 0; i < 5; i++) {
      const field = parts[i];
      if (field === '*' || /^\*\/\d+$/.test(field) || /^\d+-\d+$/.test(field) || field.includes(',')) continue;
      const num = parseInt(field);
      if (!isNaN(num) && (num < ranges[i][0] || num > ranges[i][1])) {
        const names = ['Minute', 'Hour', 'Day of month', 'Month', 'Day of week'];
        return { valid: false as const, error: `${names[i]} out of range (${ranges[i][0]}-${ranges[i][1]})` };
      }
    }
    return { valid: true as const, error: null };
  }, [currentCron, validationError]);

  // Update cron when simple mode fields change
  const updateFromSimpleMode = useCallback(() => {
    const cron = buildCronLocally(scheduleType, hour, minute, dayOfWeek, dayOfMonth, intervalMinutes, intervalHours);
    setRawCron(cron);
    setValidationError(null);
    // Map internal schedule types to API-compatible types
    const apiType = scheduleType === 'every_minute' || scheduleType === 'hourly' ? 'cron' : scheduleType;
    onChange(cron, apiType);
  }, [scheduleType, hour, minute, dayOfWeek, dayOfMonth, intervalMinutes, intervalHours, onChange]);

  useEffect(() => {
    if (mode === 'simple') {
      updateFromSimpleMode();
    }
  }, [mode, updateFromSimpleMode]);

  // Handle raw cron changes in advanced mode
  const handleRawCronChange = (newCron: string) => {
    setRawCron(newCron);
    const parts = newCron.trim().split(/\s+/);
    if (parts.length !== 5) {
      setValidationError(
        'Cron expression must have 5 fields (minute hour day-of-month month day-of-week)'
      );
      return;
    }
    setValidationError(null);
    onChange(newCron.trim(), 'cron');
  };

  // Use API description if available, fall back to local
  const description = cronValidation?.valid
    ? (cronValidation.description ?? describeCronLocally(currentCron))
    : describeCronLocally(currentCron);

  // Use API next runs if available
  const nextRuns: Array<string | Date> = cronValidation?.valid ? (cronValidation.nextRuns ?? []) : [];

  return (
    <div className="space-y-4">
      <Tabs value={mode} onValueChange={(v) => setMode(v as 'simple' | 'advanced')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="simple">Simple</TabsTrigger>
          <TabsTrigger value="advanced">Advanced (Cron)</TabsTrigger>
        </TabsList>

        <TabsContent value="simple" className="space-y-4 mt-4">
          {/* Frequency */}
          <div className="space-y-2">
            <Label>Frequency</Label>
            <Select value={scheduleType} onValueChange={(v) => setScheduleType(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FREQUENCY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div className="flex items-center gap-2">
                      <span>{opt.label}</span>
                      <span className="text-xs text-muted-foreground hidden sm:inline">
                        - {opt.description}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Every N Minutes */}
          {scheduleType === 'every_minute' && (
            <div className="space-y-2">
              <Label>Run every</Label>
              <div className="flex items-center gap-2">
                <Select
                  value={intervalMinutes.toString()}
                  onValueChange={(v) => setIntervalMinutes(parseInt(v))}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 5, 10, 15, 20, 30].map((m) => (
                      <SelectItem key={m} value={m.toString()}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-sm text-muted-foreground">minutes</span>
              </div>
            </div>
          )}

          {/* Hourly */}
          {scheduleType === 'hourly' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Run every</Label>
                <div className="flex items-center gap-2">
                  <Select
                    value={intervalHours.toString()}
                    onValueChange={(v) => setIntervalHours(parseInt(v))}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 6, 8, 12].map((h) => (
                        <SelectItem key={h} value={h.toString()}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-sm text-muted-foreground">hour{intervalHours > 1 ? 's' : ''}</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>At minute</Label>
                <Select value={minute.toString()} onValueChange={(v) => setMinute(parseInt(v))}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (
                      <SelectItem key={m} value={m.toString()}>
                        :{m.toString().padStart(2, '0')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Day of Week (for weekly) */}
          {scheduleType === 'weekly' && (
            <div className="space-y-2">
              <Label>Day of Week</Label>
              <Select
                value={dayOfWeek.toString()}
                onValueChange={(v) => setDayOfWeek(parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS_OF_WEEK.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Day of Month (for monthly) */}
          {scheduleType === 'monthly' && (
            <div className="space-y-2">
              <Label>Day of Month</Label>
              <Select
                value={dayOfMonth.toString()}
                onValueChange={(v) => setDayOfMonth(parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                    <SelectItem key={d} value={d.toString()}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Time (for daily, weekly, monthly) */}
          {(scheduleType === 'daily' || scheduleType === 'weekly' || scheduleType === 'monthly') && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Hour</Label>
                <Select value={hour.toString()} onValueChange={(v) => setHour(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, i) => (
                      <SelectItem key={i} value={i.toString()}>
                        {i.toString().padStart(2, '0')}:00
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Minute</Label>
                <Select value={minute.toString()} onValueChange={(v) => setMinute(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (
                      <SelectItem key={m} value={m.toString()}>
                        :{m.toString().padStart(2, '0')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="advanced" className="space-y-4 mt-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label>Cron Expression</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs">
                    <p className="text-xs">
                      <strong>Format:</strong> minute hour day-of-month month day-of-week<br />
                      <strong>Examples:</strong><br />
                      <code>*/5 * * * *</code> - Every 5 minutes<br />
                      <code>0 */2 * * *</code> - Every 2 hours<br />
                      <code>0 9 * * 1-5</code> - Weekdays at 9am<br />
                      <code>0 0 1,15 * *</code> - 1st and 15th of month
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Input
              value={rawCron}
              onChange={(e) => handleRawCronChange(e.target.value)}
              placeholder="0 9 * * *"
              className="font-mono"
            />

            {/* Field labels */}
            <div className="grid grid-cols-5 gap-1 text-center">
              {['Minute', 'Hour', 'Day', 'Month', 'Weekday'].map((label) => (
                <span key={label} className="text-[10px] text-muted-foreground">{label}</span>
              ))}
            </div>

            {validationError && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {validationError}
              </p>
            )}
            {!validationError && localValidation && !localValidation.valid && localValidation.error && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {localValidation.error}
              </p>
            )}
            {!validationError && cronValidation && !cronValidation.valid && cronValidation.error && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {cronValidation.error}
              </p>
            )}
          </div>

          {/* Quick presets */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Quick Presets</Label>
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'Every 5 min', cron: '*/5 * * * *' },
                { label: 'Every 15 min', cron: '*/15 * * * *' },
                { label: 'Every 30 min', cron: '*/30 * * * *' },
                { label: 'Every hour', cron: '0 * * * *' },
                { label: 'Every 6 hours', cron: '0 */6 * * *' },
                { label: 'Daily 9am', cron: '0 9 * * *' },
                { label: 'Daily midnight', cron: '0 0 * * *' },
                { label: 'Weekdays 9am', cron: '0 9 * * 1-5' },
                { label: 'Weekly Monday', cron: '0 9 * * 1' },
                { label: 'Monthly 1st', cron: '0 9 1 * *' },
                { label: 'Quarterly', cron: '0 9 1 1,4,7,10 *' },
              ].map((preset) => (
                <Button
                  key={preset.cron}
                  variant={currentCron === preset.cron ? 'default' : 'outline'}
                  size="sm"
                  className="text-xs"
                  onClick={() => handleRawCronChange(preset.cron)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Schedule Preview */}
      <Card className="bg-slate-50 border-slate-200">
        <CardContent className="pt-4 space-y-3">
          {/* Description */}
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-medium">{description || 'Set a schedule'}</span>
            {isValidating && (
              <Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin" />
            )}
            {!isValidating && !validationError && localValidation?.valid && (
              <CheckCircle className="h-3.5 w-3.5 text-green-500" />
            )}
          </div>

          {/* Cron Expression Badge */}
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="font-mono text-xs">
              {currentCron}
            </Badge>
            <span className="text-xs text-muted-foreground">({timezone})</span>
          </div>

          {/* Next 5 Runs */}
          {nextRuns.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Next {Math.min(nextRuns.length, 5)} execution{nextRuns.length > 1 ? 's' : ''}:
              </p>
              <div className="space-y-0.5">
                {nextRuns.slice(0, 5).map((run, i) => (
                  <p key={i} className="text-xs text-slate-600 pl-4 flex items-center gap-2">
                    <span className="text-muted-foreground w-4 text-right">{i + 1}.</span>
                    {new Date(run).toLocaleString(undefined, {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      timeZoneName: 'short',
                    })}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Fallback message when no next runs from API */}
          {nextRuns.length === 0 && localValidation?.valid && !isValidating && (
            <p className="text-xs text-muted-foreground italic">
              Schedule preview will appear after validation
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
