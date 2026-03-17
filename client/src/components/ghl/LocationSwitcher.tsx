/**
 * GHL Location Switcher
 *
 * Dropdown component for switching between connected GHL locations.
 * Shows the active location name and allows quick switching.
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

export const LocationSwitcher: React.FC<{ className?: string }> = ({ className }) => {
  const { data: locations, isLoading: locationsLoading } = trpc.ghl.listLocations.useQuery();
  const { data: activeLocation } = trpc.ghl.getActiveLocation.useQuery();
  const utils = trpc.useUtils();

  const setActiveMutation = trpc.ghl.setActiveLocation.useMutation({
    onSuccess: (data) => {
      toast.success(`Switched to location ${data.activeLocationId}`);
      utils.ghl.getActiveLocation.invalidate();
      utils.ghl.listLocations.invalidate();
    },
    onError: (err) => toast.error(`Failed to switch location: ${err.message}`),
  });

  const connectedLocations = locations || [];

  if (locationsLoading) {
    return (
      <div className={`flex items-center gap-2 text-slate-400 text-sm ${className || ''}`}>
        <Building2 className="w-4 h-4 animate-pulse" />
        <span>Loading locations...</span>
      </div>
    );
  }

  if (connectedLocations.length === 0) {
    return null;
  }

  const handleLocationChange = (locationId: string) => {
    if (locationId === activeLocation?.locationId) return;
    setActiveMutation.mutate({ locationId });
  };

  return (
    <div className={`flex items-center gap-2 ${className || ''}`}>
      <MapPin className="w-4 h-4 text-orange-400 shrink-0" />
      <Select
        value={activeLocation?.locationId || ''}
        onValueChange={handleLocationChange}
        disabled={setActiveMutation.isPending}
      >
        <SelectTrigger className="w-[220px] bg-slate-800/50 border-slate-700 text-white text-sm">
          <SelectValue placeholder="Select a location" />
        </SelectTrigger>
        <SelectContent className="bg-slate-900 border-slate-700">
          {connectedLocations.map((loc) => (
            <SelectItem
              key={loc.locationId}
              value={loc.locationId}
              className="text-white hover:bg-slate-800 focus:bg-slate-800"
            >
              <div className="flex items-center gap-2">
                <Building2 className="w-3 h-3 text-orange-400" />
                <span>{loc.name || loc.locationId}</span>
                {loc.isActive && (
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px] px-1 py-0 ml-1">
                    Active
                  </Badge>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {connectedLocations.length > 1 && (
        <Badge className="bg-slate-700/50 text-slate-400 border-slate-600 text-[10px]">
          {connectedLocations.length} locations
        </Badge>
      )}
    </div>
  );
};

export default LocationSwitcher;
