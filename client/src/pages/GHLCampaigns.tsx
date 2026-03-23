/**
 * GHL Campaign List
 *
 * View campaigns, add/remove contacts, see campaign status.
 * Wired to ghl.listCampaigns / addContactToCampaign / removeContactFromCampaign.
 *
 * Linear: AI-5214
 */

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  RefreshCw,
  Megaphone,
  UserPlus,
  UserMinus,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';

export default function GHLCampaigns() {
  const [search, setSearch] = useState('');
  const [addContactDialog, setAddContactDialog] = useState<string | null>(null);
  const [removeContactDialog, setRemoveContactDialog] = useState<string | null>(null);
  const [contactId, setContactId] = useState('');

  const {
    data: campaignsData,
    isLoading,
    refetch,
  } = trpc.ghl.listCampaigns.useQuery();

  const addContactMutation = trpc.ghl.addContactToCampaign.useMutation({
    onSuccess: () => {
      toast.success('Contact added to campaign');
      setAddContactDialog(null);
      setContactId('');
    },
    onError: (err) => toast.error(err.message),
  });

  const removeContactMutation = trpc.ghl.removeContactFromCampaign.useMutation({
    onSuccess: () => {
      toast.success('Contact removed from campaign');
      setRemoveContactDialog(null);
      setContactId('');
    },
    onError: (err) => toast.error(err.message),
  });

  const campaigns = (campaignsData as any)?.campaigns ?? campaignsData ?? [];
  const filteredCampaigns = search
    ? (campaigns as any[]).filter((c: any) =>
        c.name?.toLowerCase().includes(search.toLowerCase())
      )
    : (campaigns as any[]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Megaphone className="h-6 w-6" /> GHL Campaigns
          </h1>
          <p className="text-muted-foreground text-sm">
            View campaigns and manage contact enrollment
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-1" /> Refresh
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Filter campaigns..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Campaign list */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredCampaigns.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              {search ? 'No campaigns match your filter.' : 'No campaigns found. Set up campaigns in GHL first.'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCampaigns.map((campaign: any) => (
                  <TableRow key={campaign.id}>
                    <TableCell className="font-medium">{campaign.name}</TableCell>
                    <TableCell>
                      <Badge
                        variant={campaign.status === 'published' || campaign.status === 'active' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {campaign.status || 'unknown'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setAddContactDialog(campaign.id);
                            setContactId('');
                          }}
                        >
                          <UserPlus className="h-3.5 w-3.5 mr-1" /> Add Contact
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setRemoveContactDialog(campaign.id);
                            setContactId('');
                          }}
                        >
                          <UserMinus className="h-3.5 w-3.5 mr-1" /> Remove
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Contact to Campaign Dialog */}
      <Dialog open={!!addContactDialog} onOpenChange={(open) => !open && setAddContactDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Contact to Campaign</DialogTitle>
          </DialogHeader>
          <div>
            <label className="text-sm font-medium">Contact ID</label>
            <Input
              placeholder="Enter GHL Contact ID"
              value={contactId}
              onChange={(e) => setContactId(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Find contact IDs on the Contacts page
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddContactDialog(null)}>Cancel</Button>
            <Button
              disabled={addContactMutation.isPending || !contactId.trim()}
              onClick={() =>
                addContactDialog &&
                addContactMutation.mutate({
                  campaignId: addContactDialog,
                  contactId: contactId.trim(),
                })
              }
            >
              {addContactMutation.isPending ? 'Adding...' : 'Add to Campaign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Contact from Campaign Dialog */}
      <Dialog open={!!removeContactDialog} onOpenChange={(open) => !open && setRemoveContactDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Contact from Campaign</DialogTitle>
          </DialogHeader>
          <div>
            <label className="text-sm font-medium">Contact ID</label>
            <Input
              placeholder="Enter GHL Contact ID"
              value={contactId}
              onChange={(e) => setContactId(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveContactDialog(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={removeContactMutation.isPending || !contactId.trim()}
              onClick={() =>
                removeContactDialog &&
                removeContactMutation.mutate({
                  campaignId: removeContactDialog,
                  contactId: contactId.trim(),
                })
              }
            >
              {removeContactMutation.isPending ? 'Removing...' : 'Remove from Campaign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
