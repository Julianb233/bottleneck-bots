/**
 * GHL Contact Browser
 *
 * Search, filter, view details, edit contacts, and manage tags.
 * Wired to ghl.searchContacts / getContact / updateContact / addContactTags / removeContactTags.
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
  Search,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  Tag,
  X,
  Mail,
  Phone,
  Edit2,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

const PAGE_SIZE = 20;

export default function GHLContacts() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(0);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', email: '', phone: '' });
  const [tagInput, setTagInput] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ firstName: '', lastName: '', email: '', phone: '' });

  // Debounced search
  const [searchTimeout, setSearchTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  const handleSearch = (value: string) => {
    setSearch(value);
    if (searchTimeout) clearTimeout(searchTimeout);
    setSearchTimeout(setTimeout(() => {
      setDebouncedSearch(value);
      setPage(0);
    }, 400));
  };

  const {
    data: contactsData,
    isLoading,
    refetch,
  } = trpc.ghl.searchContacts.useQuery({
    query: debouncedSearch || undefined,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  const { data: contactDetail, refetch: refetchDetail } = trpc.ghl.getContact.useQuery(
    { contactId: selectedContact?.id ?? '' },
    { enabled: !!selectedContact?.id }
  );

  const updateMutation = trpc.ghl.updateContact.useMutation({
    onSuccess: () => {
      toast.success('Contact updated');
      setEditOpen(false);
      refetch();
      refetchDetail();
    },
    onError: (err) => toast.error(err.message),
  });

  const createMutation = trpc.ghl.createContact.useMutation({
    onSuccess: () => {
      toast.success('Contact created');
      setCreateOpen(false);
      setCreateForm({ firstName: '', lastName: '', email: '', phone: '' });
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const addTagMutation = trpc.ghl.addContactTags.useMutation({
    onSuccess: () => {
      toast.success('Tag added');
      setTagInput('');
      refetchDetail();
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const removeTagMutation = trpc.ghl.removeContactTags.useMutation({
    onSuccess: () => {
      toast.success('Tag removed');
      refetchDetail();
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const contacts = contactsData?.contacts ?? contactsData ?? [];
  const totalCount = (contactsData as any)?.total ?? (contacts as any[]).length;

  const openEdit = (contact: any) => {
    setEditForm({
      firstName: contact.firstName || '',
      lastName: contact.lastName || '',
      email: contact.email || '',
      phone: contact.phone || '',
    });
    setEditOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">GHL Contacts</h1>
          <p className="text-muted-foreground text-sm">
            Browse, search, and manage GoHighLevel contacts
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <UserPlus className="h-4 w-4 mr-1" /> Add Contact
          </Button>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search contacts by name, email, phone..."
          className="pl-9"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
        />
      </div>

      {/* Contacts table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (contacts as any[]).length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              {debouncedSearch ? 'No contacts found matching your search.' : 'No contacts found. Connect a GHL location first.'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(contacts as any[]).map((contact: any) => (
                  <TableRow
                    key={contact.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedContact(contact)}
                  >
                    <TableCell className="font-medium">
                      {contact.firstName || ''} {contact.lastName || ''}
                      {!contact.firstName && !contact.lastName && (
                        <span className="text-muted-foreground italic">No name</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {contact.email ? (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          {contact.email}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {contact.phone ? (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          {contact.phone}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {(contact.tags ?? []).slice(0, 3).map((tag: string) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {(contact.tags ?? []).length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{(contact.tags as string[]).length - 3}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {contact.source || '—'}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedContact(contact);
                          openEdit(contact);
                        }}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {(contacts as any[]).length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={(page + 1) * PAGE_SIZE >= totalCount}
              onClick={() => setPage((p) => p + 1)}
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Contact Detail Dialog */}
      <Dialog open={!!selectedContact && !editOpen} onOpenChange={(open) => !open && setSelectedContact(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedContact?.firstName || ''} {selectedContact?.lastName || 'Contact Details'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Email</p>
                <p>{(contactDetail as any)?.contact?.email || selectedContact?.email || '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Phone</p>
                <p>{(contactDetail as any)?.contact?.phone || selectedContact?.phone || '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Source</p>
                <p>{(contactDetail as any)?.contact?.source || selectedContact?.source || '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Date Added</p>
                <p>{(contactDetail as any)?.contact?.dateAdded ? new Date((contactDetail as any).contact.dateAdded).toLocaleDateString() : '—'}</p>
              </div>
            </div>

            {/* Tags */}
            <div>
              <p className="text-sm font-medium mb-2 flex items-center gap-1">
                <Tag className="h-3.5 w-3.5" /> Tags
              </p>
              <div className="flex flex-wrap gap-1 mb-2">
                {(((contactDetail as any)?.contact?.tags ?? selectedContact?.tags) || []).map((tag: string) => (
                  <Badge key={tag} variant="secondary" className="text-xs pr-1">
                    {tag}
                    <button
                      className="ml-1 hover:text-destructive"
                      onClick={() =>
                        selectedContact &&
                        removeTagMutation.mutate({ contactId: selectedContact.id, tags: [tag] })
                      }
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Add tag..."
                  className="h-8 text-sm"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && tagInput.trim() && selectedContact) {
                      addTagMutation.mutate({ contactId: selectedContact.id, tags: [tagInput.trim()] });
                    }
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
                  disabled={!tagInput.trim()}
                  onClick={() =>
                    selectedContact &&
                    tagInput.trim() &&
                    addTagMutation.mutate({ contactId: selectedContact.id, tags: [tagInput.trim()] })
                  }
                >
                  Add
                </Button>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setSelectedContact(null)}>
                Close
              </Button>
              <Button onClick={() => openEdit(selectedContact)}>
                <Edit2 className="h-4 w-4 mr-1" /> Edit
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Contact Dialog */}
      <Dialog open={editOpen} onOpenChange={(open) => !open && setEditOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Contact</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">First Name</label>
                <Input
                  value={editForm.firstName}
                  onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Last Name</label>
                <Input
                  value={editForm.lastName}
                  onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Email</label>
              <Input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Phone</label>
              <Input
                value={editForm.phone}
                onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button
              disabled={updateMutation.isPending}
              onClick={() =>
                selectedContact &&
                updateMutation.mutate({
                  contactId: selectedContact.id,
                  ...editForm,
                })
              }
            >
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Contact Dialog */}
      <Dialog open={createOpen} onOpenChange={(open) => !open && setCreateOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Contact</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">First Name</label>
                <Input
                  value={createForm.firstName}
                  onChange={(e) => setCreateForm((f) => ({ ...f, firstName: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Last Name</label>
                <Input
                  value={createForm.lastName}
                  onChange={(e) => setCreateForm((f) => ({ ...f, lastName: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Email</label>
              <Input
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Phone</label>
              <Input
                value={createForm.phone}
                onChange={(e) => setCreateForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              disabled={createMutation.isPending}
              onClick={() => createMutation.mutate(createForm)}
            >
              {createMutation.isPending ? 'Creating...' : 'Create Contact'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
