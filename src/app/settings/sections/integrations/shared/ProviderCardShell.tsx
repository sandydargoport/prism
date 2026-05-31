'use client';

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ConnectionStatusBadge, type ConnectionStatus } from './ConnectionStatusBadge';

interface Props {
  /** Hash anchor used by useIntegrationsHashRouter (e.g. 'microsoft'). */
  id: string;
  /** Provider name shown in the card header (e.g. 'Microsoft'). */
  name: string;
  /** Provider brand icon. Rendered at h-6 w-6. */
  icon: React.ReactNode;
  status: ConnectionStatus;
  /** Optional secondary description under the name. */
  description?: React.ReactNode;
  /** Primary connect/disconnect/reauth button. */
  primaryAction?: React.ReactNode;
  /** Collapsible sub-sections rendered below the header. */
  children?: React.ReactNode;
}

export function ProviderCardShell({
  id,
  name,
  icon,
  status,
  description,
  primaryAction,
  children,
}: Props) {
  return (
    <Card id={id} className="scroll-mt-20 overflow-hidden">
      <CardContent className="p-0">
        <div className="flex items-start gap-3 p-4">
          <div className="flex-shrink-0 mt-0.5">{icon}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-base">{name}</h3>
              <ConnectionStatusBadge status={status} />
            </div>
            {description && (
              <p className="text-sm text-muted-foreground mt-1">{description}</p>
            )}
          </div>
          {primaryAction && <div className="flex-shrink-0">{primaryAction}</div>}
        </div>
        {children && <div>{children}</div>}
      </CardContent>
    </Card>
  );
}
