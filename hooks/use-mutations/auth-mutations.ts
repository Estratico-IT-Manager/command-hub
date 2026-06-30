'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { toastDefault, toastSuccess, toastError } from '@/hooks/use-toast'
import { signIn, signUp, signOut } from '@/lib/auth-client'

export function useLogin() {
  const router = useRouter()

  return useMutation({
    mutationFn: async (data: {
      email: string
      password: string
      callbackURL: string
    }) => {
      const result = await signIn.email({
        email: data.email,
        password: data.password,
        callbackURL: data.callbackURL,
      })

      if (result.error) {
        throw new Error(result.error.message || 'Invalid email or password')
      }

      return result
    },
    onMutate: () => {
      toastDefault('Signing in...')
    },
    onSuccess: () => {
      toastSuccess('Welcome back!')
      router.push('/dashboard')
    },
    onError: (error: Error) => {
      toastError(`Login failed: ${error.message}`)
    },
  })
}

export function useRegister() {
  const router = useRouter()

  return useMutation({
    mutationFn: async (data: {
      name: string
      email: string
      password: string
    }) => {
      const result = await signUp.email({
        email: data.email,
        password: data.password,
        name: data.name,
      })

      if (result.error) {
        throw new Error(result.error.message || 'Failed to create account')
      }

      return result
    },
    onMutate: () => {
      toastDefault('Creating account...')
    },
    onSuccess: () => {
      toastSuccess('Account created successfully')
      router.push('/dashboard')
    },
    onError: (error: Error) => {
      toastError(`Registration failed: ${error.message}`)
    },
  })
}

export function useSignOut() {
  const router = useRouter()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      await signOut()
    },
    onSuccess: () => {
      queryClient.clear()
      router.push('/login')
    },
    onError: (error: Error) => {
      toastError(`Sign out failed: ${error.message}`)
    },
  })
}
