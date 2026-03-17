/**
 * GHL Location Config Panel
 *
 * Per-location configuration UI for sync settings, tags, and preferences.
 * Displayed within the Settings page when a location is selected.
 *
 * Linear: AI-2881
 */

import React from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import {
  Settings,
  RefreshCw,
  Tag,
  Clock,
  Users,
  Webhook,
  Save,
  Building2,
} from 'lucide-react';
import { toast } from 'sonner';

interface LocationConfigPanelProps {
  locationId: string;
}

export const LocationConfigPanel: React.FC<LocationConfigPanelProps> = ({ locationId }) => {
  const { data: config, isLoading } = trpc.ghl.getLocationConfig.useQuery({ locationId });
  const { data: locationDetails, isLoading: detailsLoading } = trpc.ghl.getLocationDetails.useQuery(
    { locationId },
    { retry: 1 }
  );
  const utils = trpc.useUtils();

  const [localConfig, setLocalConfig] = React.useState<{
    autoSyncContacts: boolean;
    autoSyncOpportunities: boolean;
    syncInterval: number;
    defaultTags: string[];
    contactImportEnabled: boolean;
    webhookEnabled: boolean;
  }>({
    autoSyncContacts: false,
    autoSyncOpportunities: false,
    syncInterval: 30,
    defaultTags: [],
    contactImportEnabled: false,
    webhookEnabled: false,
  });

  const [tagInput, setTagInput] = React.useState('');

  // Sync local state from server config
  React.useEffect(() => {
    if (config?.syncConfig) {
      const sc = config.syncConfig as Record<string, unknown>;
      setLocalConfig({
        autoSyncContacts: (sc.autoSyncContacts as boolean) ?? false,
        autoSyncOpportunities: (sc.autoSyncOpportunities as boolean) ?? false,
        syncInterval: (sc.syncInterval as number) ?? 30,
        defaultTags: (sc.defaultTags as string[]) ?? [],
        contactImportEnabled: (sc.contactImportEnabled as boolean) ?? false,
        webhookEnabled: (sc.webhookEnabled as boolean) ?? false,
      });
    }
  }, [config]);

  const updateMutation = trpc.ghl.updateLocationConfig.useMutation({
    onSuccess: () => {
      toast.success('Location config saved');
      utils.ghl.getLocationConfig.invalidate({ locationId });
      utils.ghl.listLocations.invalidate();
    },
    onError: (err) => toast.error(`Failed to save: ${err.message}`),
  });

  const handleSave = () => {
    updateMutation.mutate({
      locationId,
      syncConfig: localConfig,
    });
  };

  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (tag && !localConfig.defaultTags.includes(tag)) {
      setLocalConfig((prev) => ({ ...prev, defaultTags: [...prev.defaultTags, tag] }));
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setLocalConfig((prev) => ({
      ...prev,
      defaultTags: prev.defaultTags.filter((t) => t !== tag),
    }));
  };

  if (isLoading || detailsLoading) {
    return (
      <Card className="bg-slate-900/50 border-slate-800">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-slate-400">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Loading location config...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-900/50 border-slate-800">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
            <Settings className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <CardTitle className="text-white">
              {locationDetails?.name || config?.locationName || locationId}
            </CardTitle>
            <CardDescription>
              Per-location sync settings and configuration
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Location Details */}
        {locationDetails && (
          <div className="rounded-lg bg-slate-800/50 border border-slate-700 p-4 space-y-2">
            <h4 className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Location Details
            </h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {locationDetails.email && (
                <div>
                  <span className="text-slate-500">Email:</span>{' '}
                  <span className="text-slate-300">{locationDetails.email}</span>
                </div>
              )}
              {locationDetails.phone && (
                <div>
                  <span className="text-slate-500">Phone:</span>{' '}
                  <span className="text-slate-300">{locationDetails.phone}</span>
                </div>
              )}
              {locationDetails.city && (
                <div>
                  <span className="text-slate-500">City:</span>{' '}
                  <span className="text-slate-300">
                    {locationDetails.city}
                    {locationDetails.state ? `, ${locationDetails.state}` : ''}
                  </span>
                </div>
              )}
              {locationDetails.timezone && (
                <div>
                  <span className="text-slate-500">Timezone:</span>{' '}
                  <span className="text-slate-300">{locationDetails.timezone}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sync Settings */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-slate-300">Sync Settings</h4>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="w-4 h-4 text-blue-400" />
              <div>
                <p className="text-sm text-white">Auto-sync Contacts</p>
                <p className="text-xs text-slate-500">Automatically sync contacts from GHL</p>
              </div>
            </div>
            <Switch
              checked={localConfig.autoSyncContacts}
              onCheckedChange={(checked) =>
                setLocalConfig((prev) => ({ ...prev, autoSyncContacts: checked }))
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="w-4 h-4 text-purple-400" />
              <div>
                <p className="text-sm text-white">Auto-sync Opportunities</p>
                <p className="text-xs text-slate-500">Automatically sync pipeline opportunities</p>
              </div>
            </div>
            <Switch
              checked={localConfig.autoSyncOpportunities}
              onCheckedChange={(checked) =>
                setLocalConfig((prev) => ({ ...prev, autoSyncOpportunities: checked }))
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="w-4 h-4 text-green-400" />
              <div>
                <p className="text-sm text-white">Contact Import</p>
                <p className="text-xs text-slate-500">Allow importing contacts from this location</p>
              </div>
            </div>
            <Switch
              checked={localConfig.contactImportEnabled}
              onCheckedChange={(checked) =>
                setLocalConfig((prev) => ({ ...prev, contactImportEnabled: checked }))
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Webhook className="w-4 h-4 text-yellow-400" />
              <div>
                <p className="text-sm text-white">Webhook Events</p>
                <p className="text-xs text-slate-500">Receive webhook events from this location</p>
              </div>
            </div>
            <Switch
              checked={localConfig.webhookEnabled}
              onCheckedChange={(checked) =>
                setLocalConfig((prev) => ({ ...prev, webhookEnabled: checked }))
              }
            />
          </div>

          {/* Sync Interval */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="w-4 h-4 text-cyan-400" />
              <div>
                <p className="text-sm text-white">Sync Interval</p>
                <p className="text-xs text-slate-500">How often to sync (minutes)</p>
              </div>
            </div>
            <Input
              type="number"
              min={5}
              max={1440}
              value={localConfig.syncInterval}
              onChange={(e) =>
                setLocalConfig((prev) => ({ ...prev, syncInterval: parseInt(e.target.value) || 30 }))
              }
              className="w-20 bg-slate-800 border-slate-700 text-white text-sm"
            />
          </div>
        </div>

        {/* Default Tags */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-slate-300 flex items-center gap-2">
            <Tag className="w-4 h-4" />
            Default Tags
          </h4>
          <p className="text-xs text-slate-500">
            Tags automatically applied to contacts synced from this location
          </p>
          <div className="flex flex-wrap gap-2">
            {localConfig.defaultTags.map((tag) => (
              <Badge
                key={tag}
                className="bg-orange-500/20 text-orange-400 border-orange-500/30 cursor-pointer hover:bg-orange-500/30"
                onClick={() => handleRemoveTag(tag)}
              >
                {tag} ×
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
              placeholder="Add a tag..."
              className="bg-slate-800 border-slate-700 text-white text-sm"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddTag}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Add
            </Button>
          </div>
        </div>

        {/* Save Button */}
        <Button
          className="w-full bg-orange-600 hover:bg-orange-700 text-white"
          onClick={handleSave}
          disabled={updateMutation.isPending}
        >
          {updateMutation.isPending ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Configuration
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default LocationConfigPanel;
