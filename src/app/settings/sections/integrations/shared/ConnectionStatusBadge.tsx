'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';

export type ConnectionStatus =
  | 'connected'
  | 'expired'
  | 'disconnected'
  | 'alpha';

interface Props {
  status: ConnectionStatus;
  className?: string;
}

const LABEL: Record<ConnectionStatus, string> = {
  connected: 'Connected',
  expired: 'Reconnect needed',
  disconnected: 'Not connected',
  alpha: 'Alpha',
};

const VARIANT: Record<ConnectionStatus, 'success' | 'warning' | 'outline' | 'secondary'> = {
  connected: 'success',
  expired: 'warning',
  disconnected: 'outline',
  alpha: 'secondary',
};

export function ConnectionStatusBadge({ status, className }: Props) {
  return (
    <Badge variant={VARIANT[status]} className={className}>
      {LABEL[status]}
    </Badge>
  );
}
