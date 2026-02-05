'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { UserAvatar } from '@/components/ui/avatar';
import { useFamily } from '@/components/providers';
import { PinEditModal } from '../components/PinEditModal';
import type { FamilyMember } from '../components/PinEditModal';

export function SecuritySection() {
  const { members: familyMembers, refresh: refreshFamily } = useFamily();
  const [editingPinMember, setEditingPinMember] = useState<FamilyMember | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Security Settings</h2>
        <p className="text-muted-foreground">
          Manage authentication and access
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Member PINs</CardTitle>
          <CardDescription>
            Manage PIN codes for family members. PINs are required when taking actions like posting messages or completing tasks.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {familyMembers.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between p-3 rounded-md border border-border"
            >
              <div className="flex items-center gap-3">
                <UserAvatar
                  name={member.name}
                  color={member.color}
                  size="md"
                  className="h-10 w-10"
                />
                <div>
                  <div className="font-medium">{member.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {member.hasPin ? (
                      <span className="text-green-600">PIN set</span>
                    ) : (
                      <span className="text-orange-600">No PIN set</span>
                    )}
                  </div>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingPinMember(member)}
              >
                {member.hasPin ? 'Change PIN' : 'Set PIN'}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Authentication Mode</CardTitle>
          <CardDescription>
            How Prism handles user authentication
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 rounded-md bg-accent/50">
            <div className="font-medium mb-1">View Freely, Authenticate to Act</div>
            <p className="text-sm text-muted-foreground">
              Anyone can view the dashboard. When taking an action (posting a message, completing a task, etc.), a PIN prompt appears to identify who is taking the action.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Session Timeout</CardTitle>
          <CardDescription>
            Auto-logout after inactivity
          </CardDescription>
        </CardHeader>
        <CardContent>
          <select className="w-full border border-border rounded-md px-3 py-2 bg-background">
            <option value="15">15 minutes</option>
            <option value="30">30 minutes</option>
            <option value="60">1 hour</option>
            <option value="never">Never</option>
          </select>
        </CardContent>
      </Card>

      {editingPinMember && (
        <PinEditModal
          member={editingPinMember}
          onClose={() => setEditingPinMember(null)}
          onSaved={() => {
            refreshFamily();
            setEditingPinMember(null);
          }}
        />
      )}
    </div>
  );
}
