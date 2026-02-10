'use client';

import { useState } from 'react';
import {
  Plus,
  Trash2,
  Pencil,
  Phone,
  Home,
  User,
  ScrollText,
  Lock,
  GripVertical,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useBabysitterInfo, type BabysitterSection, type BabysitterInfoItem } from '@/lib/hooks/useBabysitterInfo';

const SECTION_CONFIG: Record<BabysitterSection, { label: string; singular: string; icon: React.ReactNode; description: string }> = {
  emergency_contact: {
    label: 'Emergency Contacts',
    singular: 'Emergency Contact',
    icon: <Phone className="h-4 w-4" />,
    description: 'Phone numbers for emergencies',
  },
  house_info: {
    label: 'House Information',
    singular: 'House Info',
    icon: <Home className="h-4 w-4" />,
    description: 'WiFi, address, etc.',
  },
  child_info: {
    label: 'Children',
    singular: 'Child',
    icon: <User className="h-4 w-4" />,
    description: 'Allergies, bedtimes, etc.',
  },
  house_rule: {
    label: 'House Rules',
    singular: 'House Rule',
    icon: <ScrollText className="h-4 w-4" />,
    description: 'Screen time, snacks, etc.',
  },
};

export function BabysitterInfoSection() {
  const { items, loading, addItem, updateItem, deleteItem } = useBabysitterInfo({
    includeSensitive: true,
  });

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<BabysitterInfoItem | null>(null);
  const [selectedSection, setSelectedSection] = useState<BabysitterSection>('emergency_contact');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Form state
  const [formContent, setFormContent] = useState<Record<string, string>>({});
  const [formSensitive, setFormSensitive] = useState(false);

  const openAddModal = (section: BabysitterSection) => {
    setEditingItem(null);
    setSelectedSection(section);
    setFormContent({});
    setFormSensitive(false);
    setShowAddModal(true);
  };

  const openEditModal = (item: BabysitterInfoItem) => {
    setEditingItem(item);
    setSelectedSection(item.section);
    setFormContent((item.content || {}) as Record<string, string>);
    setFormSensitive(item.isSensitive);
    setShowAddModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editingItem) {
        await updateItem(editingItem.id, {
          content: formContent,
          isSensitive: formSensitive,
        });
      } else {
        await addItem({
          section: selectedSection,
          content: formContent,
          isSensitive: formSensitive,
        });
      }
      setShowAddModal(false);
    } catch (error) {
      console.error('Failed to save:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await deleteItem(id);
    } catch (error) {
      console.error('Failed to delete:', error);
    } finally {
      setDeleting(null);
    }
  };

  const getItemsBySection = (section: BabysitterSection) =>
    items.filter((item) => item.section === section);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Babysitter Information</CardTitle>
          <CardDescription>
            Information visible to babysitters on the /babysitter page
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {(Object.keys(SECTION_CONFIG) as BabysitterSection[]).map((section) => {
            const config = SECTION_CONFIG[section];
            const sectionItems = getItemsBySection(section);

            return (
              <div key={section} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {config.icon}
                    <span className="font-medium">{config.label}</span>
                    <span className="text-sm text-muted-foreground">
                      ({sectionItems.length})
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openAddModal(section)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </div>

                {sectionItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground pl-6">
                    {config.description}
                  </p>
                ) : (
                  <div className="space-y-2 pl-6">
                    {sectionItems.map((item) => (
                      <ItemRow
                        key={item.id}
                        item={item}
                        section={section}
                        onEdit={() => openEditModal(item)}
                        onDelete={() => handleDelete(item.id)}
                        isDeleting={deleting === item.id}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Add/Edit Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Edit' : 'Add'} {SECTION_CONFIG[selectedSection].singular}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <SectionForm
              section={selectedSection}
              content={formContent}
              onChange={setFormContent}
            />

            <div className="flex items-center justify-between pt-2 border-t">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="sensitive">Sensitive (requires PIN to view)</Label>
              </div>
              <Switch
                id="sensitive"
                checked={formSensitive}
                onCheckedChange={setFormSensitive}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : editingItem ? 'Update' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface ItemRowProps {
  item: BabysitterInfoItem;
  section: BabysitterSection;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}

function ItemRow({ item, section, onEdit, onDelete, isDeleting }: ItemRowProps) {
  const content = (item.content || {}) as Record<string, string>;
  const label = getItemLabel(section, content);

  return (
    <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
      <div className="flex items-center gap-2 min-w-0">
        {item.isSensitive && (
          <Lock className="h-3 w-3 text-muted-foreground shrink-0" />
        )}
        <span className="text-sm truncate">{label}</span>
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive"
          onClick={onDelete}
          disabled={isDeleting}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function getItemLabel(section: BabysitterSection, content: Record<string, string>): string {
  switch (section) {
    case 'emergency_contact':
      return content.name || 'Contact';
    case 'house_info':
      return content.label || 'Info';
    case 'child_info':
      return content.name || 'Child';
    case 'house_rule':
      return content.rule?.slice(0, 50) || 'Rule';
    default:
      return 'Item';
  }
}

interface SectionFormProps {
  section: BabysitterSection;
  content: Record<string, string>;
  onChange: (content: Record<string, string>) => void;
}

function SectionForm({ section, content, onChange }: SectionFormProps) {
  const updateField = (key: string, value: string) => {
    onChange({ ...content, [key]: value });
  };

  switch (section) {
    case 'emergency_contact':
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={content.name || ''}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="John Smith"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="relationship">Relationship</Label>
            <Input
              id="relationship"
              value={content.relationship || ''}
              onChange={(e) => updateField('relationship', e.target.value)}
              placeholder="Dad, Neighbor, etc."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={content.phone || ''}
              onChange={(e) => updateField('phone', e.target.value)}
              placeholder="(555) 123-4567"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="isPrimary"
              checked={content.isPrimary === 'true'}
              onCheckedChange={(checked) => updateField('isPrimary', String(checked))}
            />
            <Label htmlFor="isPrimary">Primary contact</Label>
          </div>
        </div>
      );

    case 'house_info':
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="label">Label</Label>
            <Input
              id="label"
              value={content.label || ''}
              onChange={(e) => updateField('label', e.target.value)}
              placeholder="WiFi Password, Address, etc."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="value">Value</Label>
            <Input
              id="value"
              value={content.value || ''}
              onChange={(e) => updateField('value', e.target.value)}
              placeholder="Enter the value"
            />
          </div>
        </div>
      );

    case 'child_info':
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="childName">Name</Label>
            <Input
              id="childName"
              value={content.name || ''}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="Child's name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="age">Age</Label>
            <Input
              id="age"
              type="number"
              value={content.age || ''}
              onChange={(e) => updateField('age', e.target.value)}
              placeholder="8"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="allergies">Allergies</Label>
            <Input
              id="allergies"
              value={content.allergies || ''}
              onChange={(e) => updateField('allergies', e.target.value)}
              placeholder="Peanuts, dairy, etc."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="medications">Medications</Label>
            <Input
              id="medications"
              value={content.medications || ''}
              onChange={(e) => updateField('medications', e.target.value)}
              placeholder="None, or list medications"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bedtime">Bedtime</Label>
            <Input
              id="bedtime"
              value={content.bedtime || ''}
              onChange={(e) => updateField('bedtime', e.target.value)}
              placeholder="8:00 PM"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={content.notes || ''}
              onChange={(e) => updateField('notes', e.target.value)}
              placeholder="Any other important info..."
            />
          </div>
        </div>
      );

    case 'house_rule':
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rule">Rule</Label>
            <Textarea
              id="rule"
              value={content.rule || ''}
              onChange={(e) => updateField('rule', e.target.value)}
              placeholder="No TV after 7 PM"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="importance">Importance</Label>
            <Select
              value={content.importance || 'medium'}
              onValueChange={(value) => updateField('importance', value)}
            >
              <SelectTrigger id="importance">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      );

    default:
      return null;
  }
}
