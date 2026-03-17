/**
 * CronExpressionBuilder Component
 *
 * User-friendly cron expression builder with:
 * - Preset schedules (common patterns)
 * - Custom builder with dropdowns for each field
 * - Live preview of next run times
 * - Raw expression editor for power users
 */

import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Clock,
  Calendar,
  Zap,
  Edit3,
  Check,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ========================================
// PRESETS
// ========================================

interface CronPreset {
  label: string;
  expression: string;
  description: string;
  category: 'frequent' | 'daily' | 'weekly' | 'monthly';
}

const PRESETS: CronPreset[] = [
  { label: 'Every 5 minutes', expression: '*/5 * * * *', description: 'Runs every 5 minutes', category: 'frequent' },
  { label: 'Every 15 minutes', expression: '*/15 * * * *', description: 'Runs every 15 minutes', category: 'frequent' },
  { label: 'Every 30 minutes', expression: '*/30 * * * *', description: 'Runs every 30 minutes', category: 'frequent' },
  { label: 'Every hour', expression: '0 * * * *', description: 'At the start of every hour', category: 'frequent' },
  { label: 'Every 2 hours', expression: '0 */2 * * *', description: 'Every 2 hours', category: 'frequent' },
  { label: 'Daily at midnight', expression: '0 0 * * *', description: 'Every day at 12:00 AM', category: 'daily' },
  { label: 'Daily at 6 AM', expression: '0 6 * * *', description: 'Every day at 6:00 AM', category: 'daily' },
  { label: 'Daily at 9 AM', expression: '0 9 * * *', description: 'Every day at 9:00 AM', category: 'daily' },
  { label: 'Daily at noon', expression: '0 12 * * *', description: 'Every day at 12:00 PM', category: 'daily' },
  { label: 'Daily at 6 PM', expression: '0 18 * * *', description: 'Every day at 6:00 PM', category: 'daily' },
  { label: 'Twice daily (9AM & 5PM)', expression: '0 9,17 * * *', description: 'At 9:00 AM and 5:00 PM', category: 'daily' },
  { label: 'Weekdays at 9 AM', expression: '0 9 * * 1-5', description: 'Monday-Friday at 9:00 AM', category: 'weekly' },
  { label: 'Monday at 9 AM', expression: '0 9 * * 1', description: 'Every Monday at 9:00 AM', category: 'weekly' },
  { label: 'Mon, Wed, Fri at 9 AM', expression: '0 9 * * 1,3,5', description: 'Three days a week at 9:00 AM', category: 'weekly' },
  { label: 'Weekends at 10 AM', expression: '0 10 * * 0,6', description: 'Saturday & Sunday at 10:00 AM', category: 'weekly' },
  { label: '1st of month at midnight', expression: '0 0 1 * *', description: 'First day of every month', category: 'monthly' },
  { label: '1st & 15th at 9 AM', expression: '0 9 1,15 * *', description: 'Twice a month at 9:00 AM', category: 'monthly' },
  { label: 'Last day of month', expression: '0 0 28-31 * *', description: 'Approximately last day of month', category: 'monthly' },
];

// ========================================
// HELPERS
// ========================================

const DAYS_OF_WEEK = [
  { value: '0', label: 'Sunday' },
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
];

function parseCronToHumanReadable(expression: string): string {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) return 'Invalid expression';

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  // Simple cases
  if (expression === '* * * * *') return 'Every minute';
  if (minute.startsWith('*/')) return `Every ${minute.slice(2)} minutes`;
  if (hour.startsWith('*/') && minute === '0') return `Every ${hour.slice(2)} hours`;
  if (hour === '*' && minute !== '*') return `At minute ${minute} of every hour`;

  let result = '';

  // Time
  if (minute !== '*' && hour !== '*') {
    const hours = hour.split(',');
    const timeStrings = hours.map(h => {
      const hr = parseInt(h);
      const ampm = hr >= 12 ? 'PM' : 'AM';
      const displayHr = hr === 0 ? 12 : hr > 12 ? hr - 12 : hr;
      return `${displayHr}:${minute.padStart(2, '0')} ${ampm}`;
    });
    result = `At ${timeStrings.join(' and ')}`;
  }

  // Day of week
  if (dayOfWeek !== '*') {
    if (dayOfWeek === '1-5') {
      result += ' on weekdays';
    } else if (dayOfWeek === '0,6') {
      result += ' on weekends';
    } else {
      const days = dayOfWeek.split(',').map(d => {
        const day = DAYS_OF_WEEK.find(dw => dw.value === d);
        return day?.label || d;
      });
      result += ` on ${days.join(', ')}`;
    }
  }

  // Day of month
  if (dayOfMonth !== '*') {
    const days = dayOfMonth.split(',');
    result += ` on day ${days.join(' and ')} of the month`;
  }

  // Month
  if (month !== '*') {
    const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const months = month.split(',').map(m => monthNames[parseInt(m)] || m);
    result += ` in ${months.join(', ')}`;
  }

  return result.trim() || 'Custom schedule';
}

function getNextRunTimes(expression: string, count: number = 3): Date[] {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) return [];

  // Simple next-run estimation for common patterns
  const now = new Date();
  const times: Date[] = [];

  for (let i = 0; i < count; i++) {
    const next = new Date(now.getTime() + (i + 1) * getIntervalMs(expression));
    times.push(next);
  }

  return times;
}

function getIntervalMs(expression: string): number {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) return 3600000;

  const [minute, hour] = parts;

  if (minute.startsWith('*/')) return parseInt(minute.slice(2)) * 60000;
  if (hour.startsWith('*/') && minute === '0') return parseInt(hour.slice(2)) * 3600000;
  if (hour !== '*' && minute !== '*') return 86400000; // Daily

  return 3600000; // Default to hourly
}

function isValidCron(expression: string): boolean {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) return false;

  const ranges = [
    { min: 0, max: 59 },  // minute
    { min: 0, max: 23 },  // hour
    { min: 1, max: 31 },  // day of month
    { min: 1, max: 12 },  // month
    { min: 0, max: 7 },   // day of week (0 and 7 = Sunday)
  ];

  return parts.every((part, idx) => {
    if (part === '*') return true;
    if (part.startsWith('*/')) {
      const step = parseInt(part.slice(2));
      return !isNaN(step) && step > 0 && step <= ranges[idx].max;
    }
    // Handle comma-separated values and ranges
    const segments = part.split(',');
    return segments.every(seg => {
      if (seg.includes('-')) {
        const [start, end] = seg.split('-').map(Number);
        return !isNaN(start) && !isNaN(end) && start >= ranges[idx].min && end <= ranges[idx].max;
      }
      const num = parseInt(seg);
      return !isNaN(num) && num >= ranges[idx].min && num <= ranges[idx].max;
    });
  });
}

// ========================================
// COMPONENT
// ========================================

interface CronExpressionBuilderProps {
  value: string;
  onChange: (expression: string) => void;
  className?: string;
}

export function CronExpressionBuilder({
  value,
  onChange,
  className,
}: CronExpressionBuilderProps) {
  const [activeTab, setActiveTab] = useState<string>('presets');
  const [customMinute, setCustomMinute] = useState('0');
  const [customHour, setCustomHour] = useState('9');
  const [customDayOfMonth, setCustomDayOfMonth] = useState('*');
  const [customMonth, setCustomMonth] = useState('*');
  const [customDayOfWeek, setCustomDayOfWeek] = useState('*');
  const [rawInput, setRawInput] = useState(value);
  const [presetCategory, setPresetCategory] = useState<string>('daily');

  const isValid = useMemo(() => isValidCron(value), [value]);
  const humanReadable = useMemo(() => parseCronToHumanReadable(value), [value]);
  const nextRuns = useMemo(() => (isValid ? getNextRunTimes(value) : []), [value, isValid]);

  const handlePresetSelect = useCallback((preset: CronPreset) => {
    onChange(preset.expression);
    setRawInput(preset.expression);
  }, [onChange]);

  const handleCustomBuild = useCallback(() => {
    const expr = `${customMinute} ${customHour} ${customDayOfMonth} ${customMonth} ${customDayOfWeek}`;
    onChange(expr);
    setRawInput(expr);
  }, [customMinute, customHour, customDayOfMonth, customMonth, customDayOfWeek, onChange]);

  const handleRawChange = useCallback((val: string) => {
    setRawInput(val);
    if (isValidCron(val)) {
      onChange(val);
    }
  }, [onChange]);

  const filteredPresets = useMemo(() => {
    return PRESETS.filter(p => p.category === presetCategory);
  }, [presetCategory]);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Current expression display */}
      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-500" />
          <code className="text-sm font-mono font-medium">{value}</code>
        </div>
        <div className="flex items-center gap-2">
          {isValid ? (
            <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 text-xs">
              <Check className="w-3 h-3 mr-1" />
              Valid
            </Badge>
          ) : (
            <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50 text-xs">
              <AlertCircle className="w-3 h-3 mr-1" />
              Invalid
            </Badge>
          )}
        </div>
      </div>

      {/* Human readable description */}
      {isValid && (
        <p className="text-sm text-gray-600">{humanReadable}</p>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3">
          <TabsTrigger value="presets" className="gap-1 text-xs">
            <Zap className="w-3.5 h-3.5" />
            Presets
          </TabsTrigger>
          <TabsTrigger value="custom" className="gap-1 text-xs">
            <Calendar className="w-3.5 h-3.5" />
            Custom
          </TabsTrigger>
          <TabsTrigger value="raw" className="gap-1 text-xs">
            <Edit3 className="w-3.5 h-3.5" />
            Raw
          </TabsTrigger>
        </TabsList>

        {/* Presets tab */}
        <TabsContent value="presets" className="mt-3 space-y-3">
          <div className="flex gap-1">
            {(['frequent', 'daily', 'weekly', 'monthly'] as const).map((cat) => (
              <Button
                key={cat}
                variant={presetCategory === cat ? 'default' : 'outline'}
                size="sm"
                className="text-xs capitalize"
                onClick={() => setPresetCategory(cat)}
              >
                {cat}
              </Button>
            ))}
          </div>

          <div className="grid gap-2 max-h-60 overflow-y-auto">
            {filteredPresets.map((preset) => (
              <button
                key={preset.expression}
                onClick={() => handlePresetSelect(preset)}
                className={cn(
                  'w-full text-left p-3 rounded-lg border transition-all',
                  'hover:border-emerald-300 hover:bg-emerald-50/50',
                  value === preset.expression
                    ? 'border-emerald-400 bg-emerald-50'
                    : 'border-gray-200'
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{preset.label}</span>
                  {value === preset.expression && (
                    <Check className="w-4 h-4 text-emerald-600" />
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{preset.description}</p>
                <code className="text-[10px] text-gray-400 mt-1 block font-mono">
                  {preset.expression}
                </code>
              </button>
            ))}
          </div>
        </TabsContent>

        {/* Custom builder tab */}
        <TabsContent value="custom" className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Minute</Label>
              <Select value={customMinute} onValueChange={setCustomMinute}>
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">:00 (on the hour)</SelectItem>
                  <SelectItem value="15">:15</SelectItem>
                  <SelectItem value="30">:30</SelectItem>
                  <SelectItem value="45">:45</SelectItem>
                  <SelectItem value="*/5">Every 5 min</SelectItem>
                  <SelectItem value="*/10">Every 10 min</SelectItem>
                  <SelectItem value="*/15">Every 15 min</SelectItem>
                  <SelectItem value="*/30">Every 30 min</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Hour</Label>
              <Select value={customHour} onValueChange={setCustomHour}>
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="*">Every hour</SelectItem>
                  <SelectItem value="*/2">Every 2 hours</SelectItem>
                  <SelectItem value="*/4">Every 4 hours</SelectItem>
                  <SelectItem value="*/6">Every 6 hours</SelectItem>
                  <SelectItem value="0">12 AM</SelectItem>
                  <SelectItem value="6">6 AM</SelectItem>
                  <SelectItem value="8">8 AM</SelectItem>
                  <SelectItem value="9">9 AM</SelectItem>
                  <SelectItem value="10">10 AM</SelectItem>
                  <SelectItem value="12">12 PM</SelectItem>
                  <SelectItem value="14">2 PM</SelectItem>
                  <SelectItem value="17">5 PM</SelectItem>
                  <SelectItem value="18">6 PM</SelectItem>
                  <SelectItem value="21">9 PM</SelectItem>
                  <SelectItem value="9,17">9 AM & 5 PM</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Day of Week</Label>
              <Select value={customDayOfWeek} onValueChange={setCustomDayOfWeek}>
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="*">Every day</SelectItem>
                  <SelectItem value="1-5">Weekdays (Mon-Fri)</SelectItem>
                  <SelectItem value="0,6">Weekends</SelectItem>
                  {DAYS_OF_WEEK.map(day => (
                    <SelectItem key={day.value} value={day.value}>{day.label}</SelectItem>
                  ))}
                  <SelectItem value="1,3,5">Mon, Wed, Fri</SelectItem>
                  <SelectItem value="2,4">Tue, Thu</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Day of Month</Label>
              <Select value={customDayOfMonth} onValueChange={setCustomDayOfMonth}>
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="*">Every day</SelectItem>
                  <SelectItem value="1">1st</SelectItem>
                  <SelectItem value="15">15th</SelectItem>
                  <SelectItem value="1,15">1st & 15th</SelectItem>
                  <SelectItem value="1,10,20">1st, 10th, 20th</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={handleCustomBuild} className="w-full" size="sm">
            <Check className="w-3.5 h-3.5 mr-1.5" />
            Apply Schedule
          </Button>
        </TabsContent>

        {/* Raw editor tab */}
        <TabsContent value="raw" className="mt-3 space-y-3">
          <div>
            <Label className="text-xs mb-1 block">Cron Expression</Label>
            <div className="flex gap-2">
              <Input
                value={rawInput}
                onChange={(e) => handleRawChange(e.target.value)}
                placeholder="* * * * *"
                className="font-mono text-sm"
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              Format: minute hour day-of-month month day-of-week
            </p>
          </div>

          {/* Field reference */}
          <div className="grid grid-cols-5 gap-1 text-[10px] text-gray-500 text-center">
            <div className="bg-gray-50 rounded p-1">
              <div className="font-medium">MIN</div>
              <div>0-59</div>
            </div>
            <div className="bg-gray-50 rounded p-1">
              <div className="font-medium">HOUR</div>
              <div>0-23</div>
            </div>
            <div className="bg-gray-50 rounded p-1">
              <div className="font-medium">DOM</div>
              <div>1-31</div>
            </div>
            <div className="bg-gray-50 rounded p-1">
              <div className="font-medium">MON</div>
              <div>1-12</div>
            </div>
            <div className="bg-gray-50 rounded p-1">
              <div className="font-medium">DOW</div>
              <div>0-7</div>
            </div>
          </div>

          <div className="text-[10px] text-gray-400 space-y-0.5">
            <p><code className="bg-gray-100 px-1 rounded">*</code> = any value</p>
            <p><code className="bg-gray-100 px-1 rounded">*/n</code> = every n</p>
            <p><code className="bg-gray-100 px-1 rounded">1,3,5</code> = specific values</p>
            <p><code className="bg-gray-100 px-1 rounded">1-5</code> = range</p>
          </div>
        </TabsContent>
      </Tabs>

      {/* Next run times */}
      {isValid && nextRuns.length > 0 && (
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
          <h4 className="text-xs font-semibold text-blue-800 mb-1.5">Estimated Next Runs</h4>
          <ul className="space-y-1">
            {nextRuns.map((time, idx) => (
              <li key={idx} className="text-xs text-blue-600 flex items-center gap-1.5">
                <Clock className="w-3 h-3" />
                {time.toLocaleString()}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
