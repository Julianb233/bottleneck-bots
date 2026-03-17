/**
 * GHL Location Switcher
 *
 * Dropdown to switch between connected GHL locations.
 * Shows active location name + allows switching.
 *
 * Linear: AI-2881
 */

import React from 'react';
import { trpc } from '@/lib/trpc';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Building2, MapPin } from 'lucide-react';
import { toast } from 'sonner';

export const GHLLocationSwitcher: React.FC = () => {
  const { data: locations } = trpc.ghl.listLocations.useQuery();
  const { data: activeLocation } = trpc.ghl.getActiveLocation.useQuery();
  const utils = trpc.useUtils();

  const setActiveMutation = trpc.ghl.setActiveLocation.useMutation({
    onSuccess: (data) => {
      toast.success(`Switched to ${data.name || data.locationId}`);
      utils.ghl.getActiveLocation.invalidate();
    },
    onError: (error) => toast.error(`Failed to switch: ${error.message}`),
  });

  if (!locations || locations.length === 0) return null;

  // Don't show switcher for single location
  if (locations.length === 1) {
    const loc = locations[0];
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700">
        <Building2 className="w-4 h-4 text-orange-400" />
        <span className="text-sm text-slate-300 truncate max-w-[160px]">
          {loc.name || `Location ${loc.locationId.substring(0, 8)}`}
        </span>
      </div>
    );
  }

  return (
    <Select
      value={activeLocation?.locationId || ''}
      onValueChange={(locationId) => setActiveMutation.mutate({ locationId })}
      disabled={setActiveMutation.isPending}
    >
      <SelectTrigger className="w-[220px] bg-slate-800/50 border-slate-700 text-slate-300">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-orange-400 shrink-0" />
          <SelectValue placeholder="Select location" />
        </div>
      </SelectTrigger>
      <SelectContent className="bg-slate-900 border-slate-700">
        {locations.map((loc) => (
          <SelectItem
            key={loc.locationId}
            value={loc.locationId}
            className="text-slate-300 focus:bg-slate-800 focus:text-white"
          >
            <div className="flex items-center gap-2">
              <span className="truncate">
                {loc.name || `Location ${loc.locationId.substring(0, 8)}`}
              </span>
              {loc.locationId === activeLocation?.locationId && (
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px] px-1">
                  Active
                </Badge>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default GHLLocationSwitcher;
