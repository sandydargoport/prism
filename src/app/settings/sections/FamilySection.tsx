'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/ui/avatar';
import { MemberModal } from '../components/MemberModal';
import type { FamilyMember } from '../components/PinEditModal';

export function FamilySection({
  familyMembers,
  setFamilyMembers,
}: {
  familyMembers: FamilyMember[];
  setFamilyMembers: React.Dispatch<React.SetStateAction<FamilyMember[]>>;
}) {
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  const [showAddMember, setShowAddMember] = useState(false);

  const deleteMember = (id: string) => {
    const member = familyMembers.find((m) => m.id === id);
    if (member?.role === 'parent') {
      const parentCount = familyMembers.filter((m) => m.role === 'parent').length;
      if (parentCount <= 1) {
        alert('Cannot delete the last parent');
        return;
      }
    }
    setFamilyMembers((prev) => prev.filter((m) => m.id !== id));
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
        {familyMembers.map((member) => (
          <Card key={member.id}>
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <UserAvatar
                  name={member.name}
                  color={member.color}
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
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteMember(member.id)}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {(showAddMember || editingMember) && (
        <MemberModal
          member={editingMember || undefined}
          onClose={() => {
            setShowAddMember(false);
            setEditingMember(null);
          }}
          onSave={async (member) => {
            if (editingMember) {
              try {
                const res = await fetch(`/api/family/${editingMember.id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(member),
                });
                if (res.ok) {
                  setFamilyMembers((prev) =>
                    prev.map((m) => (m.id === editingMember.id ? { ...m, ...member } : m))
                  );
                }
              } catch (err) {
                console.error('Failed to update member:', err);
              }
            } else {
              try {
                const res = await fetch('/api/family', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(member),
                });
                if (res.ok) {
                  const data = await res.json();
                  setFamilyMembers((prev) => [
                    ...prev,
                    { ...member, id: data.id || Date.now().toString(), hasPin: false },
                  ]);
                }
              } catch (err) {
                console.error('Failed to create member:', err);
              }
            }
            setShowAddMember(false);
            setEditingMember(null);
          }}
        />
      )}
    </div>
  );
}
