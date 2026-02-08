'use client';

import * as React from 'react';
import { useState } from 'react';
import { X, User, Trash2, ShoppingCart, Wrench, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ShoppingList, FamilyMember } from '@/types';

type ListType = 'grocery' | 'hardware' | 'other';

export function ListModal({
  list,
  familyMembers,
  onClose,
  onSave,
  onDelete,
}: {
  list: ShoppingList | null;
  familyMembers: FamilyMember[];
  onClose: () => void;
  onSave: (data: { name: string; description?: string; assignedTo?: string; listType?: ListType }) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const [name, setName] = useState(list?.name || '');
  const [description, setDescription] = useState(list?.description || '');
  const [assignedTo, setAssignedTo] = useState<string>(list?.assignedTo || '');
  const [listType, setListType] = useState<ListType>((list as { listType?: ListType } | null)?.listType || 'grocery');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!onDelete) return;
    if (!confirm(`Delete "${list?.name}"? All items on this list will also be deleted.`)) return;

    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || saving) return;

    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || undefined,
        assignedTo: assignedTo || undefined,
        listType,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 pb-20 md:pb-0"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-lg p-6 max-w-md w-full mx-4 shadow-lg border border-border max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">
            {list ? 'Edit List' : 'Create New List'}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">List Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Grocery, Target, Hardware..."
              autoFocus
            />
          </div>

          <div>
            <label className="text-sm font-medium">Description (optional)</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this list for?"
            />
          </div>

          <div>
            <label className="text-sm font-medium">List Type</label>
            <p className="text-xs text-muted-foreground mb-2">
              Grocery lists show category sections. Other types show a simple list.
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={listType === 'grocery' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setListType('grocery')}
                className="gap-1"
              >
                <ShoppingCart className="h-4 w-4" />
                Grocery
              </Button>
              <Button
                type="button"
                variant={listType === 'hardware' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setListType('hardware')}
                className="gap-1"
              >
                <Wrench className="h-4 w-4" />
                Hardware
              </Button>
              <Button
                type="button"
                variant={listType === 'other' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setListType('other')}
                className="gap-1"
              >
                <Package className="h-4 w-4" />
                Other
              </Button>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium flex items-center gap-2">
              <User className="h-4 w-4" />
              Assign To
            </label>
            <p className="text-xs text-muted-foreground mb-2">
              Only the assigned person (or parents) can check items off. Leave empty for family-wide access.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={!assignedTo ? 'default' : 'outline'}
                size="sm"
                onClick={() => setAssignedTo('')}
              >
                Everyone
              </Button>
              {familyMembers.map((member) => (
                <Button
                  key={member.id}
                  type="button"
                  variant={assignedTo === member.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setAssignedTo(member.id)}
                  className="gap-1"
                >
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: member.color }}
                  />
                  {member.name}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex justify-between gap-2 pt-4">
            {list && onDelete ? (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={saving || deleting}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                {deleting ? 'Deleting...' : 'Delete List'}
              </Button>
            ) : (
              <div />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={saving || deleting}>
                Cancel
              </Button>
              <Button type="submit" disabled={!name.trim() || saving || deleting}>
                {saving ? 'Saving...' : list ? 'Save Changes' : 'Create List'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
