'use client';

import { useState, useCallback, useMemo } from 'react';
import { toast } from '@/components/ui/use-toast';
import { Plus, Edit2, Trash2, GripVertical, ChevronUp, ChevronDown } from 'lucide-react';
import { useDragReorder } from '@/lib/hooks/useDragReorder';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useAuth, useFamily } from '@/components/providers';
import { MemberModal } from '../components/MemberModal';
import type { MemberModalSaveData } from '../components/MemberModal';
import type { FamilyMember } from '../components/PinEditModal';

async function uploadAvatarFile(memberId: string, file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`/api/family/${memberId}/avatar`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Failed to upload avatar');
  }
  const data = await res.json();
  return data.avatarUrl;
}

export function FamilySection() {
  const { activeUser, setActiveUser } = useAuth();
  const { members: familyMembers, refresh: refreshFamily } = useFamily();
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  const [showAddMember, setShowAddMember] = useState(false);

  const memberIds = useMemo(() => familyMembers.map(m => m.id), [familyMembers]);

  const saveReorder = useCallback(async (newOrder: string[]) => {
    const order = newOrder.map((id, i) => ({ id, sortOrder: i }));
    try {
      const res = await fetch('/api/family/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order }),
      });
      if (res.ok) await refreshFamily();
    } catch (err) {
      console.error('Failed to reorder:', err);
    }
  }, [refreshFamily]);

  const { draggedId, getDragProps } = useDragReorder({ order: memberIds, onReorder: saveReorder });

  const moveMember = useCallback(async (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= familyMembers.length) return;
    const newOrder = [...memberIds];
    const [moved] = newOrder.splice(index, 1);
    newOrder.splice(newIndex, 0, moved!);
    saveReorder(newOrder);
  }, [familyMembers.length, memberIds, saveReorder]);

  const deleteMember = async (id: string) => {
    const member = familyMembers.find((m) => m.id === id);
    if (member?.role === 'parent') {
      const parentCount = familyMembers.filter((m) => m.role === 'parent').length;
      if (parentCount <= 1) {
        toast({ title: 'Cannot delete the last parent', variant: 'warning' });
        return;
      }
    }
    try {
      const res = await fetch(`/api/family/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await refreshFamily();
      }
    } catch (err) {
      console.error('Failed to delete member:', err);
    }
  };

  const handleSave = async (data: MemberModalSaveData) => {
    if (editingMember) {
      try {
        const { avatarFile, ...memberData } = data;

        // Upload avatar file if provided
        let avatarUrl = memberData.avatarUrl;
        if (avatarFile) {
          avatarUrl = await uploadAvatarFile(editingMember.id, avatarFile);
        }

        const res = await fetch(`/api/family/${editingMember.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...memberData, avatarUrl }),
        });
        if (res.ok) {
          await refreshFamily();
          // Update SideNav if this is the logged-in user
          if (activeUser && activeUser.id === editingMember.id) {
            setActiveUser({
              ...activeUser,
              name: memberData.name,
              color: memberData.color,
              avatarUrl: avatarUrl ?? undefined,
            });
          }
        }
      } catch (err) {
        console.error('Failed to update member:', err);
      }
    } else {
      try {
        const { avatarFile, ...memberData } = data;

        const res = await fetch('/api/family', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...memberData, pin: data.pin }),
        });
        if (res.ok) {
          const responseData = await res.json();
          const newId = responseData.id || Date.now().toString();

          // Upload avatar file if provided (now we have the ID)
          let avatarUrl = memberData.avatarUrl;
          if (avatarFile) {
            try {
              avatarUrl = await uploadAvatarFile(newId, avatarFile);
            } catch (err) {
              console.error('Failed to upload avatar for new member:', err);
            }
          }

          await refreshFamily();
        }
      } catch (err) {
        console.error('Failed to create member:', err);
      }
    }
    setShowAddMember(false);
    setEditingMember(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Family Members</h2>
          <p className="text-muted-foreground">
            Manage who can access the dashboard
          </p>
        </div>
        <Button onClick={() => setShowAddMember(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Add Member
        </Button>
      </div>

      <div className="space-y-3">
        {familyMembers.map((member, index) => {
          const isDragging = draggedId === member.id;
          return (
          <Card key={member.id} {...getDragProps(member.id)} className={cn(
            'cursor-grab active:cursor-grabbing touch-none transition-all',
            isDragging && 'opacity-50 scale-95 ring-4 ring-primary/50'
          )}>
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    disabled={index === 0}
                    onClick={() => moveMember(index, -1)}
                    aria-label="Move up"
                  >
                    <ChevronUp className="h-3 w-3" />
                  </Button>
                  <GripVertical className="h-3 w-3 text-muted-foreground/50" />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    disabled={index === familyMembers.length - 1}
                    onClick={() => moveMember(index, 1)}
                    aria-label="Move down"
                  >
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </div>
                <UserAvatar
                  name={member.name}
                  color={member.color}
                  imageUrl={member.avatarUrl}
                  size="lg"
                  className="h-12 w-12"
                />
                <div>
                  <div className="font-medium">{member.name}</div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Badge
                      variant={member.role === 'parent' ? 'default' : 'secondary'}
                    >
                      {member.role}
                    </Badge>
                    {member.hasPin ? (
                      <span className="text-green-600">PIN set</span>
                    ) : (
                      <span className="text-orange-600">No PIN</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setEditingMember(member)}
                  aria-label="Edit member"
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteMember(member.id)}
                  className="text-destructive"
                  aria-label="Delete member"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
          );
        })}
      </div>

      {(showAddMember || editingMember) && (
        <MemberModal
          member={editingMember || undefined}
          onClose={() => {
            setShowAddMember(false);
            setEditingMember(null);
          }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
