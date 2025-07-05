import { createContext, useContext, useState, ReactNode } from 'react';
import { Toast, showToast as showToastUtil, updateToast as updateToastUtil, dismissToast as dismissToastUtil } from '../components/Toast';

interface ToastContextType {
  toasts: Toast[];
  showToast: (
    type: Toast['type'],
    title: string,
    options?: {
      message?: string;
      hash?: string;
      duration?: number;
      action?: { label: string; onClick: () => void };
    }
  ) => string;
  updateToast: (id: string, updates: Partial<Omit<Toast, 'id'>>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast: ToastContextType['showToast'] = (type, title, options) => {
    return showToastUtil(setToasts, type, title, options);
  };

  const updateToast: ToastContextType['updateToast'] = (id, updates) => {
    updateToastUtil(setToasts, id, updates);
  };

  const removeToast: ToastContextType['removeToast'] = (id) => {
    dismissToastUtil(setToasts, id);
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