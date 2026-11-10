/**
 * @jest-environment jsdom
 */
/**
 * Layout Export over http (#1147): with no clipboard the export used to throw
 * and say nothing. Now it saves a file instead.
 */
import { copyOrDownloadJson } from '../downloadJson';

const data = { version: 2, name: 'Kitchen', widgets: [] };

describe('copyOrDownloadJson', () => {
  const realClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  let clicked: string[];

  beforeEach(() => {
    clicked = [];
    (URL as unknown as { createObjectURL: () => string }).createObjectURL = () => 'blob:x';
    (URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = () => {};
    jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(this.download);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (realClipboard) Object.defineProperty(navigator, 'clipboard', realClipboard);
    else delete (navigator as unknown as { clipboard?: unknown }).clipboard;
  });

  it('copies when the page has a clipboard', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await expect(copyOrDownloadJson('prism-layout-kitchen.json', data)).resolves.toBe('copied');
    expect(JSON.parse(writeText.mock.calls[0][0])).toEqual(data);
    expect(clicked).toEqual([]);
  });

  it('saves a file when there is no clipboard, as over http', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    await expect(copyOrDownloadJson('prism-layout-kitchen.json', data)).resolves.toBe('downloaded');
    expect(clicked).toEqual(['prism-layout-kitchen.json']);
  });

  it('saves a file when copying is refused', async () => {
    const writeText = jest.fn().mockRejectedValue(new Error('denied'));
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await expect(copyOrDownloadJson('prism-layout-kitchen.json', data)).resolves.toBe('downloaded');
    expect(clicked).toEqual(['prism-layout-kitchen.json']);
  });
});

describe('layout Export (#1147)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { renderHook, act } = require('@testing-library/react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useLayoutEditorState } = require('@/components/layout/useLayoutEditorState');

  it('saves the layout as a file when the page has no clipboard, and says so', async () => {
    const clicked: string[] = [];
    (URL as unknown as { createObjectURL: () => string }).createObjectURL = () => 'blob:x';
    (URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = () => {};
    jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(this.download);
    });
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    const widgets = [{ i: 'clock', x: 0, y: 0, w: 12, h: 5 }];
    const { result } = renderHook(() => useLayoutEditorState({
      editingScreensaver: false, layoutName: 'Kitchen', currentWidgets: widgets, visibleWidgets: widgets,
      onWidgetsChange: () => {}, onSave: () => {}, onSaveAs: () => {}, allDashboards: [],
      confirmDelete: async () => true, setActivePopover: () => {},
    }));
    await act(async () => {
      result.current.handleExport();
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(clicked).toEqual(['prism-layout-kitchen.json']);
    expect(result.current.exportFeedback).toBe('Saved');
    jest.restoreAllMocks();
  });
});
