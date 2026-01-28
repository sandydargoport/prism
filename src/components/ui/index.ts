/**
 * ============================================================================
 * PRISM - UI Components Index
 * ============================================================================
 *
 * WHAT THIS FILE DOES:
 * Re-exports all UI components from a single entry point.
 * This makes imports cleaner throughout the application.
 *
 * INSTEAD OF:
 *   import { Button } from '@/components/ui/button';
 *   import { Card, CardContent } from '@/components/ui/card';
 *   import { Input } from '@/components/ui/input';
 *
 * YOU CAN WRITE:
 *   import { Button, Card, CardContent, Input } from '@/components/ui';
 *
 * ============================================================================
 */

// Button
export { Button, buttonVariants } from './button';
export type { ButtonProps } from './button';

// Card
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from './card';

// Input
export { Input } from './input';
export type { InputProps } from './input';

// Badge
export { Badge, badgeVariants } from './badge';
export type { BadgeProps } from './badge';

// Avatar
export {
  Avatar,
  AvatarImage,
  AvatarFallback,
  UserAvatar,
  getInitials,
} from './avatar';

// Checkbox
export { Checkbox } from './checkbox';

// Scroll Area
export { ScrollArea, ScrollBar } from './scroll-area';

// Dialog
export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from './dialog';

// Select
export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
} from './select';

// Label
export { Label } from './label';

// Textarea
export { Textarea } from './textarea';
export type { TextareaProps } from './textarea';

// Switch
export { Switch } from './switch';

// Progress
export { Progress } from './progress';

// Dropdown Menu
export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
} from './dropdown-menu';
