/**
 * Accessibility utilities for WCAG 2.1 AA compliance
 */

/**
 * Check if color contrast meets WCAG AA standards
 * @param foreground - RGB color string (e.g., "#000000")
 * @param background - RGB color string (e.g., "#ffffff")
 * @returns contrast ratio, true if meets AA standard (4.5:1 for normal text)
 */
export const getContrastRatio = (foreground: string, background: string): number => {
  const getLuminance = (hexColor: string) => {
    const rgb = parseInt(hexColor.slice(1), 16);
    const r = (rgb >> 16) & 0xff;
    const g = (rgb >> 8) & 0xff;
    const b = (rgb >> 0) & 0xff;

    const [rs, gs, bs] = [r, g, b].map(x => {
      x = x / 255;
      return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    });

    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  };

  const l1 = getLuminance(foreground);
  const l2 = getLuminance(background);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
};

/**
 * Check if contrast meets WCAG standards
 * @param ratio - contrast ratio
 * @param level - 'AA' (4.5:1) or 'AAA' (7:1)
 * @param largeText - whether text is >= 14pt and bold or >= 18pt
 */
export const meetsContrastStandard = (
  ratio: number,
  level: 'AA' | 'AAA' = 'AA',
  largeText = false
): boolean => {
  if (level === 'AAA') {
    return largeText ? ratio >= 4.5 : ratio >= 7;
  }
  return largeText ? ratio >= 3 : ratio >= 4.5;
};

/**
 * ARIA labels and roles for common components
 */
export const AriaRoles = {
  Button: 'button',
  Navigation: 'navigation',
  Search: 'search',
  Main: 'main',
  Complementary: 'complementary',
  Region: 'region',
  Alert: 'alert',
  Dialog: 'dialog',
  Menu: 'menu',
  Menuitem: 'menuitem',
  Listbox: 'listbox',
  Option: 'option',
  Tablist: 'tablist',
  Tab: 'tab',
  Tabpanel: 'tabpanel',
} as const;

/**
 * Generate accessible label for form inputs
 */
export const getAriaLabel = (label: string, required = false, description?: string): string => {
  let result = label;
  if (required) result += ', required';
  if (description) result += `. ${description}`;
  return result;
};

/**
 * Skip to main content link for keyboard users (typically hidden)
 */
export const skipToMainContent = (mainElementId = 'main-content') => {
  const focusMainContent = () => {
    const main = document.getElementById(mainElementId);
    if (main) {
      main.tabIndex = -1;
      main.focus();
    }
  };
  return focusMainContent;
};

/**
 * Keyboard event helpers
 */
export const isEnterKey = (e: React.KeyboardEvent) => e.key === 'Enter' || e.code === 'Enter';
export const isSpaceKey = (e: React.KeyboardEvent) => e.key === ' ' || e.code === 'Space';
export const isEscapeKey = (e: React.KeyboardEvent) => e.key === 'Escape' || e.code === 'Escape';
export const isArrowUp = (e: React.KeyboardEvent) => e.key === 'ArrowUp' || e.code === 'ArrowUp';
export const isArrowDown = (e: React.KeyboardEvent) => e.key === 'ArrowDown' || e.code === 'ArrowDown';
export const isArrowLeft = (e: React.KeyboardEvent) => e.key === 'ArrowLeft' || e.code === 'ArrowLeft';
export const isArrowRight = (e: React.KeyboardEvent) => e.key === 'ArrowRight' || e.code === 'ArrowRight';
export const isTabKey = (e: React.KeyboardEvent) => e.key === 'Tab' || e.code === 'Tab';

/**
 * FocusManager - Handle focus trap and restoration
 */
export class FocusManager {
  private previouslyFocused: HTMLElement | null = null;
  private focusableSelectors = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',');

  /**
   * Save currently focused element
   */
  saveFocus() {
    this.previouslyFocused = document.activeElement as HTMLElement;
  }

  /**
   * Restore focus to previously focused element
   */
  restoreFocus() {
    this.previouslyFocused?.focus();
  }

  /**
   * Get all focusable elements within a container
   */
  getFocusableElements(container: HTMLElement): HTMLElement[] {
    return Array.from(container.querySelectorAll(this.focusableSelectors)) as HTMLElement[];
  }

  /**
   * Trap focus within a container (useful for modals)
   */
  trapFocus(container: HTMLElement, e: KeyboardEvent) {
    if (e.key !== 'Tab') return;

    const focusableElements = this.getFocusableElements(container);
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    const activeElement = document.activeElement;

    if (e.shiftKey) {
      // Shift + Tab
      if (activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      }
    } else {
      // Tab
      if (activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  }
}

/**
 * Announce messages to screen readers
 */
export const announce = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.style.position = 'absolute';
  announcement.style.left = '-10000px';
  announcement.style.width = '1px';
  announcement.style.height = '1px';
  announcement.style.overflow = 'hidden';
  announcement.textContent = message;

  document.body.appendChild(announcement);

  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
};

/**
 * Generate unique IDs (useful for aria-labelledby, aria-describedby)
 */
let idCounter = 0;
export const generateId = (prefix = 'id') => `${prefix}-${++idCounter}`;

/**
 * Accessibility-aware focus style constant
 */
export const A11Y_FOCUS_STYLE = {
  outline: '2px solid #2563eb',
  outlineOffset: '2px',
};

/**
 * Check if element is visible to accessibility tree
 */
export const isAccessibilityVisible = (element: HTMLElement): boolean => {
  const style = window.getComputedStyle(element);

  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.visibility !== 'collapse' &&
    element.getAttribute('aria-hidden') !== 'true'
  );
};
