'use client';

import { useState, useEffect, useCallback } from 'react';
import { ClipboardList, Filter, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { UserAvatar } from '@/components/ui/avatar';
import { useFamily } from '@/components/providers';
import { cn } from '@/lib/utils';

interface AuditLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  userId: string | null;
  userName: string | null;
  userColor: string | null;
  userAvatarUrl: string | null;
}

const ENTITY_TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'task', label: 'Tasks' },
  { value: 'chore', label: 'Chores' },
  { value: 'shopping_item', label: 'Shopping' },
  { value: 'meal', label: 'Meals' },
  { value: 'event', label: 'Events' },
  { value: 'message', label: 'Messages' },
  { value: 'user', label: 'Members' },
  { value: 'wish_item', label: 'Wish List' },
  { value: 'setting', label: 'Settings' },
  { value: 'session', label: 'Login/Logout' },
  { value: 'integration', label: 'Integrations' },
];

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-success/15 text-success',
  update: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  complete: 'bg-success/15 text-success',
  delete: 'bg-destructive/15 text-destructive',
  login: 'bg-warning/15 text-warning',
  logout: 'bg-warning/15 text-warning',
  toggle: 'bg-purple-500/15 text-purple-700 dark:text-purple-400',
};

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export function ActivityLogSection() {
  const { members } = useFamily();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [entityTypeFilter, setEntityTypeFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');

  const fetchLogs = useCallback(async (pageNum: number, append: boolean) => {
    if (append) setLoadingMore(true); else setLoading(true);

    try {
      const params = new URLSearchParams({ page: String(pageNum), limit: '50' });
      if (entityTypeFilter) params.set('entityType', entityTypeFilter);
      if (userFilter) params.set('userId', userFilter);

      const res = await fetch(`/api/audit-logs?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');

      const data = await res.json();
      setTotal(data.total);

      if (append) {
        setLogs((prev) => [...prev, ...data.logs]);
      } else {
        setLogs(data.logs);
      }
    } catch (err) {
      console.error('Failed to load activity logs:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [entityTypeFilter, userFilter]);

  // Reset and fetch when filters change
  useEffect(() => {
    setPage(1);
    fetchLogs(1, false);
  }, [fetchLogs]);

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchLogs(nextPage, true);
  };

  const hasMore = logs.length < total;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <ClipboardList className="h-6 w-6" />
          Activity Log
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          30-day history of all actions taken in Prism
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              value={entityTypeFilter}
              onChange={(e) => setEntityTypeFilter(e.target.value)}
              className="bg-background border border-border rounded-md px-3 py-1.5 text-sm"
            >
              {ENTITY_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <select
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="bg-background border border-border rounded-md px-3 py-1.5 text-sm"
            >
              <option value="">All members</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Log entries */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ClipboardList className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>No activity recorded yet</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {logs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 p-4">
                  <UserAvatar
                    name={log.userName || 'System'}
                    color={log.userColor || '#888'}
                    imageUrl={log.userAvatarUrl ?? undefined}
                    size="sm"
                    className="h-8 w-8 flex-shrink-0 mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">
                        {log.userName || 'System'}
                      </span>
                      <span
                        className={cn(
                          'px-1.5 py-0.5 rounded text-xs font-medium',
                          ACTION_COLORS[log.action] || 'bg-muted text-muted-foreground'
                        )}
                      >
                        {log.action}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5 truncate">
                      {log.summary}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                    {relativeTime(log.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Load more */}
      {hasMore && !loading && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={loadMore}
            disabled={loadingMore}
          >
            {loadingMore ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Loading...
              </>
            ) : (
              `Load more (${logs.length} of ${total})`
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
