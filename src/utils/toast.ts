"use client";

import { toast } from "sonner";

// Global flag to suppress toasts, primarily for SheetReaderMode when UI is hidden
let globalSuppressToasts = false;

export const setGlobalSuppressToasts = (suppress: boolean) => {
  globalSuppressToasts = suppress;
};

export const showSuccess = (message: string) => {
  if (!globalSuppressToasts) {
    toast.success(message);
  }
};

export const showError = (message: string) => {
  if (!globalSuppressToasts) {
    toast.error(message);
  }
};

export const showLoading = (message: string) => {
  if (!globalSuppressToasts) {
    return toast.loading(message);
  }
  return undefined; // Return undefined if suppressed
};

export const dismissToast = (toastId: string) => {
  toast.dismiss(toastId);
};

export const showInfo = (message: string, options?: any) => {
  if (!globalSuppressToasts) {
    toast.info(message, options);
  }
};