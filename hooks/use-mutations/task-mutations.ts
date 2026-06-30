'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { toastDefault, toastSuccess, toastError } from '@/hooks/use-toast'
import { offlineDb, generateOfflineId } from '@/lib/offline-db'
import { syncEngine } from '@/lib/sync-engine'

export function useCreateTask(projectId: string) {
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation({
    mutationFn: async (data: {
      title: string
      description: string
      status: string
      priority: string
      assignedTo: string
      dueDate: string
    }) => {
      const taskId = generateOfflineId()
      const now = new Date().toISOString()

      const existingTasks = await offlineDb.tasks
        .where('projectId')
        .equals(projectId)
        .and((t) => t.status === data.status)
        .toArray()

      const maxPosition = existingTasks.reduce(
        (max, t) => Math.max(max, t.position),
        0
      )
      const position = maxPosition + 1000
      const assignee = data.assignedTo === 'u' ? '' : data.assignedTo

      await offlineDb.tasks.add({
        id: taskId,
        projectId,
        title: data.title,
        description: data.description || '',
        status: data.status as any,
        priority: data.priority as any,
        assignedTo: assignee,
        dueDate: data.dueDate,
        position,
        createdBy: '',
        createdAt: now,
        updatedAt: now,
        synced: false,
        pendingSync: true,
        isDeleted: false,
      })

      // Optimistic update: add task to query cache with pendingSync
      queryClient.setQueryData(['project', projectId], (old: any) => {
        if (!old) return old
        return {
          ...old,
          tasks: [
            ...old.tasks,
            {
              id: taskId,
              projectId,
              title: data.title,
              description: data.description || '',
              status: data.status,
              priority: data.priority,
              assignedTo: assignee,
              assigned_to_name: null,
              dueDate: data.dueDate,
              position,
              createdBy: '',
              createdAt: now,
              updatedAt: now,
              synced: false,
              pendingSync: true,
              isDeleted: false,
            }
          ]
        }
      })

      if (syncEngine) {
        await syncEngine.queueChange({
          tableName: 'task',
          recordId: taskId,
          action: 'create',
          queryKey: ['project', projectId],
          payload: {
            projectId,
            title: data.title,
            description: data.description || null,
            status: data.status,
            priority: data.priority,
            assignedTo: assignee || null,
            dueDate: data.dueDate || null,
            position,
          },
        })
      }

      return { taskId }
    },
    onMutate: () => {
      toastDefault('Creating task...')
    },
    onSuccess: () => {
      toastSuccess('Task created successfully')
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      router.refresh()
    },
    onError: (error: Error) => {
      toastError(`Failed to create task: ${error.message}`)
    },
  })
}

export function useUpdateTask(projectId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: {
      taskId: string
      title: string
      description: string
      status: string
      priority: string
      assignedTo: string
      dueDate: string
      position: number
    }) => {
      await offlineDb.tasks.update(data.taskId, {
        status: data.status as any,
        position: data.position,
        updatedAt: new Date().toISOString(),
        pendingSync: true,
      })

      // Optimistic update: mark task as pendingSync in query cache
      queryClient.setQueryData(['project', projectId], (old: any) => {
        if (!old) return old
        return {
          ...old,
          tasks: old.tasks.map((t: any) =>
            t.id === data.taskId
              ? { ...t, status: data.status, position: data.position, pendingSync: true }
              : t
          )
        }
      })

      if (syncEngine) {
        await syncEngine.queueChange({
          tableName: 'task',
          recordId: data.taskId,
          action: 'update',
          queryKey: ['project', projectId],
          payload: {
            ...data,
            status: data.status,
            position: data.position,
          },
        })
      }

      return { taskId: data.taskId }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (error: Error) => {
      toastError(`Failed to update task: ${error.message}`)
    },
  })
}
