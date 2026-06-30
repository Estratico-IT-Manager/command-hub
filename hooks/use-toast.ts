'use client'

import { toast as sonnerToast, type ExternalToast } from 'sonner'

type ToastOptions = ExternalToast

type PromiseToastOptions<T> = Omit<ExternalToast, 'description'> & {
  loading?: string | React.ReactNode
  success?: string | React.ReactNode | ((data: T) => React.ReactNode | string | Promise<React.ReactNode | string>)
  error?: string | React.ReactNode | ((error: unknown) => React.ReactNode | string | Promise<React.ReactNode | string>)
  description?: string | React.ReactNode | ((data: T) => React.ReactNode | string | Promise<React.ReactNode | string>)
  finally?: () => void | Promise<void>
}

function toastDefault(message: string, options?: ToastOptions) {
  return sonnerToast(message, options)
}

function toastSuccess(message: string, options?: ToastOptions) {
  return sonnerToast.success(message, options)
}

function toastInfo(message: string, options?: ToastOptions) {
  return sonnerToast.info(message, options)
}

function toastWarning(message: string, options?: ToastOptions) {
  return sonnerToast.warning(message, options)
}

function toastError(message: string, options?: ToastOptions) {
  return sonnerToast.error(message, options)
}

function toastPromise<T>(promise: Promise<T> | (() => Promise<T>), options: PromiseToastOptions<T>) {
  return sonnerToast.promise(promise, options)
}

function toastLoading(message: string, options?: ToastOptions) {
  return sonnerToast.loading(message, options)
}

function dismiss(toastId?: string | number) {
  return sonnerToast.dismiss(toastId)
}

export {
  toastDefault,
  toastSuccess,
  toastInfo,
  toastWarning,
  toastError,
  toastPromise,
  toastLoading,
  dismiss,
  sonnerToast as toast,
}
