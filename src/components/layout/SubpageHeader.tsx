'use client';

import Link from 'next/link';
import { Home, MoreVertical } from 'lucide-react';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface OverflowItem {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  checked?: boolean;
  destructive?: boolean;
  disabled?: boolean;
  separator?: boolean;
}

export interface SubpageHeaderProps {
  icon: React.ReactNode;
  title: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  overflow?: OverflowItem[];
}

export function SubpageHeader({ icon, title, badge, actions, overflow }: SubpageHeaderProps) {
  const isMobile = useIsMobile();

  return (
    // Solid on a phone (#1028): see-through with a blur, the title looked fuzzy over a photo.
    <header className="shrink-0 border-b border-border bg-card px-4 safe-area-top md:bg-card/85 md:backdrop-blur-xs" data-subpage-header>
      {/* Tall enough on a phone for its 44px buttons to sit inside it (#1034). */}
      <div className={cn('flex items-center justify-between gap-2', isMobile ? 'h-14' : 'h-12 pointer-coarse:h-16')}>
        <div className="flex items-center gap-4 min-w-0">
          <Button variant="ghost" size="icon" asChild className="hidden md:inline-flex shrink-0">
            <Link href="/" aria-label="Back to dashboard">
              <Home className="h-5 w-5" />
            </Link>
          </Button>
          <div className="flex items-center gap-2 min-w-0">
            {!isMobile && icon && <span className="shrink-0 flex">{icon}</span>}
            {/* The page title in the display face (#923). */}
            <h1 className={cn('font-medium truncate', isMobile ? 'text-base' : 'text-title')} style={{ fontFamily: 'var(--font-display)' }}>{title}</h1>
            {badge}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {actions}
          {overflow && overflow.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="More options">
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {overflow.map((item, i) => {
                  const IconComp = item.icon;
                  if (item.separator && i > 0) {
                    return (
                      <div key={i}>
                        <DropdownMenuSeparator />
                        {item.checked !== undefined ? (
                          <DropdownMenuCheckboxItem
                            checked={item.checked}
                            onCheckedChange={() => item.onClick()}
                            disabled={item.disabled}
                          >
                            {IconComp && <IconComp className="h-4 w-4 mr-2" />}
                            {item.label}
                          </DropdownMenuCheckboxItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={item.onClick}
                            disabled={item.disabled}
                            className={item.destructive ? 'text-destructive focus:text-destructive' : undefined}
                          >
                            {IconComp && <IconComp className="h-4 w-4 mr-2" />}
                            {item.label}
                          </DropdownMenuItem>
                        )}
                      </div>
                    );
                  }
                  if (item.checked !== undefined) {
                    return (
                      <DropdownMenuCheckboxItem
                        key={i}
                        checked={item.checked}
                        onCheckedChange={() => item.onClick()}
                        disabled={item.disabled}
                      >
                        {IconComp && <IconComp className="h-4 w-4 mr-2" />}
                        {item.label}
                      </DropdownMenuCheckboxItem>
                    );
                  }
                  return (
                    <DropdownMenuItem
                      key={i}
                      onClick={item.onClick}
                      disabled={item.disabled}
                      className={item.destructive ? 'text-destructive focus:text-destructive' : undefined}
                    >
                      {IconComp && <IconComp className="h-4 w-4 mr-2" />}
                      {item.label}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
}
