'use client';

import { useState, useCallback, useEffect } from 'react';

export interface WifiConfig {
  ssid: string;
  password: string;
  securityType: 'WPA' | 'WEP' | 'nopass';
  hidden: boolean;
}

const DEFAULT_CONFIG: WifiConfig = {
  ssid: '',
  password: '',
  securityType: 'WPA',
  hidden: false,
};

export function useWifiConfig() {
  const [config, setConfig] = useState<WifiConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/settings/wifi');
      if (res.ok) {
        const data = await res.json();
        if (data.config) {
          setConfig(data.config);
        }
      }
    } catch (err) {
      console.error('Error fetching WiFi config:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const saveConfig = useCallback(async (newConfig: WifiConfig): Promise<{ success: boolean; error?: string }> => {
    try {
      setSaving(true);
      setError(null);

      const res = await fetch('/api/settings/wifi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save WiFi config');
      }

      setConfig(newConfig);
      return { success: true };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to save';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setSaving(false);
    }
  }, []);

  // Generate WiFi QR code string
  const qrString = config.ssid
    ? `WIFI:T:${config.securityType};S:${escapeWifiString(config.ssid)};P:${escapeWifiString(config.password)};H:${config.hidden ? 'true' : 'false'};;`
    : null;

  return {
    config,
    loading,
    saving,
    error,
    saveConfig,
    qrString,
    hasConfig: !!config.ssid,
  };
}

// Escape special characters in WiFi QR strings
function escapeWifiString(str: string): string {
  return str.replace(/([\\;,:"'])/g, '\\$1');
}
