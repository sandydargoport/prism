/**
 * @jest-environment jsdom
 */

/**
 * When the camera is refused, the scanner offers Try again, which starts it
 * again, instead of only Close (#852).
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

const mockStart = jest.fn();
const mockStop = jest.fn();
let mockState: 'idle' | 'error' = 'error';

jest.mock('@/lib/hooks/useCameraScanner', () => ({
  useCameraScanner: () => ({ state: mockState, errorMessage: 'Permission denied', start: mockStart, stop: mockStop }),
}));
jest.mock('@/lib/hooks/useStoredValue', () => ({ useHydrated: () => true }));
jest.mock('@/components/ui/use-toast', () => ({ toast: jest.fn() }));

import { CameraScannerOverlay } from '../CameraScannerOverlay';

beforeAll(() => {
  // The live scanner (not the photo fallback) needs BarcodeDetector.
  (window as unknown as { BarcodeDetector: unknown }).BarcodeDetector = class {};
});

describe('CameraScannerOverlay (#852)', () => {
  it('offers Try again on a camera error, which resets the scanner', () => {
    mockState = 'error';
    render(<CameraScannerOverlay onClose={jest.fn()} onScan={jest.fn()} />);
    expect(screen.getByText('Camera unavailable')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(mockStop).toHaveBeenCalled();
  });

  it('starts the camera whenever the scanner is idle, so a reset starts it again', () => {
    mockState = 'idle';
    mockStart.mockClear();
    render(<CameraScannerOverlay onClose={jest.fn()} onScan={jest.fn()} />);
    expect(mockStart).toHaveBeenCalled();
  });
});
