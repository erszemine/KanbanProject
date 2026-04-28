'use client'
import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ColumnType, CardType } from '@/lib/types'
import { KanbanCard } from './KanbanCard'

interface Props {
  column: ColumnType
  onAddCard: (columnId: string, title: string) => Promise<void>
  onUpdateCard: (cardId: string, data: Partial<CardType>) => Promise<void>
  onDeleteCard: (cardId: string) => Promise<void>
  onUpdateColumn: (columnId: string, title: string) => Promise<void>
  onDeleteColumn: (columnId: string) => Promise<void>
}

export function KanbanColumn({
  column,
  onAddCard,
  onUpdateCard,
  onDeleteCard,
  onUpdateColumn,
  onDeleteColumn,
}: Props) {
  const [addingCard, setAddingCard] = useState(false)
  const [newCardTitle, setNewCardTitle] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const [columnTitle, setColumnTitle] = useState(column.title)

  const cardIds = column.cards.map(c => c.id)

  // Sortable for column reordering
  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging: isColumnDragging,
  } = useSortable({
    id: column.id,
    data: { type: 'Column', column },
  })

  // Droppable for card drops into this column
  const { setNodeRef: setDropRef } = useDroppable({ id: `col-${column.id}` })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const handleAddCard = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCardTitle.trim()) return
    await onAddCard(column.id, newCardTitle.trim())
    setNewCardTitle('')
    setAddingCard(false)
  }

  const handleSaveTitle = async () => {
    if (columnTitle.trim() && columnTitle !== column.title) {
      await onUpdateColumn(column.id, columnTitle.trim())
    }
    setEditingTitle(false)
  }

  if (isColumnDragging) {
    return (
      <div
        ref={setSortableRef}
        style={style}
        className="w-72 flex-shrink-0 bg-[#0F0F1A]/50 border border-[#5E5CE6]/20 rounded-xl h-20 opacity-40"
      />
    )
  }

  return (
    <div
      ref={setSortableRef}
      style={style}
      className="w-72 flex-shrink-0 flex flex-col"
    >
      <div className="bg-[#0F0F1A] border border-[#1E1E38] rounded-xl flex flex-col max-h-[calc(100vh-120px)]">
        {/* Column Header */}
        <div
          className="flex items-center justify-between px-4 pt-4 pb-3 cursor-grab active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {editingTitle ? (
              <input
                autoFocus
                value={columnTitle}
                onChange={e => setColumnTitle(e.target.value)}
                onBlur={handleSaveTitle}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleSaveTitle()
                  if (e.key === 'Escape') { setColumnTitle(column.title); setEditingTitle(false) }
                }}
                onPointerDown={e => e.stopPropagation()}
                onClick={e => e.stopPropagation()}
                className="bg-transparent border-b border-[#5E5CE6] text-sm font-medium text-[#E8E8F0] focus:outline-none w-full"
              />
            ) : (
              <h3
                className="text-sm font-medium text-[#E8E8F0] truncate"
                onDoubleClick={e => { e.stopPropagation(); setEditingTitle(true) }}
              >
                {column.title}
              </h3>
            )}
            <span className="text-xs text-[#7070A0] bg-[#16162A] px-1.5 py-0.5 rounded-md flex-shrink-0">
              {column.cards.length}
            </span>
          </div>

          <button
            onPointerDown={e => e.stopPropagation()}
            onClick={e => {
              e.stopPropagation()
              if (confirm(`Delete column "${column.title}" and all its cards?`)) {
                onDeleteColumn(column.id)
              }
            }}
            className="text-[#7070A0] hover:text-red-400 transition-colors p-1 ml-1 flex-shrink-0"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Cards List */}
        <div
          ref={setDropRef}
          className="px-3 overflow-y-auto flex-1 column-scroll"
        >
          <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
            {column.cards.map(card => (
              <KanbanCard
                key={card.id}
                card={card}
                onUpdate={onUpdateCard}
                onDelete={onDeleteCard}
              />
            ))}
          </SortableContext>

          {column.cards.length === 0 && !addingCard && (
            <div className="border border-dashed border-[#1E1E38] rounded-lg h-16 flex items-center justify-center mb-1.5">
              <p className="text-[#404060] text-xs">Drop cards here</p>
            </div>
          )}
        </div>

        {/* Add Card */}
        <div className="px-3 pb-3 pt-1">
          {addingCard ? (
            <form onSubmit={handleAddCard} className="animate-slide-up">
              <textarea
                autoFocus
                value={newCardTitle}
                onChange={e => setNewCardTitle(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddCard(e as any) }
                  if (e.key === 'Escape') setAddingCard(false)
                }}
                placeholder="Card title…"
                rows={2}
                className="w-full bg-[#16162A] border border-[#5E5CE6]/40 rounded-lg px-3 py-2 text-sm text-[#E8E8F0] placeholder-[#404060] focus:outline-none focus:border-[#5E5CE6] transition-colors resize-none mb-2"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={!newCardTitle.trim()}
                  className="bg-[#5E5CE6] hover:bg-[#4D4BC4] disabled:opacity-50 text-white text-xs font-medium rounded-md px-3 py-1.5 transition-colors"
                >
                  Add card
                </button>
                <button
                  type="button"
                  onClick={() => setAddingCard(false)}
                  className="text-[#7070A0] hover:text-[#E8E8F0] text-xs px-2 py-1.5 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setAddingCard(true)}
              className="w-full flex items-center gap-1.5 text-[#7070A0] hover:text-[#E8E8F0] text-xs py-1.5 px-1 transition-colors group"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="group-hover:text-[#5E5CE6]">
                <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              Add a card
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
