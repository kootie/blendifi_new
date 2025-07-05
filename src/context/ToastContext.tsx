import { createContext, useContext, useState, ReactNode } from 'react';
import { Toast, showToast as createToast, updateToast as updateToastState, removeToast as removeToastState } from '../components/Toast';

interface ToastContextType {
  toasts: Toast[];
  showToast: (type: Toast['type'], title: string, message?: string, hash?: string, duration?: number) => string;
  updateToast: (id: string, updates: Partial<Toast>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = (
    type: Toast['type'],
    title: string,
    message?: string,
    hash?: string,
    duration?: number
  ): string => {
    return createToast(setToasts, type, title, message, hash, duration);
  };

  const updateToast = (id: string, updates: Partial<Toast>) => {
    updateToastState(setToasts, id, updates);
  };

  const removeToast = (id: string) => {
    removeToastState(setToasts, id);
  };

  return (
    <ToastContext.Provider value={{ toasts, showToast, updateToast, removeToast }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
} 