import { Page } from '@playwright/test';

/**
 * Delete a task by its title via API lookup.
 * Returns true if found and deleted, false if not found.
 */
export async function deleteTaskByTitle(page: Page, title: string): Promise<boolean> {
  const res = await page.request.get('/api/tasks');
  if (!res.ok()) return false;
  const data = await res.json();
  const tasks = data.tasks || data || [];
  const match = tasks.find((t: { title: string }) => t.title === title);
  if (!match) return false;
  const delRes = await page.request.delete(`/api/tasks/${match.id}`);
  return delRes.ok();
}

/**
 * Delete an event by its title via API lookup.
 * Searches in a broad date range around the current date.
 */
export async function deleteEventByTitle(page: Page, title: string): Promise<boolean> {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
  const endDate = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString().split('T')[0];
  const res = await page.request.get(`/api/events?startDate=${startDate}&endDate=${endDate}`);
  if (!res.ok()) return false;
  const data = await res.json();
  const events = data.events || data || [];
  const match = events.find((e: { title: string }) => e.title === title);
  if (!match) return false;
  const delRes = await page.request.delete(`/api/events/${match.id}`);
  return delRes.ok();
}

/**
 * Delete a message by matching its content substring.
 */
export async function deleteMessageByContent(page: Page, content: string): Promise<boolean> {
  const res = await page.request.get('/api/messages');
  if (!res.ok()) return false;
  const data = await res.json();
  const messages = data.messages || data || [];
  const match = messages.find((m: { message: string }) => m.message?.includes(content));
  if (!match) return false;
  const delRes = await page.request.delete(`/api/messages/${match.id}`);
  return delRes.ok();
}

/**
 * Delete a shopping list by ID.
 * Also cascades to delete all items in the list.
 */
export async function deleteShoppingList(page: Page, id: string): Promise<boolean> {
  const delRes = await page.request.delete(`/api/shopping-lists/${id}`);
  return delRes.ok();
}

/**
 * Delete all chores matching a title via API lookup.
 */
export async function deleteChoreByTitle(page: Page, title: string): Promise<boolean> {
  const res = await page.request.get('/api/chores');
  if (!res.ok()) return false;
  const data = await res.json();
  const chores = data.chores || data || [];
  const matches = chores.filter((c: { title: string }) => c.title === title);
  if (matches.length === 0) return false;
  const results = await Promise.all(
    matches.map((c: { id: string }) => page.request.delete(`/api/chores/${c.id}`))
  );
  return results.every(r => r.ok());
}

/**
 * Delete a shopping item by ID.
 */
export async function deleteShoppingItem(page: Page, id: string): Promise<boolean> {
  const delRes = await page.request.delete(`/api/shopping-items/${id}`);
  return delRes.ok();
}

/**
 * Remove a dashboard a test made. Today is built in and the API refuses to
 * delete it (#1151), so a test's own Today is turned back into a plain
 * dashboard first.
 */
export async function deleteLayout(page: Page, id: string): Promise<void> {
  await page.request.patch(`/api/layouts/${id}`, { data: { view: 'grid' } });
  await page.request.delete(`/api/layouts/${id}`);
}
