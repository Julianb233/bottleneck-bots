/**
 * GHL Connection Card
 *
 * Settings UI for GoHighLevel OAuth connection management.
 * - Connect/disconnect button
 * - Connection status badge
 * - Location selector dropdown
 *
 * Linear: AI-2877
 */

import React from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  ExternalLink,
  RefreshCw,
  Unplug,
  Building2,
} from 'lucide-react';
import { toast } from 'sonner';

export const GHLConnectionCard: React.FC = () => {
  const [disconnectLocationId, setDisconnectLocationId] = React.useState<string | null>(null);

  // tRPC queries
  const { data: locations, refetch: refetchLocations } = trpc.ghl.listLocations.useQuery();
  const { data: configStatus } = trpc.ghl.configStatus.useQuery();

  // Disconnect mutation
  const disconnectMutation = trpc.ghl.disconnect.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setDisconnectLocationId(null);
      refetchLocations();
    },
    onError: (error) => toast.error(`Failed to disconnect: ${error.message}`),
  });

  const connectedLocations = locations || [];
  const isConfigured = configStatus?.configured ?? false;

  const handleConnect = () => {
    // Redirect to GHL OAuth authorization endpoint
    window.location.href = '/api/ghl/oauth/authorize';
  };

  const handleDisconnect = (locationId: string) => {
    disconnectMutation.mutate({ locationId });
  };

  return (
    <>
      <Card className="bg-slate-900/50 border-slate-800 mt-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-500 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-white">GoHighLevel CRM</CardTitle>
                <CardDescription>
                  Connect your GHL account to enable CRM automation, contact sync, and pipeline management
                </CardDescription>
              </div>
            </div>
            {connectedLocations.length > 0 ? (
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                <CheckCircle className="w-3 h-3 mr-1" />
                {connectedLocations.length} Location{connectedLocations.length !== 1 ? 's' : ''} Connected
              </Badge>
            ) : (
              <Badge className="bg-slate-700/50 text-slate-400 border-slate-600">
                <XCircle className="w-3 h-3 mr-1" />
                Not Connected
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isConfigured && (
            <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/30 p-3">
              <p className="text-sm text-yellow-400">
                GHL OAuth is not configured. Set <code className="text-xs bg-slate-800 px-1 py-0.5 rounded">GHL_CLIENT_ID</code> and{' '}
                <code className="text-xs bg-slate-800 px-1 py-0.5 rounded">GHL_CLIENT_SECRET</code> in your environment variables.
              </p>
            </div>
          )}

          {/* Connected locations list */}
          {connectedLocations.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-slate-300">Connected Locations</h4>
              {connectedLocations.map((loc) => (
                <div
                  key={loc.locationId}
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-orange-500/20 flex items-center justify-center">
                      <Building2 className="w-4 h-4 text-orange-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">
                        Location: {loc.locationId}
                      </p>
                      {loc.companyId && (
                        <p className="text-xs text-slate-400">Company: {loc.companyId}</p>
                      )}
                      {loc.expiresAt && (
                        <p className="text-xs text-slate-500">
                          Token expires: {new Date(loc.expiresAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                      {loc.scopes.length} scope{loc.scopes.length !== 1 ? 's' : ''}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      onClick={() => setDisconnectLocationId(loc.locationId)}
                    >
                      <Unplug className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Connect button */}
          <Button
            className="w-full bg-orange-600 hover:bg-orange-700 text-white"
            onClick={handleConnect}
            disabled={!isConfigured}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            {connectedLocations.length > 0 ? 'Connect Another Location' : 'Connect GoHighLevel'}
          </Button>
        </CardContent>
      </Card>

      {/* Disconnect confirmation dialog */}
      <AlertDialog
        open={!!disconnectLocationId}
        onOpenChange={(open) => !open && setDisconnectLocationId(null)}
      >
        <AlertDialogContent className="bg-slate-900 border-slate-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Disconnect GHL Location?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              This will revoke access tokens and stop all automations for location{' '}
              <strong className="text-slate-300">{disconnectLocationId}</strong>.
              You can reconnect at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => disconnectLocationId && handleDisconnect(disconnectLocationId)}
              disabled={disconnectMutation.isPending}
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
