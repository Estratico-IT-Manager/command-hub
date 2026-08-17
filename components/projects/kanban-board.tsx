'use client'

import { useState, useCallback } from 'react'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Empty } from '@/components/ui/empty'
import { CalendarDays, Flag } from 'lucide-react'
import { cn } from '@/lib/utils'
import { offlineDb } from '@/lib/offline-db'
import { syncEngine } from '@/lib/sync-engine'
import { Task, TaskPriority, TaskStatus } from '@/app/generated/prisma/client'

interface KanbanBoardProps {
  projectId: string
  initialTasks: (Task & { assigned_to_name: string | null; pendingSync?: boolean })[]
  teamMembers: { id: string; name: string; email: string; role: string }[]
}


const columns: { id: TaskStatus; title: string }[] = [
  { id: "BACKLOG", title: 'Backlog' },
  { id: "TODO", title: 'To Do' },
  { id: "IN_PROGRESS", title: 'In Progress' },
  { id: "REVIEW", title: 'Review' },
  { id: "DONE", title: 'Done' },
]

const priorityColors:Record<TaskPriority,string> = {
  "LOW": 'bg-muted text-muted-foreground',
  "MEDIUM": 'bg-[var(--estratico-info)]/10 text-[var(--estratico-info)]',
  "HIGH": 'bg-[var(--estratico-warning)]/10 text-[var(--estratico-warning)]',
  "URGENT": 'bg-destructive/10 text-destructive'
}

const columnColors: Record<TaskStatus,string> = {
  "BACKLOG": 'border-t-muted-foreground',
  "TODO": 'border-t-[var(--estratico-secondary)]',
  "IN_PROGRESS": 'border-t-[var(--estratico-info)]',
  "REVIEW": 'border-t-[var(--estratico-warning)]',
  "DONE": 'border-t-[var(--estratico-success)]'
}

export function KanbanBoard({ projectId, initialTasks, teamMembers }: KanbanBoardProps) {
  const [tasks, setTasks] = useState(initialTasks)

  const getTasksByStatus = useCallback((status: TaskStatus) => {
    return tasks.filter(task => task.status === status).sort((a, b) => a.position - b.position)
  }, [tasks])

  const handleDragEnd = useCallback(async (result: DropResult) => {
    const { destination, source, draggableId } = result

    if (!destination) return

    // If dropped in the same position
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return
    }

    const newStatus = destination.droppableId as TaskStatus
    const taskId = draggableId

    // Get the task being moved
    const taskToMove = tasks.find(t => t.id === taskId)
    if (!taskToMove) return

    // Calculate new position
    const tasksInDestination = getTasksByStatus(newStatus).filter(t => t.id !== taskId)
    let newPosition: number

    if (destination.index === 0) {
      newPosition = tasksInDestination.length > 0 ? tasksInDestination[0].position - 1000 : 0
    } else if (destination.index >= tasksInDestination.length) {
      newPosition = tasksInDestination.length > 0 
        ? tasksInDestination[tasksInDestination.length - 1].position + 1000 
        : 0
    } else {
      const before = tasksInDestination[destination.index - 1]
      const after = tasksInDestination[destination.index]
      newPosition = Math.floor((before.position + after.position) / 2)
    }

    // Optimistically update state
    setTasks(prevTasks => 
      prevTasks.map(t => 
        t.id === taskId 
          ? { ...t, status: newStatus, position: newPosition }
          : t
      )
    )

    // Update local database
    try {
      await offlineDb.tasks.update(taskId, {
        status: newStatus,
        position: newPosition,
        updatedAt: new Date().toISOString(),
        pendingSync: true
      })

      // Queue for sync
      if (syncEngine) {
        await syncEngine.queueChange({
          tableName: 'task',
          recordId: taskId,
          action: 'update',
          queryKey: ['project', projectId],
          payload: {
            ...taskToMove,
            status: newStatus,
            position: newPosition
          }
        })
      }
    } catch (error) {
      console.error('Failed to update task:', error)
      // Revert on error
      setTasks(initialTasks)
    }
  }, [tasks, getTasksByStatus, initialTasks])

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4 h-full min-w-0">
        {columns.map((column) => (
          <div key={column.id} className="shrink-0 w-72">
            <Card className={cn("border-t-4", columnColors[column.id])}>
              <CardHeader className="py-3">
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                  {column.title}
                  <Badge variant="secondary" className="ml-2">
                    {getTasksByStatus(column.id).length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <Droppable droppableId={column.id}>
                {(provided, snapshot) => (
                  <CardContent
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      "min-h-100 p-2 transition-colors",
                      snapshot.isDraggingOver && "bg-muted/50"
                    )}
                  >
                    {getTasksByStatus(column.id).length === 0 && !snapshot.isDraggingOver ? (
                      <div className="flex items-center justify-center h-20 text-sm text-muted-foreground">
                        No tasks
                      </div>
                    ) : (
                      getTasksByStatus(column.id).map((task, index) => (
                        <Draggable key={task.id} draggableId={task.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={cn(
                                "mb-2 p-3 bg-card rounded-lg border shadow-sm cursor-grab",
                                snapshot.isDragging && "shadow-lg ring-2 ring-primary"
                              )}
                            >
                              <div className="flex flex-col gap-2">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-sm font-medium text-foreground line-clamp-2">
                                    {task.title}
                                  </p>
                                  {task.pendingSync && (
                                    <Badge variant="secondary" className="shrink-0 bg-[var(--estratico-warning)]/10 text-[var(--estratico-warning)] border-[var(--estratico-warning)]/20 text-xs">
                                      Pending Sync
                                    </Badge>
                                  )}
                                </div>
                                
                                {task.description && (
                                  <p className="text-xs text-muted-foreground line-clamp-2">
                                    {task.description}
                                  </p>
                                )}

                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <Badge 
                                      variant="secondary" 
                                      className={cn("text-xs", priorityColors[task.priority])}
                                    >
                                      <Flag className="size-3 mr-1" />
                                      {task.priority}
                                    </Badge>
                                    
                                    {task.dueDate && (
                                      <span className="text-xs text-muted-foreground flex items-center">
                                        <CalendarDays className="size-3 mr-1" />
                                        {new Date(task.dueDate).toLocaleDateString()}
                                      </span>
                                    )}
                                  </div>

                                  {task.assigned_to_name && (
                                    <Avatar className="size-6">
                                      <AvatarFallback className="text-xs bg-(--estratico-accent) text-(--estratico-accent-foreground)">
                                        {task.assigned_to_name.charAt(0).toUpperCase()}
                                      </AvatarFallback>
                                    </Avatar>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))
                    )}
                    {provided.placeholder}
                  </CardContent>
                )}
              </Droppable>
            </Card>
          </div>
        ))}
      </div>
    </DragDropContext>
  )
}
