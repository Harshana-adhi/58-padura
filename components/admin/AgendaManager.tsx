"use client";

import { useState, useTransition } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { upsertAgendaItemAction, deleteAgendaItemAction, reorderAgendaAction } from "@/server/actions/agenda";
import { LiveEventProvider, useLiveEvent } from "@/lib/live/LiveEventProvider";
import type { AgendaItem, Category, PublicSnapshot } from "@/lib/types";
import { CategoryChip } from "@/components/ui/CategoryChip";
import { StatusBadge } from "@/components/ui/StatusBadge";

function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AgendaManager({ initialSnapshot }: { initialSnapshot: PublicSnapshot }) {
  return (
    <LiveEventProvider initial={initialSnapshot}>
      <AgendaManagerInner />
    </LiveEventProvider>
  );
}

function AgendaManagerInner() {
  const { snapshot, applySnapshot } = useLiveEvent();
  const { items, categories, version } = snapshot;
  const [editing, setEditing] = useState<AgendaItem | "new" | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<string[] | null>(null);

  const sorted = [...items].sort((a, b) => a.display_order - b.display_order);
  const locked = sorted.filter((i) => i.status !== "upcoming");
  const upcomingBase = sorted.filter((i) => i.status === "upcoming");
  const upcomingOrder = order ?? upcomingBase.map((i) => i.id);
  const upcoming = upcomingOrder.map((id) => upcomingBase.find((i) => i.id === id)!).filter(Boolean);

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = upcomingOrder.indexOf(String(active.id));
    const newIndex = upcomingOrder.indexOf(String(over.id));
    const newUpcomingOrder = arrayMove(upcomingOrder, oldIndex, newIndex);
    setOrder(newUpcomingOrder);

    // Locked items keep their position; only the upcoming tail is renumbered.
    const rebuilt: string[] = [];
    let u = 0;
    for (const item of sorted) {
      if (item.status === "upcoming") {
        rebuilt.push(newUpcomingOrder[u]);
        u++;
      } else {
        rebuilt.push(item.id);
      }
    }

    startTransition(async () => {
      const result = await reorderAgendaAction({ ids: rebuilt, expectedVersion: version });
      if (!result.ok) {
        setError(result.error ?? "Could not reorder.");
        setOrder(null);
      } else if (result.snapshot) {
        applySnapshot(result.snapshot);
        setOrder(null);
      }
    });
  }

  function submit(formData: FormData) {
    const isNew = editing === "new";
    const current = isNew ? null : (editing as AgendaItem);
    setError(null);
    startTransition(async () => {
      const result = await upsertAgendaItemAction({
        id: current?.id ?? null,
        itemNumber: Number(formData.get("itemNumber")),
        title: String(formData.get("title")),
        description: String(formData.get("description") || "") || null,
        categoryId: String(formData.get("categoryId")),
        scheduledStartAt: new Date(String(formData.get("scheduledStartAt"))).toISOString(),
        durationMinutes: Number(formData.get("durationMinutes")),
        isTimeFixed: formData.get("isTimeFixed") === "on",
        expectedVersion: current?.row_version ?? null,
      });
      if (!result.ok) setError(result.error ?? "Could not save.");
      else {
        if (result.snapshot) applySnapshot(result.snapshot);
        setEditing(null);
      }
    });
  }

  function remove(id: string) {
    if (!confirm("Delete this item? This cannot be undone from here.")) return;
    startTransition(async () => {
      const result = await deleteAgendaItemAction(id);
      if (!result.ok) setError(result.error ?? "Could not delete.");
      else if (result.snapshot) applySnapshot(result.snapshot);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Agenda management</h1>
        <button onClick={() => setEditing("new")} className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground">
          Add item
        </button>
      </div>

      {error && <p className="text-sm text-red">{error}</p>}

      {editing && (
        <form
          action={submit}
          className="flex flex-col gap-3 rounded-xl bg-stage-raised p-4 ring-1 ring-stage-border sm:max-w-lg"
        >
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              Item number
              <input name="itemNumber" type="number" required defaultValue={editing !== "new" ? editing.item_number : undefined} className="input" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Category
              <select name="categoryId" required defaultValue={editing !== "new" ? editing.category_id : categories[0]?.id} className="input">
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            Title
            <input name="title" required maxLength={150} defaultValue={editing !== "new" ? editing.title : ""} className="input" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Description
            <textarea name="description" rows={2} maxLength={1000} defaultValue={editing !== "new" ? editing.description ?? "" : ""} className="input" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              Scheduled start
              <input
                name="scheduledStartAt"
                type="datetime-local"
                required
                defaultValue={editing !== "new" ? toLocalInputValue(editing.scheduled_start_at) : ""}
                className="input"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Duration (minutes)
              <input name="durationMinutes" type="number" min={1} max={600} required defaultValue={editing !== "new" ? editing.duration_minutes : 10} className="input" />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isTimeFixed" defaultChecked={editing !== "new" ? editing.is_time_fixed : false} />
            Time fixed (schedule shifts leave it alone)
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground disabled:opacity-60">
              {pending ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={() => setEditing(null)} className="rounded-md px-3 py-1.5 text-sm ring-1 ring-stage-border text-stage-muted">
              Cancel
            </button>
          </div>
        </form>
      )}

      {locked.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs uppercase tracking-widest text-stage-muted">Already run (locked)</p>
          <ul className="flex flex-col gap-1.5">
            {locked.map((item) => (
              <AgendaRow key={item.id} item={item} categories={categories} locked onEdit={() => {}} onDelete={() => {}} />
            ))}
          </ul>
        </div>
      )}

      <div>
        <p className="mb-1.5 text-xs uppercase tracking-widest text-stage-muted">Upcoming (drag to reorder)</p>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={upcoming.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <ul className="flex flex-col gap-1.5">
              {upcoming.map((item) => (
                <SortableAgendaRow
                  key={item.id}
                  item={item}
                  categories={categories}
                  onEdit={() => setEditing(item)}
                  onDelete={() => remove(item.id)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}

function SortableAgendaRow({
  item,
  categories,
  onEdit,
  onDelete,
}: {
  item: AgendaItem;
  categories: Category[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <li ref={setNodeRef} style={style}>
      <AgendaRow item={item} categories={categories} onEdit={onEdit} onDelete={onDelete} dragHandle={<span {...attributes} {...listeners} className="cursor-grab px-1 text-stage-muted" aria-label="Drag to reorder">⠿</span>} />
    </li>
  );
}

function AgendaRow({
  item,
  categories,
  locked,
  onEdit,
  onDelete,
  dragHandle,
}: {
  item: AgendaItem;
  categories: Category[];
  locked?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  dragHandle?: React.ReactNode;
}) {
  const category = categories.find((c) => c.id === item.category_id);
  return (
    <div className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 ring-1 ring-stage-border ${locked ? "opacity-60" : "bg-stage-raised"}`}>
      <div className="flex min-w-0 items-center gap-2">
        {dragHandle}
        <span className="w-8 shrink-0 tabular text-xs text-stage-muted">#{item.item_number}</span>
        <div className="min-w-0">
          <p className="font-sin truncate text-sm font-medium">{item.title}</p>
          <div className="flex items-center gap-2 text-xs text-stage-muted">
            {category && <CategoryChip name={category.name} color={category.color} />}
            <StatusBadge status={item.status} />
          </div>
        </div>
      </div>
      {!locked && (
        <div className="flex gap-2 text-xs">
          <button onClick={onEdit} className="rounded-md px-2 py-1 ring-1 ring-stage-border text-stage-muted">
            Edit
          </button>
          <button onClick={onDelete} className="rounded-md px-2 py-1 ring-1 ring-stage-border text-red">
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
