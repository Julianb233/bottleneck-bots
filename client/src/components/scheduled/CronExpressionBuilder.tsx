import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { Clock, Calendar, AlertCircle, CheckCircle } from 'lucide-react';

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
  dayOfMonth?: number
): string {
  switch (scheduleType) {
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
  const time = `${hr.padStart(2, '0')}:${min.padStart(2, '0')}`;

  if (dom === '*' && dow === '*') return `Every day at ${time}`;
  if (dom === '*' && dow !== '*') {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
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
  const [rawCron, setRawCron] = useState(value || '0 9 * * *');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Parse initial value into simple mode fields
  useEffect(() => {
    if (!value) return;
    const parts = value.split(' ');
    if (parts.length !== 5) return;
    const [min, hr, dom, , dow] = parts;

    setMinute(parseInt(min) || 0);
    setHour(parseInt(hr) || 0);
    setRawCron(value);

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

  const currentCron =
    mode === 'advanced'
      ? rawCron
      : buildCronLocally(scheduleType, hour, minute, dayOfWeek, dayOfMonth);

  // Validate cron locally (no API round-trip needed)
  const validation = useMemo(() => {
    if (!currentCron || validationError) return null;
    const parts = currentCron.trim().split(/\s+/);
    if (parts.length !== 5) return { valid: false as const, error: 'Must have 5 fields', description: null, nextRuns: [] };
    // Basic range validation: minute(0-59) hour(0-23) dom(1-31) month(1-12) dow(0-7)
    const ranges = [[0, 59], [0, 23], [1, 31], [1, 12], [0, 7]];
    for (let i = 0; i < 5; i++) {
      const field = parts[i];
      if (field === '*' || /^\*\/\d+$/.test(field) || /^\d+-\d+$/.test(field)) continue;
      const num = parseInt(field);
      if (!isNaN(num) && (num < ranges[i][0] || num > ranges[i][1])) {
        const names = ['Minute', 'Hour', 'Day of month', 'Month', 'Day of week'];
        return { valid: false as const, error: `${names[i]} out of range (${ranges[i][0]}-${ranges[i][1]})`, description: null, nextRuns: [] };
      }
    }
    return { valid: true as const, error: null, description: describeCronLocally(currentCron), nextRuns: [] };
  }, [currentCron, validationError]);

  // Update cron when simple mode fields change
  const updateFromSimpleMode = useCallback(() => {
    const cron = buildCronLocally(scheduleType, hour, minute, dayOfWeek, dayOfMonth);
    setRawCron(cron);
    setValidationError(null);
    onChange(cron, scheduleType);
  }, [scheduleType, hour, minute, dayOfWeek, dayOfMonth, onChange]);

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

  const description =
    validation?.valid
      ? (validation.description ?? describeCronLocally(currentCron))
      : describeCronLocally(currentCron);

  const nextRuns: Array<string | Date> = validation?.nextRuns ?? [];

  return (
    <div className="space-y-4">
      <Tabs value={mode} onValueChange={(v) => setMode(v as 'simple' | 'advanced')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="simple">Simple</TabsTrigger>
          <TabsTrigger value="advanced">Advanced (Cron)</TabsTrigger>
        </TabsList>

        <TabsContent value="simple" className="space-y-4 mt-4">
          {/* Schedule Type */}
          <div className="space-y-2">
            <Label>Frequency</Label>
            <Select value={scheduleType} onValueChange={(v) => setScheduleType(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>

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

          {/* Time */}
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
        </TabsContent>

        <TabsContent value="advanced" className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>Cron Expression</Label>
            <Input
              value={rawCron}
              onChange={(e) => handleRawCronChange(e.target.value)}
              placeholder="0 9 * * *"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Format: minute hour day-of-month month day-of-week
            </p>
            {validationError && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {validationError}
              </p>
            )}
            {validation && !validation.valid && validation.error && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {validation.error}
              </p>
            )}
          </div>

          {/* Quick presets */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Quick Presets</Label>
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'Every hour', cron: '0 * * * *' },
                { label: 'Every 6 hours', cron: '0 */6 * * *' },
                { label: 'Daily 9am', cron: '0 9 * * *' },
                { label: 'Daily midnight', cron: '0 0 * * *' },
                { label: 'Weekdays 9am', cron: '0 9 * * 1-5' },
                { label: 'Weekly Monday', cron: '0 9 * * 1' },
                { label: 'Monthly 1st', cron: '0 9 1 * *' },
              ].map((preset) => (
                <Button
                  key={preset.cron}
                  variant="outline"
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
            {!validationError && (validation?.valid !== false) && (
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

          {/* Next Runs */}
          {nextRuns.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Next runs:
              </p>
              <div className="space-y-0.5">
                {nextRuns.slice(0, 3).map((run, i) => (
                  <p key={i} className="text-xs text-slate-600 pl-4">
                    {new Date(run).toLocaleString()}
                  </p>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
