'use client'
import { useState, useCallback } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCorners,
  UniqueIdentifier,
} from '@dnd-kit/core'
import { SortableContext, horizontalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { createPortal } from 'react-dom'
import { BoardType, ColumnType, CardType } from '@/lib/types'
import { KanbanColumn } from './KanbanColumn'
import { KanbanCard } from './KanbanCard'
import { getPositionBetween, getPositionBefore, getPositionAfter } from '@/lib/position'

interface Props {
  initialBoard: BoardType
}

export function KanbanBoard({ initialBoard }: Props) {
  const [board, setBoard] = useState(initialBoard)
  const [activeCard, setActiveCard] = useState<CardType | null>(null)
  const [activeColumn, setActiveColumn] = useState<ColumnType | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  )

  const columns = [...board.columns].sort((a, b) => a.position - b.position)
  const columnIds = columns.map(c => c.id)

  // ─── Optimistic helpers ──────────────────────────────────────────────────

  const updateCardInState = useCallback((cardId: string, updates: Partial<CardType>) => {
    setBoard(prev => ({
      ...prev,
      columns: prev.columns.map(col => ({
        ...col,
        cards: col.cards.map(c => c.id === cardId ? { ...c, ...updates } : c),
      })),
    }))
  }, [])

  const moveCardBetweenColumns = useCallback(
    (cardId: string, fromColId: string, toColId: string, newPosition: number) => {
      setBoard(prev => {
        const fromCol = prev.columns.find(c => c.id === fromColId)
        const card = fromCol?.cards.find(c => c.id === cardId)
        if (!card) return prev

        return {
          ...prev,
          columns: prev.columns.map(col => {
            if (col.id === fromColId) {
              return { ...col, cards: col.cards.filter(c => c.id !== cardId) }
            }
            if (col.id === toColId) {
              const updatedCard = { ...card, columnId: toColId, position: newPosition }
              return {
                ...col,
                cards: [...col.cards, updatedCard].sort((a, b) => a.position - b.position),
              }
            }
            return col
          }),
        }
      })
    },
    []
  )

  // ─── Drag Handlers ──────────────────────────────────────────────────────

  const onDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current
    if (data?.type === 'Card') setActiveCard(data.card)
    if (data?.type === 'Column') setActiveColumn(data.column)
  }

  const onDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return

    const activeId = active.id
    const overId = over.id

    // Only handle card dragging over columns or other cards
    if (active.data.current?.type !== 'Card') return

    const activeCard = active.data.current.card as CardType
    const activeColId = activeCard.columnId

    // Determine the target column
    let overColId: string | null = null

    if (typeof overId === 'string' && overId.startsWith('col-')) {
      overColId = overId.replace('col-', '')
    } else {
      // over a card — find which column it belongs to
      const overCardData = over.data.current
      if (overCardData?.type === 'Card') {
        overColId = (overCardData.card as CardType).columnId
      }
    }

    if (!overColId || overColId === activeColId) return

    // Move card to new column optimistically (at end)
    const targetCol = board.columns.find(c => c.id === overColId)
    if (!targetCol) return

    const targetCards = [...targetCol.cards].sort((a, b) => a.position - b.position)
    const newPos = targetCards.length > 0
      ? getPositionAfter(targetCards[targetCards.length - 1].position)
      : 32768

    moveCardBetweenColumns(activeCard.id, activeColId, overColId, newPos)
  }

  const onDragEnd = async (event: DragEndEvent) => {
    setActiveCard(null)
    setActiveColumn(null)

    const { active, over } = event
    if (!over) return

    const activeData = active.data.current
    const overData = over.data.current

    // ── Column reorder ──────────────────────────────────────────────────
    if (activeData?.type === 'Column') {
      const activeColId = active.id as string
      const overColId = over.id as string
      if (activeColId === overColId) return

      const oldIndex = columns.findIndex(c => c.id === activeColId)
      const newIndex = columns.findIndex(c => c.id === overColId)
      const reordered = arrayMove(columns, oldIndex, newIndex)

      // Compute new position for moved column
      const movedCol = reordered[newIndex]
      const before = reordered[newIndex - 1]?.position ?? 0
      const after = reordered[newIndex + 1]?.position ?? 65536 * 2
      const newPos = getPositionBetween(before, after)

      setBoard(prev => ({
        ...prev,
        columns: prev.columns.map(c =>
          c.id === activeColId ? { ...c, position: newPos } : c
        ),
      }))

      await fetch(`/api/columns/${activeColId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position: newPos }),
      })
      return
    }

    // ── Card reorder / move ─────────────────────────────────────────────
    if (activeData?.type === 'Card') {
      const activeCard = activeData.card as CardType

      // Find where the card currently lives in state
      let currentColId = activeCard.columnId
      let currentCards: CardType[] = []

      // Find current column from state (might differ after onDragOver)
      for (const col of board.columns) {
        if (col.cards.find(c => c.id === activeCard.id)) {
          currentColId = col.id
          currentCards = [...col.cards].sort((a, b) => a.position - b.position)
          break
        }
      }

      // Determine over card (if any)
      let newPosition: number

      if (overData?.type === 'Card') {
        const overCard = overData.card as CardType
        const overColCards = board.columns
          .find(c => c.id === overCard.columnId)
          ?.cards.sort((a, b) => a.position - b.position) ?? []

        const overIndex = overColCards.findIndex(c => c.id === overCard.id)
        const activeIndex = overColCards.findIndex(c => c.id === activeCard.id)

        const insertIndex = activeIndex === -1
          ? overIndex
          : (overIndex > activeIndex ? overIndex : overIndex)

        const before = overColCards[insertIndex - 1]
        const after = overColCards[insertIndex]
        const isMovingDown = activeIndex < overIndex

        if (isMovingDown) {
          const next = overColCards[overIndex + 1]
          newPosition = next
            ? getPositionBetween(overCard.position, next.position)
            : getPositionAfter(overCard.position)
        } else {
          const prev = overColCards[overIndex - 1]
          newPosition = prev
            ? getPositionBetween(prev.position, overCard.position)
            : getPositionBefore(overCard.position)
        }
      } else {
        // Dropped onto column drop zone — put at end
        const colCards = currentCards.filter(c => c.id !== activeCard.id)
        newPosition = colCards.length > 0
          ? getPositionAfter(colCards[colCards.length - 1].position)
          : 32768
      }

      // Optimistic update
      updateCardInState(activeCard.id, {
        position: newPosition,
        columnId: currentColId,
      })

      // Persist
      await fetch(`/api/cards/${activeCard.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          position: newPosition,
          columnId: currentColId,
        }),
      })
    }
  }

  // ─── Board Mutations ─────────────────────────────────────────────────────

  const addColumn = async (title: string) => {
    const res = await fetch('/api/columns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, boardId: board.id }),
    })
    const column = await res.json()
    setBoard(prev => ({ ...prev, columns: [...prev.columns, { ...column, cards: [] }] }))
  }

  const addCard = async (columnId: string, title: string) => {
    const res = await fetch('/api/cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, columnId }),
    })
    const card = await res.json()
    setBoard(prev => ({
      ...prev,
      columns: prev.columns.map(col =>
        col.id === columnId ? { ...col, cards: [...col.cards, card] } : col
      ),
    }))
  }

  const updateCard = async (cardId: string, data: Partial<CardType>) => {
    await fetch(`/api/cards/${cardId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    updateCardInState(cardId, data)
  }

  const deleteCard = async (cardId: string) => {
    await fetch(`/api/cards/${cardId}`, { method: 'DELETE' })
    setBoard(prev => ({
      ...prev,
      columns: prev.columns.map(col => ({
        ...col,
        cards: col.cards.filter(c => c.id !== cardId),
      })),
    }))
  }

  const updateColumn = async (columnId: string, title: string) => {
    await fetch(`/api/columns/${columnId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    })
    setBoard(prev => ({
      ...prev,
      columns: prev.columns.map(col =>
        col.id === columnId ? { ...col, title } : col
      ),
    }))
  }

  const deleteColumn = async (columnId: string) => {
    await fetch(`/api/columns/${columnId}`, { method: 'DELETE' })
    setBoard(prev => ({
      ...prev,
      columns: prev.columns.filter(col => col.id !== columnId),
    }))
  }

  // ─── Add Column UI ───────────────────────────────────────────────────────
  const [showAddCol, setShowAddCol] = useState(false)
  const [newColTitle, setNewColTitle] = useState('')

  const handleAddColumn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newColTitle.trim()) return
    await addColumn(newColTitle.trim())
    setNewColTitle('')
    setShowAddCol(false)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
    >
      <div className="board-scroll flex gap-3 px-6 py-4 items-start">
        <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
          {columns.map(col => (
            <KanbanColumn
              key={col.id}
              column={col}
              onAddCard={addCard}
              onUpdateCard={updateCard}
              onDeleteCard={deleteCard}
              onUpdateColumn={updateColumn}
              onDeleteColumn={deleteColumn}
            />
          ))}
        </SortableContext>

        {/* Add Column */}
        <div className="w-72 flex-shrink-0">
          {showAddCol ? (
            <form
              onSubmit={handleAddColumn}
              className="bg-[#0F0F1A] border border-[#1E1E38] rounded-xl p-4 animate-slide-up"
            >
              <input
                autoFocus
                value={newColTitle}
                onChange={e => setNewColTitle(e.target.value)}
                onKeyDown={e => e.key === 'Escape' && setShowAddCol(false)}
                placeholder="Column name…"
                className="w-full bg-[#080810] border border-[#1E1E38] rounded-lg px-3 py-2 text-sm text-[#E8E8F0] placeholder-[#404060] focus:outline-none focus:border-[#5E5CE6] transition-colors mb-3"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={!newColTitle.trim()}
                  className="bg-[#5E5CE6] hover:bg-[#4D4BC4] disabled:opacity-50 text-white text-xs font-medium rounded-lg px-3 py-2 transition-colors"
                >
                  Add column
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddCol(false)}
                  className="text-[#7070A0] hover:text-[#E8E8F0] text-xs px-2 py-2 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setShowAddCol(true)}
              className="w-full flex items-center gap-2 text-[#7070A0] hover:text-[#E8E8F0] bg-[#0F0F1A]/50 hover:bg-[#0F0F1A] border border-dashed border-[#1E1E38] hover:border-[#2A2A5E] rounded-xl px-4 py-3 text-sm transition-all"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              Add column
            </button>
          )}
        </div>
      </div>

      {/* Drag Overlays */}
      {typeof window !== 'undefined' && createPortal(
        <DragOverlay dropAnimation={{ duration: 150, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
          {activeCard && (
            <div className="drag-overlay-card bg-[#16162A] border border-[#5E5CE6]/40 rounded-lg p-3 w-72">
              <p className="text-[#E8E8F0] text-sm leading-snug">{activeCard.title}</p>
              {activeCard.description && (
                <p className="text-[#7070A0] text-xs mt-1.5 line-clamp-2">{activeCard.description}</p>
              )}
            </div>
          )}
          {activeColumn && (
            <div className="bg-[#0F0F1A] border border-[#5E5CE6]/30 rounded-xl w-72 p-4 opacity-80 shadow-card-drag">
              <h3 className="text-sm font-medium text-[#E8E8F0]">{activeColumn.title}</h3>
            </div>
          )}
        </DragOverlay>,
        document.body
      )}
    </DndContext>
  )
}
