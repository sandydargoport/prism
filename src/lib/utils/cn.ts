/**
 *
 * Provides a utility function for conditionally joining class names together.
 * This is essential for building dynamic Tailwind CSS classes.
 *
 * WHY WE NEED THIS:
 * When using Tailwind CSS, you often need to:
 * 1. Combine multiple class strings
 * 2. Conditionally apply classes
 * 3. Handle conflicting classes (e.g., both "p-2" and "p-4")
 *
 * WITHOUT cn():
 *   <div className={`p-4 ${isLarge ? 'text-xl' : 'text-base'} ${error ? 'border-red-500' : ''}`}>
 *
 * WITH cn():
 *   <div className={cn('p-4', isLarge ? 'text-xl' : 'text-base', error && 'border-red-500')}>
 *
 * LIBRARIES USED:
 * - clsx: Conditionally joins classNames (handles arrays, objects, conditions)
 * - tailwind-merge: Intelligently merges Tailwind classes (handles conflicts)
 *
 * EXAMPLES:
 *
 *   // Basic usage - combine strings
 *   cn('p-4', 'bg-white') // => "p-4 bg-white"
 *
 *   // Conditional classes
 *   cn('btn', isActive && 'btn-active') // => "btn" or "btn btn-active"
 *
 *   // Ternary expressions
 *   cn('text-base', size === 'large' ? 'p-4' : 'p-2')
 *
 *   // Conflict resolution (tailwind-merge)
 *   cn('p-2', 'p-4') // => "p-4" (not "p-2 p-4")
 *   cn('text-red-500', 'text-blue-500') // => "text-blue-500"
 *
 *   // Objects (like clsx)
 *   cn({ 'font-bold': isBold, 'text-xl': isLarge })
 *
 *   // Arrays
 *   cn(['p-4', 'bg-white'], isActive && 'ring-2')
 *
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';


/**
 * Combines class names with intelligent Tailwind CSS merging.
 *
 * @param inputs - Class names, conditions, objects, or arrays of class names
 * @returns A single merged class name string
 *
 * @example
 * // Basic combination
 * cn('p-4', 'bg-white', 'rounded-lg')
 * // => "p-4 bg-white rounded-lg"
 *
 * @example
 * // Conditional classes
 * cn('btn', isLoading && 'opacity-50', isDisabled && 'cursor-not-allowed')
 * // => "btn opacity-50" (if isLoading is true)
 *
 * @example
 * // Conflict resolution (later values win)
 * cn('text-sm', 'p-2', variant === 'large' && 'text-lg p-4')
 * // => "text-lg p-4" (if variant is 'large')
 *
 * @example
 * // Object syntax
 * cn('base-class', {
 *   'text-green-500': status === 'success',
 *   'text-red-500': status === 'error',
 *   'text-yellow-500': status === 'warning',
 * })
 */
export function cn(...inputs: ClassValue[]): string {
  // clsx: Combines inputs, handles conditions, objects, arrays
  // twMerge: Resolves Tailwind conflicts (later values override earlier)
  return twMerge(clsx(inputs));
}


/**
 * UNDERSTANDING THE LIBRARIES
 *
 * CLSX:
 * A tiny utility for constructing className strings conditionally.
 *
 * clsx accepts:
 * - Strings: 'foo' => 'foo'
 * - Objects: { foo: true, bar: false } => 'foo'
 * - Arrays: ['foo', 'bar'] => 'foo bar'
 * - Falsy values are ignored: false, null, undefined, 0, '' => ''
 *
 * TAILWIND-MERGE:
 * Merges Tailwind CSS classes without conflicts.
 *
 * Without tailwind-merge:
 *   'p-2 p-4' => 'p-2 p-4' (browser applies both, unpredictable)
 *
 * With tailwind-merge:
 *   'p-2 p-4' => 'p-4' (later value wins)
 *
 * It understands Tailwind's class groups:
 * - 'px-2 py-4 p-6' => 'p-6' (p-6 overrides both px and py)
 * - 'text-red-500 text-blue-500' => 'text-blue-500'
 * - 'hover:bg-red-500 hover:bg-blue-500' => 'hover:bg-blue-500'
 *
 */
