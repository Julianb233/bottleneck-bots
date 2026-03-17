/**
 * GHL Connection Card
 *
 * Manages GoHighLevel OAuth connections from the Settings page.
 * Shows connection status, allows connect/disconnect, and lists locations.
 */

import React, { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  CheckCircle,
  XCircle,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Trash2,
  Clock,
  Plug,
  Unplug,
  TestTube,
} from 'lucide-react';
import { toast } from 'sonner';

export const GHLConnectionCard: React.FC = () => {
  const [disconnectingLocationId, setDisconnectingLocationId] = useState<string | null>(null);
  const [testingLocationId, setTestingLocationId] = useState<string | null>(null);

  // Queries
  const { data: configStatus } = trpc.ghl.configStatus.useQuery();
  const { data: statusData, refetch: refetchStatus } = trpc.ghl.status.useQuery(undefined, {
    enabled: configStatus?.configured ?? false,
  });
  const { data: locations, refetch: refetchLocations } = trpc.ghl.listLocations.useQuery(undefined, {
    enabled: configStatus?.configured ?? false,
  });

  // Mutations
  const connectMutation = trpc.ghl.connect.useMutation({
    onSuccess: (data) => {
      // Open authorization URL in new window
      const popup = window.open(
        data.authorizationUrl,
        'ghl-oauth',
        'width=600,height=700,scrollbars=yes'
      );

      if (!popup) {
        // Fallback: redirect in current window
        window.location.href = data.authorizationUrl;
      }
    },
    onError: (error) => {
      toast.error(`Failed to initiate GHL connection: ${error.message}`);
    },
  });

  const disconnectMutation = trpc.ghl.disconnect.useMutation({
    onSuccess: () => {
      toast.success('GHL location disconnected');
      setDisconnectingLocationId(null);
      refetchStatus();
      refetchLocations();
    },
    onError: (error) => {
      toast.error(`Failed to disconnect: ${error.message}`);
      setDisconnectingLocationId(null);
    },
  });

  const testMutation = trpc.ghl.testConnection.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success('Connection test passed');
      } else {
        toast.error(`Connection test failed: ${data.error}`);
      }
      setTestingLocationId(null);
      refetchStatus();
    },
    onError: (error) => {
      toast.error(`Connection test failed: ${error.message}`);
      setTestingLocationId(null);
    },
  });

  // Check for OAuth callback query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ghlConnected = params.get('ghl_connected');
    const ghlError = params.get('ghl_error');
    const ghlLocation = params.get('ghl_location');

    if (ghlConnected === 'true') {
      toast.success(
        ghlLocation
          ? `GHL location ${ghlLocation} connected successfully`
          : 'GHL connected successfully'
      );
      refetchStatus();
      refetchLocations();
      // Clean up URL params
      const url = new URL(window.location.href);
      url.searchParams.delete('ghl_connected');
      url.searchParams.delete('ghl_location');
      window.history.replaceState({}, '', url.toString());
    } else if (ghlError) {
      toast.error(`GHL connection failed: ${ghlError}`);
      const url = new URL(window.location.href);
      url.searchParams.delete('ghl_error');
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  const handleConnect = () => {
    connectMutation.mutate({});
  };

  const handleDisconnect = (locationId: string) => {
    disconnectMutation.mutate({ locationId });
  };

  const handleTest = (locationId: string) => {
    setTestingLocationId(locationId);
    testMutation.mutate({ locationId });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return (
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
            <CheckCircle className="w-3 h-3 mr-1" />
            Connected
          </Badge>
        );
      case 'needs_reauth':
        return (
          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
            <AlertCircle className="w-3 h-3 mr-1" />
            Needs Re-auth
          </Badge>
        );
      case 'disconnected':
        return (
          <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">
            <XCircle className="w-3 h-3 mr-1" />
            Disconnected
          </Badge>
        );
      default:
        return (
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
            <AlertCircle className="w-3 h-3 mr-1" />
            Error
          </Badge>
        );
    }
  };

  // Not configured state
  if (configStatus && !configStatus.configured) {
    return (
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-600 flex items-center justify-center text-xl">
              GHL
            </div>
            <div>
              <CardTitle className="text-white">GoHighLevel</CardTitle>
              <CardDescription>CRM & Marketing Automation Platform</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
            <p className="text-yellow-400 text-sm">
              <AlertCircle className="w-4 h-4 inline mr-2" />
              GHL OAuth is not configured. Set <code className="bg-slate-800 px-1 rounded">GHL_CLIENT_ID</code> and{' '}
              <code className="bg-slate-800 px-1 rounded">GHL_CLIENT_SECRET</code> environment variables to enable.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const connectedLocations = locations?.filter((l) => l.status === 'connected') || [];
  const hasConnections = connectedLocations.length > 0;

  return (
    <>
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-600 flex items-center justify-center text-xl font-bold text-white">
                GHL
              </div>
              <div>
                <CardTitle className="text-white">GoHighLevel</CardTitle>
                <CardDescription>CRM & Marketing Automation Platform</CardDescription>
              </div>
            </div>
            <Button
              onClick={handleConnect}
              disabled={connectMutation.isPending}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {connectMutation.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Plug className="w-4 h-4 mr-2" />
                  {hasConnections ? 'Add Location' : 'Connect GHL'}
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!hasConnections && !locations?.length ? (
            <div className="text-center py-8">
              <Unplug className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 mb-2">No GHL locations connected</p>
              <p className="text-slate-500 text-sm">
                Connect your GoHighLevel account to sync contacts, opportunities, and automate workflows.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {(locations || []).map((location) => (
                <div
                  key={location.id}
                  className={`flex items-center justify-between p-4 rounded-lg border ${
                    location.status === 'connected'
                      ? 'bg-slate-800/50 border-green-500/20'
                      : location.status === 'needs_reauth'
                        ? 'bg-slate-800/50 border-yellow-500/20'
                        : 'bg-slate-800/30 border-slate-700'
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-white font-medium">
                        {location.locationName || location.locationId}
                      </span>
                      {getStatusBadge(location.status)}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span>ID: {location.locationId}</span>
                      {location.connectedAt && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Connected: {new Date(location.connectedAt).toLocaleDateString()}
                        </span>
                      )}
                      {location.lastSyncAt && (
                        <span className="flex items-center gap-1">
                          <RefreshCw className="w-3 h-3" />
                          Last sync: {new Date(location.lastSyncAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    {location.lastError && (
                      <p className="text-xs text-red-400 mt-1">{location.lastError}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {location.status === 'connected' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-slate-600 text-slate-300 hover:bg-slate-700"
                        onClick={() => handleTest(location.locationId)}
                        disabled={testingLocationId === location.locationId}
                      >
                        {testingLocationId === location.locationId ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : (
                          <TestTube className="w-3 h-3" />
                        )}
                      </Button>
                    )}
                    {location.status === 'needs_reauth' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
                        onClick={handleConnect}
                      >
                        <RefreshCw className="w-3 h-3 mr-1" />
                        Re-auth
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                      onClick={() => setDisconnectingLocationId(location.locationId)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Disconnect Confirmation Dialog */}
      <AlertDialog
        open={!!disconnectingLocationId}
        onOpenChange={(open) => !open && setDisconnectingLocationId(null)}
      >
        <AlertDialogContent className="bg-slate-900 border-slate-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Disconnect GHL Location?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              This will revoke access tokens and disconnect this location. You can reconnect later.
              Any active syncs will be stopped.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-800 text-slate-300 border-slate-700">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => disconnectingLocationId && handleDisconnect(disconnectingLocationId)}
            >
              {disconnectMutation.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Disconnecting...
                </>
              ) : (
                'Disconnect'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default GHLConnectionCard;
