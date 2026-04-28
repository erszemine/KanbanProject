'use client'
import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { CardType } from '@/lib/types'

interface Props {
  card: CardType
  onUpdate: (cardId: string, data: Partial<CardType>) => Promise<void>
  onDelete: (cardId: string) => Promise<void>
}

export function KanbanCard({ card, onUpdate, onDelete }: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(card.title)
  const [editDesc, setEditDesc] = useState(card.description || '')
  const [saving, setSaving] = useState(false)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: card.id,
    data: { type: 'Card', card },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const saveEdit = async () => {
    if (!editTitle.trim()) return
    setSaving(true)
    await onUpdate(card.id, { title: editTitle.trim(), description: editDesc || null })
    setSaving(false)
    setIsEditing(false)
  }

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="h-[72px] bg-[#2A2A5E]/30 border border-[#5E5CE6]/30 rounded-lg mb-1.5"
      />
    )
  }

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className="group bg-[#16162A] border border-[#1E1E38] rounded-lg p-3 mb-1.5 cursor-grab active:cursor-grabbing hover:border-[#2A2A5E] hover:shadow-card-hover transition-all select-none"
        {...attributes}
        {...listeners}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-[#E8E8F0] text-sm leading-snug flex-1">{card.title}</p>
          <button
            onPointerDown={e => e.stopPropagation()}
            onClick={e => {
              e.stopPropagation()
              setIsEditing(true)
              setEditTitle(card.title)
              setEditDesc(card.description || '')
            }}
            className="opacity-0 group-hover:opacity-100 text-[#7070A0] hover:text-[#E8E8F0] transition-all flex-shrink-0 p-0.5"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M8.5 1.5a1.414 1.414 0 012 2L3.5 10.5H1.5v-2L8.5 1.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
        {card.description && (
          <p className="text-[#7070A0] text-xs mt-1.5 leading-relaxed line-clamp-2">
            {card.description}
          </p>
        )}
      </div>

      {/* Edit Modal */}
      {isEditing && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4"
          onClick={() => setIsEditing(false)}
        >
          <div
            className="bg-[#0F0F1A] border border-[#1E1E38] rounded-xl p-5 w-full max-w-md animate-scale-in"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-sm font-medium text-[#E8E8F0] mb-4">Edit Card</h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-[#7070A0] mb-1.5 uppercase tracking-wider font-medium">
                  Title
                </label>
                <input
                  autoFocus
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveEdit()}
                  className="w-full bg-[#080810] border border-[#1E1E38] rounded-lg px-3.5 py-2.5 text-sm text-[#E8E8F0] focus:outline-none focus:border-[#5E5CE6] transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs text-[#7070A0] mb-1.5 uppercase tracking-wider font-medium">
                  Description
                </label>
                <textarea
                  value={editDesc}
                  onChange={e => setEditDesc(e.target.value)}
                  rows={3}
                  placeholder="Add a description…"
                  className="w-full bg-[#080810] border border-[#1E1E38] rounded-lg px-3.5 py-2.5 text-sm text-[#E8E8F0] placeholder-[#404060] focus:outline-none focus:border-[#5E5CE6] transition-colors resize-none"
                />
              </div>
            </div>

            <div className="flex justify-between mt-5">
              <button
                onClick={() => {
                  if (confirm('Delete this card?')) {
                    onDelete(card.id)
                    setIsEditing(false)
                  }
                }}
                className="text-red-400 hover:text-red-300 text-sm transition-colors"
              >
                Delete
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsEditing(false)}
                  className="text-[#7070A0] hover:text-[#E8E8F0] text-sm px-3 py-1.5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveEdit}
                  disabled={saving || !editTitle.trim()}
                  className="bg-[#5E5CE6] hover:bg-[#4D4BC4] disabled:opacity-50 text-white text-sm font-medium rounded-lg px-4 py-1.5 transition-colors"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
