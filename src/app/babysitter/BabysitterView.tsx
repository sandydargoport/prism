'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Home,
  Phone,
  User,
  ScrollText,
  AlertTriangle,
  Lock,
  Printer,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageWrapper } from '@/components/layout';
import { useBabysitterInfo, type BabysitterInfoItem, type BabysitterSection } from '@/lib/hooks/useBabysitterInfo';
import { QuickPinModal } from '@/components/auth/QuickPinModal';
import { cn } from '@/lib/utils';

interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
  isPrimary?: boolean;
}

interface HouseInfo {
  label: string;
  value: string;
}

interface ChildInfo {
  name: string;
  age?: number;
  allergies?: string;
  medications?: string;
  bedtime?: string;
  notes?: string;
}

interface HouseRule {
  rule: string;
  importance?: 'high' | 'medium' | 'low';
}

const SECTION_CONFIG: Record<BabysitterSection, { label: string; icon: React.ReactNode }> = {
  emergency_contact: { label: 'Emergency Contacts', icon: <Phone className="h-5 w-5" /> },
  house_info: { label: 'House Information', icon: <Home className="h-5 w-5" /> },
  child_info: { label: 'Children', icon: <User className="h-5 w-5" /> },
  house_rule: { label: 'House Rules', icon: <ScrollText className="h-5 w-5" /> },
};

export function BabysitterView() {
  const { items, loading, error } = useBabysitterInfo();
  const [showPinModal, setShowPinModal] = useState(false);
  const [unlockedItems, setUnlockedItems] = useState<Set<string>>(new Set());

  const handleUnlockItem = (itemId: string) => {
    setUnlockedItems((prev) => new Set([...prev, itemId]));
    setShowPinModal(false);
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <PageWrapper>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </PageWrapper>
    );
  }

  if (error) {
    return (
      <PageWrapper>
        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
          <AlertTriangle className="h-8 w-8 mb-2" />
          <p>Failed to load babysitter information</p>
        </div>
      </PageWrapper>
    );
  }

  const getItemsBySection = (section: BabysitterSection) =>
    items.filter((item) => item.section === section);

  const sections: BabysitterSection[] = ['emergency_contact', 'house_info', 'child_info', 'house_rule'];

  return (
    <PageWrapper>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 print:mb-4">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="icon" className="print:hidden">
              <Home className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Babysitter Info</h1>
        </div>
        <Button variant="outline" onClick={handlePrint} className="print:hidden">
          <Printer className="h-4 w-4 mr-2" />
          Print
        </Button>
      </div>

      {/* Content */}
      {items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <ScrollText className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg">No babysitter information configured</p>
            <p className="text-sm mt-1">
              Parents can add information in Settings → Babysitter Info
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:gap-4">
          {sections.map((section) => {
            const sectionItems = getItemsBySection(section);
            if (sectionItems.length === 0) return null;

            const config = SECTION_CONFIG[section];

            return (
              <Card key={section} className="print:break-inside-avoid">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    {config.icon}
                    {config.label}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {sectionItems.map((item) => (
                    <SectionItem
                      key={item.id}
                      item={item}
                      section={section}
                      isUnlocked={unlockedItems.has(item.id)}
                      onUnlock={() => setShowPinModal(true)}
                    />
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* PIN Modal for unlocking sensitive items */}
      <QuickPinModal
        open={showPinModal}
        onOpenChange={setShowPinModal}
        title="Unlock Sensitive Info"
        description="Enter a parent PIN to view sensitive information"
        onAuthenticated={(user) => {
          // Unlock all sensitive items for this session
          const sensitiveIds = items.filter((i) => i.isSensitive).map((i) => i.id);
          setUnlockedItems(new Set(sensitiveIds));
          setShowPinModal(false);
        }}
      />
    </PageWrapper>
  );
}

interface SectionItemProps {
  item: BabysitterInfoItem;
  section: BabysitterSection;
  isUnlocked: boolean;
  onUnlock: () => void;
}

function SectionItem({ item, section, isUnlocked, onUnlock }: SectionItemProps) {
  const isSensitive = item.isSensitive && !isUnlocked;

  if (isSensitive) {
    return (
      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Lock className="h-4 w-4" />
          <span className="text-sm">Sensitive information</span>
        </div>
        <Button variant="outline" size="sm" onClick={onUnlock} className="print:hidden">
          Unlock
        </Button>
      </div>
    );
  }

  if (!item.content) return null;

  switch (section) {
    case 'emergency_contact':
      return <EmergencyContactItem content={item.content as unknown as EmergencyContact} />;
    case 'house_info':
      return <HouseInfoItem content={item.content as unknown as HouseInfo} />;
    case 'child_info':
      return <ChildInfoItem content={item.content as unknown as ChildInfo} />;
    case 'house_rule':
      return <HouseRuleItem content={item.content as unknown as HouseRule} />;
    default:
      return null;
  }
}

function EmergencyContactItem({ content }: { content: EmergencyContact }) {
  return (
    <div className="flex items-start justify-between p-3 bg-muted/30 rounded-lg">
      <div>
        <div className="flex items-center gap-2">
          <span className="font-medium">{content.name}</span>
          {content.isPrimary && (
            <Badge variant="default" className="text-xs">
              Primary
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{content.relationship}</p>
      </div>
      <a
        href={`tel:${content.phone}`}
        className="text-primary font-medium hover:underline print:no-underline"
      >
        {content.phone}
      </a>
    </div>
  );
}

function HouseInfoItem({ content }: { content: HouseInfo }) {
  return (
    <div className="flex items-start justify-between p-3 bg-muted/30 rounded-lg">
      <span className="text-sm text-muted-foreground">{content.label}</span>
      <span className="font-medium text-right">{content.value}</span>
    </div>
  );
}

function ChildInfoItem({ content }: { content: ChildInfo }) {
  return (
    <div className="p-3 bg-muted/30 rounded-lg space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-medium">{content.name}</span>
        {content.age !== undefined && (
          <span className="text-sm text-muted-foreground">Age: {content.age}</span>
        )}
      </div>
      {content.allergies && (
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <div>
            <span className="text-sm font-medium text-destructive">Allergies:</span>
            <span className="text-sm ml-1">{content.allergies}</span>
          </div>
        </div>
      )}
      {content.medications && (
        <p className="text-sm">
          <span className="text-muted-foreground">Medications:</span> {content.medications}
        </p>
      )}
      {content.bedtime && (
        <p className="text-sm">
          <span className="text-muted-foreground">Bedtime:</span> {content.bedtime}
        </p>
      )}
      {content.notes && (
        <p className="text-sm text-muted-foreground">{content.notes}</p>
      )}
    </div>
  );
}

function HouseRuleItem({ content }: { content: HouseRule }) {
  const importanceColors = {
    high: 'border-l-destructive',
    medium: 'border-l-warning',
    low: 'border-l-muted-foreground',
  };

  return (
    <div
      className={cn(
        'p-3 bg-muted/30 rounded-lg border-l-4',
        importanceColors[content.importance || 'medium']
      )}
    >
      <p className="text-sm">{content.rule}</p>
    </div>
  );
}
