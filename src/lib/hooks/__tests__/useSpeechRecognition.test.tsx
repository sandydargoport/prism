/**
 * @jest-environment jsdom
 */

/**
 * The microphone on the on-screen keyboard must say why it did not work,
 * not just do nothing: an http:// page, dictation switched off, or any other
 * error the browser reports.
 */

import { renderHook, act } from '@testing-library/react';

const toast = jest.fn();
jest.mock('@/components/ui/use-toast', () => ({ toast: (...a: unknown[]) => toast(...a) }));

import { useSpeechRecognition } from '../useSpeechRecognition';

type FakeRec = { start: jest.Mock; stop: jest.Mock; onerror?: (e: { error: string }) => void };
let lastRec: FakeRec;

function installRecognizer() {
  (window as unknown as Record<string, unknown>).webkitSpeechRecognition = jest.fn(() => {
    lastRec = { start: jest.fn(), stop: jest.fn() };
    return lastRec;
  });
}

function setSecure(value: boolean) {
  Object.defineProperty(window, 'isSecureContext', { value, configurable: true });
}

describe('useSpeechRecognition', () => {
  beforeEach(() => {
    toast.mockReset();
    installRecognizer();
    setSecure(true);
  });

  it('explains that an http:// page cannot use the microphone', () => {
    setSecure(false);
    const { result } = renderHook(() => useSpeechRecognition(() => {}));
    act(() => result.current.start());
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: expect.stringMatching(/https/) }));
    expect(result.current.isListening).toBe(false);
  });

  it('names Siri & Dictation when Safari refuses the service', () => {
    const { result } = renderHook(() => useSpeechRecognition(() => {}));
    act(() => result.current.start());
    act(() => lastRec.onerror?.({ error: 'service-not-allowed' }));
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: expect.stringMatching(/Dictation/) }));
  });

  it('says something for an error it has no message for', () => {
    const { result } = renderHook(() => useSpeechRecognition(() => {}));
    act(() => result.current.start());
    act(() => lastRec.onerror?.({ error: 'language-not-supported' }));
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: expect.stringMatching(/language-not-supported/) }));
  });

  it('stays quiet when listening is stopped on purpose', () => {
    const { result } = renderHook(() => useSpeechRecognition(() => {}));
    act(() => result.current.start());
    act(() => lastRec.onerror?.({ error: 'aborted' }));
    expect(toast).not.toHaveBeenCalled();
  });
});
