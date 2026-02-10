'use client';

import QRCode from 'react-qr-code';
import { Wifi } from 'lucide-react';

interface WifiQRCodeProps {
  ssid: string;
  qrString: string;
  size?: number;
  showLabel?: boolean;
  className?: string;
}

export function WifiQRCode({
  ssid,
  qrString,
  size = 128,
  showLabel = true,
  className = '',
}: WifiQRCodeProps) {
  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <div className="bg-white p-3 rounded-lg">
        <QRCode value={qrString} size={size} />
      </div>
      {showLabel && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Wifi className="h-4 w-4" />
          <span>Scan to connect to <strong>{ssid}</strong></span>
        </div>
      )}
    </div>
  );
}
