/**
 * ZTD Kanban Board -- zo.space page route
 *
 * Deploy to your zo.space as a private page at /kanban
 * Requires the API routes to be deployed at /api/kanban
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Loader2, Plus, X, MessageSquare, Paperclip, AlertTriangle, HelpCircle, Lightbulb, Send, ChevronDown } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Card {
  id: number;
  display_id: string;
  title: string;
  status: string;
  assignee: string;
  type: string;
  priority: string;
  tags: string[];
  due_date: string | null;
  description?: string;
  comments?: Array<{ author: string; timestamp: string; content: string }>;
  activity?: string[];
  conversations?: string[];
  attachments?: Array<{ path: string; name: string }>;
  sort_order: number;
}

type Status = "inbox" | "in_progress" | "in_review" | "done";

const STATUSES: { key: Status; label: string; color: string }[] = [
  { key: "inbox", label: "Inbox", color: "bg-zinc-500" },
  { key: "in_progress", label: "In Progress", color: "bg-blue-500" },
  { key: "in_review", label: "In Review", color: "bg-amber-500" },
  { key: "done", label: "Done", color: "bg-emerald-500" },
];

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "border-l-red-500",
  high: "border-l-amber-500",
  medium: "border-l-blue-500",
  low: "border-l-zinc-400",
};

const TYPE_ICONS: Record<string, any> = {
  question: HelpCircle,
  blocker: AlertTriangle,
  idea: Lightbulb,
  request: Send,
};

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

const API = "/api/kanban";

async function fetchCards(): Promise<Card[]> {
  const res = await fetch(API);
  return res.json();
}

async function createCard(data: Partial<Card>): Promise<Card> {
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

async function updateCard(id: number, data: any): Promise<any> {
  const res = await fetch(`${API}/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

async function fetchCardDetail(id: number): Promise<Card> {
  const res = await fetch(`${API}/${id}`);
  return res.json();
}

async function addComment(id: number, content: string, author: string): Promise<any> {
  const res = await fetch(`${API}/${id}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, author }),
  });
  return res.json();
}

async function saveReorder(orders: Array<{ id: number; sort_order: number }>): Promise<void> {
  await fetch(`${API}/reorder`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orders }),
  });
}

async function deleteCard(id: number): Promise<void> {
  await fetch(`${API}/${id}`, { method: "DELETE" });
}

// ---------------------------------------------------------------------------
// Sortable Card Component
// ---------------------------------------------------------------------------

function SortableCard({ card, onClick }: { card: Card; onClick: () => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `card-${card.id}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const TypeIcon = TYPE_ICONS[card.type];

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`group p-3 rounded-lg border border-border bg-card text-card-foreground cursor-grab active:cursor-grabbing hover:border-primary/30 transition-colors border-l-4 ${PRIORITY_COLORS[card.priority] || "border-l-transparent"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[10px] font-mono text-muted-foreground">{card.display_id}</span>
            {TypeIcon && <TypeIcon className="w-3 h-3 text-muted-foreground" />}
          </div>
          <p className="text-sm font-medium leading-tight">{card.title}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-2">
        <span className="inline-block w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center bg-primary/20 text-primary">
          {card.assignee.charAt(0).toUpperCase()}
        </span>
        {card.tags && card.tags.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {card.tags.slice(0, 2).map((tag) => (
              <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{tag}</span>
            ))}
            {card.tags.length > 2 && (
              <span className="text-[10px] text-muted-foreground">+{card.tags.length - 2}</span>
            )}
          </div>
        )}
        {card.due_date && (
          <span className={`text-[10px] ml-auto ${new Date(card.due_date) < new Date() ? "text-red-400" : "text-muted-foreground"}`}>
            {new Date(card.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card Overlay (while dragging)
// ---------------------------------------------------------------------------

function CardOverlay({ card }: { card: Card }) {
  return (
    <div className={`p-3 rounded-lg border border-primary/50 bg-card text-card-foreground shadow-xl border-l-4 ${PRIORITY_COLORS[card.priority] || "border-l-transparent"} rotate-2`}>
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-[10px] font-mono text-muted-foreground">{card.display_id}</span>
      </div>
      <p className="text-sm font-medium">{card.title}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Column Component
// ---------------------------------------------------------------------------

function Column({
  status,
  cards,
  onCardClick,
  onAddCard,
}: {
  status: typeof STATUSES[number];
  cards: Card[];
  onCardClick: (card: Card) => void;
  onAddCard: (status: Status) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `column-${status.key}` });
  const sortableIds = cards.map((c) => `card-${c.id}`);

  return (
    <div className="flex flex-col min-w-[280px] w-[280px] flex-shrink-0">
      <div className="flex items-center gap-2 mb-3 px-1">
        <div className={`w-2 h-2 rounded-full ${status.color}`} />
        <h2 className="text-sm font-semibold text-foreground">{status.label}</h2>
        <span className="text-xs text-muted-foreground ml-auto">{cards.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 flex flex-col gap-2 p-2 rounded-xl transition-colors min-h-[200px] ${isOver ? "bg-primary/5 ring-1 ring-primary/20" : "bg-muted/30"}`}
      >
        <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <SortableCard key={card.id} card={card} onClick={() => onCardClick(card)} />
          ))}
        </SortableContext>
        <button
          onClick={() => onAddCard(status.key)}
          className="flex items-center gap-1.5 p-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add card</span>
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card Detail Panel
// ---------------------------------------------------------------------------

function CardDetail({
  card,
  onClose,
  onUpdate,
}: {
  card: Card;
  onClose: () => void;
  onUpdate: () => void;
}) {
  const [detail, setDetail] = useState<Card | null>(null);
  const [commentText, setCommentText] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchCardDetail(card.id).then((d) => { setDetail(d); setLoading(false); });
  }, [card.id]);

  const handleStatusChange = async (newStatus: string) => {
    await updateCard(card.id, { status: newStatus });
    onUpdate();
    const d = await fetchCardDetail(card.id);
    setDetail(d);
  };

  const handleComment = async () => {
    if (!commentText.trim()) return;
    await addComment(card.id, commentText, "user");
    setCommentText("");
    const d = await fetchCardDetail(card.id);
    setDetail(d);
  };

  const handleDelete = async () => {
    await deleteCard(card.id);
    onClose();
    onUpdate();
  };

  if (loading || !detail) {
    return (
      <div className="fixed inset-y-0 right-0 w-[420px] bg-background border-l border-border shadow-2xl z-50 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="fixed inset-y-0 right-0 w-[420px] bg-background border-l border-border shadow-2xl z-50 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <span className="text-sm font-mono text-muted-foreground">{detail.display_id}</span>
        <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="w-4 h-4" /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <h2 className="text-lg font-semibold">{detail.title}</h2>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <label className="text-muted-foreground text-xs">Status</label>
            <select
              value={detail.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="w-full mt-1 p-1.5 rounded border border-border bg-background text-sm"
            >
              {STATUSES.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-muted-foreground text-xs">Assignee</label>
            <p className="mt-1 p-1.5 capitalize">{detail.assignee}</p>
          </div>
          <div>
            <label className="text-muted-foreground text-xs">Priority</label>
            <p className="mt-1 p-1.5 capitalize">{detail.priority}</p>
          </div>
          <div>
            <label className="text-muted-foreground text-xs">Type</label>
            <p className="mt-1 p-1.5 capitalize">{detail.type}</p>
          </div>
        </div>

        {detail.tags && detail.tags.length > 0 && (
          <div>
            <label className="text-muted-foreground text-xs">Tags</label>
            <div className="flex gap-1 mt-1 flex-wrap">
              {detail.tags.map((tag) => (
                <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{tag}</span>
              ))}
            </div>
          </div>
        )}

        {detail.description && (
          <div>
            <label className="text-muted-foreground text-xs">Description</label>
            <p className="mt-1 text-sm whitespace-pre-wrap">{detail.description}</p>
          </div>
        )}

        {detail.attachments && detail.attachments.length > 0 && (
          <div>
            <label className="text-muted-foreground text-xs flex items-center gap-1"><Paperclip className="w-3 h-3" /> Attachments</label>
            <div className="mt-1 space-y-1">
              {detail.attachments.map((a, i) => (
                <div key={i} className="text-xs text-blue-400 truncate">{a.name || a.path}</div>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="text-muted-foreground text-xs flex items-center gap-1">
            <MessageSquare className="w-3 h-3" /> Comments ({detail.comments?.length || 0})
          </label>
          <div className="mt-2 space-y-3">
            {detail.comments?.map((c, i) => (
              <div key={i} className="text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-xs text-primary">{c.author}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(c.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  </span>
                </div>
                <p className="text-muted-foreground whitespace-pre-wrap">{c.content}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleComment(); } }}
              placeholder="Add a comment..."
              className="flex-1 text-sm p-2 rounded border border-border bg-background"
            />
            <button onClick={handleComment} className="px-3 py-2 rounded bg-primary text-primary-foreground text-sm hover:opacity-90">Send</button>
          </div>
        </div>

        {detail.activity && detail.activity.length > 0 && (
          <div>
            <label className="text-muted-foreground text-xs">Activity</label>
            <div className="mt-1 space-y-1">
              {detail.activity.slice(-10).reverse().map((a, i) => {
                const parts = a.split(" | ");
                return (
                  <div key={i} className="text-[11px] text-muted-foreground">
                    <span className="opacity-60">{parts[0] ? new Date(parts[0]).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : ""}</span>
                    {" "}<span className="font-medium">{parts[1]}</span>{" "}{parts.slice(2).join(" | ")}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="p-3 border-t border-border">
        <button onClick={handleDelete} className="text-xs text-red-400 hover:text-red-300">Delete card</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quick Add Form
// ---------------------------------------------------------------------------

function QuickAdd({ status, onSubmit, onCancel }: { status: Status; onSubmit: (title: string) => void; onCancel: () => void }) {
  const [title, setTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSubmit = () => {
    if (title.trim()) { onSubmit(title.trim()); setTitle(""); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onCancel}>
      <div className="bg-background border border-border rounded-xl p-4 w-[400px] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-semibold mb-3">New card in {STATUSES.find((s) => s.key === status)?.label}</h3>
        <input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); if (e.key === "Escape") onCancel(); }}
          placeholder="Card title..."
          className="w-full p-2.5 rounded-lg border border-border bg-background text-sm"
        />
        <div className="flex justify-end gap-2 mt-3">
          <button onClick={onCancel} className="px-3 py-1.5 rounded text-sm text-muted-foreground hover:bg-muted">Cancel</button>
          <button onClick={handleSubmit} className="px-3 py-1.5 rounded bg-primary text-primary-foreground text-sm hover:opacity-90">Create</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Board
// ---------------------------------------------------------------------------

export default function KanbanBoard() {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [addingTo, setAddingTo] = useState<Status | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const loadCards = useCallback(() => {
    fetchCards()
      .then((data) => { setCards(data); setError(null); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadCards(); }, [loadCards]);

  const getColumnCards = (status: Status) =>
    cards.filter((c) => c.status === status).sort((a, b) => a.sort_order - b.sort_order);

  const findCardById = (dragId: string): Card | undefined => {
    const id = parseInt(dragId.replace("card-", ""), 10);
    return cards.find((c) => c.id === id);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const card = findCardById(String(event.active.id));
    if (card) setActiveCard(card);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    const draggedCard = findCardById(activeId);
    if (!draggedCard) return;

    let targetStatus: Status | null = null;
    if (overId.startsWith("column-")) {
      targetStatus = overId.replace("column-", "") as Status;
    } else if (overId.startsWith("card-")) {
      const overCard = findCardById(overId);
      if (overCard) targetStatus = overCard.status as Status;
    }

    if (targetStatus && draggedCard.status !== targetStatus) {
      setCards((prev) =>
        prev.map((c) => (c.id === draggedCard.id ? { ...c, status: targetStatus! } : c))
      );
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCard(null);

    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    const draggedCard = findCardById(activeId);
    if (!draggedCard) return;

    let targetStatus: Status = draggedCard.status as Status;
    if (overId.startsWith("column-")) {
      targetStatus = overId.replace("column-", "") as Status;
    } else if (overId.startsWith("card-")) {
      const overCard = findCardById(overId);
      if (overCard) targetStatus = overCard.status as Status;
    }

    const columnCards = cards
      .filter((c) => c.status === targetStatus)
      .sort((a, b) => a.sort_order - b.sort_order);

    if (overId.startsWith("card-") && activeId !== overId) {
      const oldIndex = columnCards.findIndex((c) => `card-${c.id}` === activeId);
      const newIndex = columnCards.findIndex((c) => `card-${c.id}` === overId);
      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(columnCards, oldIndex, newIndex);
        const orders = reordered.map((c, i) => ({ id: c.id, sort_order: i }));
        await saveReorder(orders);
      }
    }

    const originalCard = cards.find((c) => c.id === draggedCard.id);
    if (originalCard && targetStatus !== (originalCard as any)._originalStatus) {
      await updateCard(draggedCard.id, { status: targetStatus, actor: "user" });
    }

    loadCards();
  };

  const handleAddCard = async (title: string) => {
    if (!addingTo) return;
    await createCard({ title, status: addingTo, assignee: "user", source: "manual" });
    setAddingTo(null);
    loadCards();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">ZTD</h1>
          <p className="text-xs text-muted-foreground">Zo To Do</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{cards.length} cards</span>
          <button
            onClick={() => setAddingTo("inbox")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm hover:opacity-90"
          >
            <Plus className="w-3.5 h-3.5" />
            New
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
      )}

      <div className="p-6 overflow-x-auto">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4">
            {STATUSES.map((status) => (
              <Column
                key={status.key}
                status={status}
                cards={getColumnCards(status.key)}
                onCardClick={(card) => setSelectedCard(card)}
                onAddCard={(s) => setAddingTo(s)}
              />
            ))}
          </div>

          <DragOverlay>
            {activeCard ? <CardOverlay card={activeCard} /> : null}
          </DragOverlay>
        </DndContext>
      </div>

      {selectedCard && (
        <CardDetail
          card={selectedCard}
          onClose={() => setSelectedCard(null)}
          onUpdate={() => { loadCards(); }}
        />
      )}

      {addingTo && (
        <QuickAdd
          status={addingTo}
          onSubmit={handleAddCard}
          onCancel={() => setAddingTo(null)}
        />
      )}
    </div>
  );
}
