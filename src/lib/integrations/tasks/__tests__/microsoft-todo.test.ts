jest.mock('@/lib/householdTimezone', () => ({
  getHouseholdTimezone: jest.fn(async () => 'America/Chicago'),
}));

import { microsoftTodoProvider } from '../microsoft-todo';
import type { TaskProviderTokens } from '../types';

const TOKENS: TaskProviderTokens = {
  accessToken: 'test-access-token',
  refreshToken: 'test-refresh-token',
  expiresAt: new Date('2026-12-31'),
};

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

function jsonResponse(data: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  });
}

describe('microsoftTodoProvider', () => {
  it('has correct provider metadata', () => {
    expect(microsoftTodoProvider.providerId).toBe('microsoft_todo');
    expect(microsoftTodoProvider.displayName).toBe('Microsoft To-Do');
  });

  describe('fetchLists', () => {
    it('maps Graph task lists to ExternalTaskList', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({
        value: [
          { id: 'list-1', displayName: 'Tasks', isOwner: true, isShared: false, wellknownListName: 'defaultList' },
          { id: 'list-2', displayName: 'Work', isOwner: true, isShared: false },
        ],
      }));

      const lists = await microsoftTodoProvider.fetchLists(TOKENS);

      expect(lists).toEqual([
        { id: 'list-1', name: 'Tasks', isDefault: true },
        { id: 'list-2', name: 'Work', isDefault: false },
      ]);
    });
  });

  describe('fetchTasks', () => {
    it.each([
      // What the To Do apps write for a Chicago user: their midnight, in UTC.
      ['2026-09-28T05:00:00.0000000', 'UTC', '2026-09-28'],
      // A date-only value sent as UTC midnight keeps its date.
      ['2026-09-28T00:00:00.0000000', 'UTC', '2026-09-28'],
      ['2026-09-28T00:00:00.0000000', 'America/Chicago', '2026-09-28'],
      // A Windows zone name cannot be converted; the date is kept as written.
      ['2026-09-28T00:00:00.0000000', 'Central Standard Time', '2026-09-28'],
    ])('reads due %s %s as %s in the household zone', async (dateTime, timeZone, expected) => {
      mockFetch.mockReturnValueOnce(jsonResponse({
        value: [{
          id: 'task-1', title: 'T', status: 'notStarted', importance: 'normal',
          dueDateTime: { dateTime, timeZone },
          createdDateTime: '2026-09-01T00:00:00Z', lastModifiedDateTime: '2026-09-01T00:00:00Z',
        }],
      }));
      const [task] = await microsoftTodoProvider.fetchTasks(TOKENS, 'list-1');
      expect(task!.dueDate).toBe(expected);
    });

    it('parses Graph tasks with all fields', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({
        value: [
          {
            id: 'task-1',
            title: 'Buy groceries',
            body: { content: 'From the store', contentType: 'text' },
            dueDateTime: { dateTime: '2026-03-01T00:00:00', timeZone: 'UTC' },
            status: 'notStarted',
            importance: 'high',
            completedDateTime: undefined,
            createdDateTime: '2026-02-15T10:00:00Z',
            lastModifiedDateTime: '2026-02-16T08:00:00Z',
          },
        ],
      }));

      const tasks = await microsoftTodoProvider.fetchTasks(TOKENS, 'list-1');

      expect(tasks).toHaveLength(1);
      expect(tasks[0]).toEqual({
        id: 'task-1',
        listId: 'list-1',
        title: 'Buy groceries',
        description: 'From the store',
        dueDate: '2026-03-01',
        completed: false,
        completedAt: null,
        priority: 'high',
        updatedAt: new Date('2026-02-16T08:00:00Z'),
        createdAt: new Date('2026-02-15T10:00:00Z'),
      });
    });

    it('maps completed status correctly', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({
        value: [
          {
            id: 'task-2',
            title: 'Done task',
            status: 'completed',
            importance: 'normal',
            completedDateTime: { dateTime: '2026-02-16T14:00:00', timeZone: 'UTC' },
            createdDateTime: '2026-02-15T10:00:00Z',
            lastModifiedDateTime: '2026-02-16T14:00:00Z',
          },
        ],
      }));

      const tasks = await microsoftTodoProvider.fetchTasks(TOKENS, 'list-1');

      expect(tasks[0]!.completed).toBe(true);
      expect(tasks[0]!.completedAt).toEqual(new Date('2026-02-16T14:00:00'));
    });

    it('maps importance to priority correctly', async () => {
      const makeTask = (importance: string) => ({
        id: `task-${importance}`,
        title: `${importance} task`,
        status: 'notStarted',
        importance,
        createdDateTime: '2026-02-15T10:00:00Z',
        lastModifiedDateTime: '2026-02-16T08:00:00Z',
      });

      mockFetch.mockReturnValueOnce(jsonResponse({
        value: [makeTask('high'), makeTask('normal'), makeTask('low')],
      }));

      const tasks = await microsoftTodoProvider.fetchTasks(TOKENS, 'list-1');

      expect(tasks[0]!.priority).toBe('high');
      expect(tasks[1]!.priority).toBe('medium');
      expect(tasks[2]!.priority).toBe('low');
    });

    it('handles missing optional fields', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({
        value: [
          {
            id: 'task-3',
            title: 'Simple',
            status: 'notStarted',
            importance: 'normal',
            createdDateTime: '2026-02-15T10:00:00Z',
            lastModifiedDateTime: '2026-02-16T08:00:00Z',
          },
        ],
      }));

      const tasks = await microsoftTodoProvider.fetchTasks(TOKENS, 'list-1');

      expect(tasks[0]!.description).toBeNull();
      expect(tasks[0]!.dueDate).toBeNull();
      expect(tasks[0]!.completedAt).toBeNull();
    });
  });

  describe('createTask', () => {
    it('sends POST with all fields', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({
        id: 'new-1',
        title: 'New task',
        body: { content: 'Details', contentType: 'text' },
        dueDateTime: { dateTime: '2026-03-01T00:00:00.000Z', timeZone: 'UTC' },
        status: 'notStarted',
        importance: 'high',
        createdDateTime: '2026-02-16T10:00:00Z',
        lastModifiedDateTime: '2026-02-16T10:00:00Z',
      }));

      await microsoftTodoProvider.createTask(TOKENS, {
        listId: 'list-1',
        title: 'New task',
        description: 'Details',
        dueDate: '2026-03-01',
        priority: 'high',
      });

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.title).toBe('New task');
      expect(sentBody.body).toEqual({ content: 'Details', contentType: 'text' });
      // Midnight on the 1st in Chicago, sent the way the To Do apps send it.
      expect(sentBody.dueDateTime).toEqual({ dateTime: '2026-03-01T06:00:00', timeZone: 'UTC' });
      expect(sentBody.importance).toBe('high');
    });

    it('maps medium priority to normal importance', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({
        id: 'new-2',
        title: 'Task',
        status: 'notStarted',
        importance: 'normal',
        createdDateTime: '2026-02-16T10:00:00Z',
        lastModifiedDateTime: '2026-02-16T10:00:00Z',
      }));

      await microsoftTodoProvider.createTask(TOKENS, {
        listId: 'list-1',
        title: 'Task',
        priority: 'medium',
      });

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.importance).toBe('normal');
    });
  });

  describe('updateTask', () => {
    it('parses compound listId:taskId format', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({
        id: 'task-1',
        title: 'Updated',
        status: 'notStarted',
        importance: 'normal',
        createdDateTime: '2026-02-15T10:00:00Z',
        lastModifiedDateTime: '2026-02-16T12:00:00Z',
      }));

      await microsoftTodoProvider.updateTask(TOKENS, 'list-1:task-1', { title: 'Updated' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/me/todo/lists/list-1/tasks/task-1'),
        expect.objectContaining({ method: 'PATCH' })
      );
    });

    it('throws when taskId has no listId prefix', async () => {
      await expect(
        microsoftTodoProvider.updateTask(TOKENS, 'task-only', { title: 'X' })
      ).rejects.toThrow('Task ID must include list ID');
    });

    it('maps completed to status field', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({
        id: 'task-1',
        title: 'Task',
        status: 'completed',
        importance: 'normal',
        createdDateTime: '2026-02-15T10:00:00Z',
        lastModifiedDateTime: '2026-02-16T12:00:00Z',
      }));

      await microsoftTodoProvider.updateTask(TOKENS, 'list-1:task-1', { completed: true });

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.status).toBe('completed');
    });

    it('clears description by setting body to null', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({
        id: 'task-1',
        title: 'Task',
        status: 'notStarted',
        importance: 'normal',
        createdDateTime: '2026-02-15T10:00:00Z',
        lastModifiedDateTime: '2026-02-16T12:00:00Z',
      }));

      await microsoftTodoProvider.updateTask(TOKENS, 'list-1:task-1', { description: null });

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.body).toBeNull();
    });

    it('clears dueDate by setting dueDateTime to null', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({
        id: 'task-1',
        title: 'Task',
        status: 'notStarted',
        importance: 'normal',
        createdDateTime: '2026-02-15T10:00:00Z',
        lastModifiedDateTime: '2026-02-16T12:00:00Z',
      }));

      await microsoftTodoProvider.updateTask(TOKENS, 'list-1:task-1', { dueDate: null });

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.dueDateTime).toBeNull();
    });
  });

  describe('deleteTask', () => {
    it('sends DELETE with parsed listId:taskId', async () => {
      mockFetch.mockReturnValueOnce(Promise.resolve({
        ok: true,
        status: 204,
        json: () => Promise.resolve(undefined),
        text: () => Promise.resolve(''),
      }));

      await microsoftTodoProvider.deleteTask(TOKENS, 'list-1:task-1');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/me/todo/lists/list-1/tasks/task-1'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('throws when taskId has no listId prefix', async () => {
      await expect(
        microsoftTodoProvider.deleteTask(TOKENS, 'task-only')
      ).rejects.toThrow('Task ID must include list ID');
    });
  });

  describe('error handling', () => {
    it('throws on API error with status code', async () => {
      mockFetch.mockReturnValueOnce(Promise.resolve({
        ok: false,
        status: 403,
        text: () => Promise.resolve('Forbidden'),
      }));

      await expect(microsoftTodoProvider.fetchLists(TOKENS))
        .rejects.toThrow('Microsoft Graph API error: 403');
    });
  });

  describe('refreshTokens', () => {
    beforeEach(() => {
      process.env.MICROSOFT_CLIENT_ID = 'test-client-id';
      process.env.MICROSOFT_CLIENT_SECRET = 'test-client-secret';
    });

    afterEach(() => {
      delete process.env.MICROSOFT_CLIENT_ID;
      delete process.env.MICROSOFT_CLIENT_SECRET;
    });

    it('returns new tokens on success', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({
        access_token: 'new-access',
        refresh_token: 'new-refresh',
        expires_in: 3600,
      }));

      const result = await microsoftTodoProvider.refreshTokens!(TOKENS);

      expect(result).not.toBeNull();
      expect(result!.accessToken).toBe('new-access');
      expect(result!.refreshToken).toBe('new-refresh');
    });

    it('returns null when no refresh token', async () => {
      const result = await microsoftTodoProvider.refreshTokens!({
        accessToken: 'test',
      });
      expect(result).toBeNull();
    });

    it('returns null when credentials missing', async () => {
      delete process.env.MICROSOFT_CLIENT_ID;
      const result = await microsoftTodoProvider.refreshTokens!(TOKENS);
      expect(result).toBeNull();
    });
  });
});
