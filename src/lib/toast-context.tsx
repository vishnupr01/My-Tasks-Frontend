'use client';

import { createContext, useContext, useCallback, useState, type ReactNode } from 'react';

export interface ToastItem {
  id: string;
  title: string;
  body: string;
  href: string;
}

interface ToastContextValue {
  toasts: ToastItem[];
  showToast: (toast: Omit<ToastItem, 'id'>) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue>({
  toasts: [],
  showToast: () => {},
  dismissToast: () => {},
});

const AUTO_DISMISS_MS = 5000;
const MAX_VISIBLE = 4;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback((toast: Omit<ToastItem, 'id'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts(prev => [...prev.slice(-(MAX_VISIBLE - 1)), { ...toast, id }]);
    setTimeout(() => dismissToast(id), AUTO_DISMISS_MS);
  }, [dismissToast]);

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
