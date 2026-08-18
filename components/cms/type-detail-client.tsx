"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  FilePlus2,
  GripVertical,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toastError } from "@/hooks/use-toast";
import {
  useCmsContentTypes,
  useCreateField,
  useDeleteField,
  useUpdateField,
} from "@/hooks/use-cms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const FIELD_TYPES = [
  "TEXT",
  "TEXTAREA",
  "MARKDOWN",
  "IMAGE",
  "NUMBER",
  "BOOLEAN",
  "SELECT",
  "MULTISELECT",
  "DATE",
  "DATETIME",
  "RELATION",
  "REPEATER",
] as const;

const REPEATER_SUB_TYPES = [
  "TEXT",
  "TEXTAREA",
  "MARKDOWN",
  "IMAGE",
  "NUMBER",
  "BOOLEAN",
  "SELECT",
  "DATE",
] as const;

const TYPE_BADGE: Record<string, string> = {
  TEXT: "secondary",
  TEXTAREA: "secondary",
  MARKDOWN: "outline",
  IMAGE: "outline",
  NUMBER: "secondary",
  BOOLEAN: "outline",
  SELECT: "secondary",
  MULTISELECT: "secondary",
  DATE: "secondary",
  DATETIME: "secondary",
  RELATION: "outline",
  REPEATER: "outline",
} as const;

interface BlockSpec {
  name: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
}

interface FieldFormState {
  label: string;
  name: string;
  type: string;
  required: boolean;
  isTitle: boolean;
  isSlugSource: boolean;
  optionsText: string;
  relationTypeId: string;
  blocks: BlockSpec[];
}

const emptyField: FieldFormState = {
  label: "",
  name: "",
  type: "TEXT",
  required: false,
  isTitle: false,
  isSlugSource: false,
  optionsText: "",
  relationTypeId: "",
  blocks: [],
};

export function TypeDetailClient() {
  const params = useParams<{ siteId: string; typeId: string }>();
  const { siteId, typeId } = params;
  const router = useRouter();

  const { data, isLoading } = useCmsContentTypes(siteId);
  const createField = useCreateField(siteId, typeId);
  const updateField = useUpdateField(siteId, typeId);
  const deleteField = useDeleteField(siteId, typeId);

const type = data?.contentTypes.find((t) => t.id === typeId);
  const relationTargets = (data?.contentTypes ?? []).filter((t) => t.id !== typeId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<FieldFormState>(emptyField);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyField);
    setDialogOpen(true);
  };

  const openEdit = (field: any) => {
    setEditing(field.id);
    setForm({
      label: field.label,
      name: field.name,
      type: field.type,
      required: field.required,
      isTitle: field.isTitle,
      isSlugSource: field.isSlugSource,
      optionsText:
        Array.isArray(field.options?.options)
          ? field.options.options.join("\n")
          : "",
      relationTypeId: field.relationTypeId ?? "",
      blocks: Array.isArray(field.options?.fields)
        ? field.options.fields.map((b: any) => ({
            name: b.name,
            label: b.label,
            type: b.type,
            required: Boolean(b.required),
            options: Array.isArray(b.options) ? b.options : [],
          }))
        : [],
    });
    setDialogOpen(true);
  };

  const submit = () => {
    const payload: Record<string, unknown> = {
      label: form.label,
      required: form.required,
      isTitle: form.isTitle,
      isSlugSource: form.isSlugSource,
    };
    if (form.name.trim()) payload.name = form.name.trim();

    if (form.type === "SELECT" || form.type === "MULTISELECT") {
      const options = form.optionsText
        .split("\n")
        .map((o) => o.trim())
        .filter(Boolean);
      if (options.length === 0) {
        toastError("Select fields need at least one option");
        return;
      }
      payload.options = { options };
    }

    if (form.type === "RELATION") {
      if (!form.relationTypeId) {
        toastError("Choose a target content type");
        return;
      }
      payload.relationTypeId = form.relationTypeId;
    }

    if (form.type === "REPEATER") {
      const blocks = form.blocks.map((b) => ({
        name: b.name,
        label: b.label,
        type: b.type,
        required: Boolean(b.required),
        ...(b.type === "SELECT" ? { options: b.options ?? [] } : {}),
      }));
      if (blocks.length === 0) {
        toastError("Repeater fields need at least one block field");
        return;
      }
      payload.options = { fields: blocks };
    }

    if (editing) {
      updateField.mutate(
        { fieldId: editing, ...payload },
        {
          onSuccess: () => setDialogOpen(false),
        },
      );
    } else {
      createField.mutate(payload, {
        onSuccess: () => setDialogOpen(false),
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!type) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 size-4" /> Back
        </Button>
        <p className="text-muted-foreground">Content type not found.</p>
      </div>
    );
  }

  const fields = [...type.fields].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/dashboard/cms/sites/${siteId}`} aria-label="Back to site">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <h2 className="text-xl font-semibold">{type.label}</h2>
            <p className="text-sm text-muted-foreground">
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{type.name}</code> — define
              the schema, then manage entries below.
            </p>
          </div>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 size-4" /> Add Field
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Schema</CardTitle>
          <CardDescription>
            Fields render as form controls when editing entries. Entries are stored as JSON
            payloads keyed by field name.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {fields.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No fields yet. Add your first field to build the schema.
            </p>
          ) : (
            fields.map((field) => (
              <div
                key={field.id}
                className="flex items-center gap-3 rounded-lg border p-3"
              >
                <GripVertical className="size-4 shrink-0 text-muted-foreground/50" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{field.label}</span>
                    {field.isTitle && <Badge variant="default">Title</Badge>}
                    {field.isSlugSource && <Badge variant="secondary">Slug source</Badge>}
                    {field.required && <Badge variant="outline">required</Badge>}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <code className="rounded bg-muted px-1 py-0.5">{field.name}</code>
                    <Badge variant={TYPE_BADGE[field.type] as any}>{field.type}</Badge>
                    {field.type === "RELATION" && (
                      <span>→ {relationTargets.find((t) => t.id === field.relationTypeId)?.label ?? "?"}</span>
                    )}
                    {field.type === "REPEATER" && (
                      <span>
                        {Array.isArray(field.options?.fields) ? field.options.fields.length : 0} block
                        field(s)
                      </span>
                    )}
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => openEdit(field)}>
                  <Pencil className="size-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      disabled={field.isTitle}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete field &quot;{field.label}&quot;?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Existing entries keep their data, but the field will no longer be editable.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteField.mutate(field.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <FieldDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing !== null}
        form={form}
        setForm={setForm}
        relationTargets={relationTargets}
        onSubmit={submit}
        isPending={createField.isPending || updateField.isPending}
      />
    </div>
  );
}

function FieldDialog({
  open,
  onOpenChange,
  editing,
  form,
  setForm,
  relationTargets,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: boolean;
  form: FieldFormState;
  setForm: (updater: (prev: FieldFormState) => FieldFormState) => void;
  relationTargets: any[];
  onSubmit: () => void;
  isPending: boolean;
}) {
  const set = (patch: Partial<FieldFormState>) => setForm((prev) => ({ ...prev, ...patch }));

  const needsOptions = form.type === "SELECT" || form.type === "MULTISELECT";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit field" : "Add field"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Update the field configuration."
              : "Define a field in this content type's schema."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="field-label">Label</Label>
            <Input
              id="field-label"
              value={form.label}
              onChange={(e) => set({ label: e.target.value })}
              placeholder="Author"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="field-name">API name (optional)</Label>
            <Input
              id="field-name"
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="author (defaults to slugified label)"
              disabled={editing}
            />
            {editing && (
              <p className="text-xs text-muted-foreground">
                The API name cannot be changed after creation.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="field-type">Type</Label>
            <Select
              value={form.type}
              onValueChange={(v) => set({ type: v })}
              disabled={editing}
            >
              <SelectTrigger id="field-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIELD_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {editing && (
              <p className="text-xs text-muted-foreground">
                The type cannot be changed after creation.
              </p>
            )}
          </div>

          {needsOptions && (
            <div className="space-y-2">
              <Label htmlFor="field-options">Options (one per line)</Label>
              <Textarea
                id="field-options"
                value={form.optionsText}
                onChange={(e) => set({ optionsText: e.target.value })}
                placeholder={"published\ndraft"}
                rows={4}
              />
            </div>
          )}

          {form.type === "RELATION" && (
            <div className="space-y-2">
              <Label>Target content type</Label>
              <Select
                value={form.relationTypeId}
                onValueChange={(v) => set({ relationTypeId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a type" />
                </SelectTrigger>
                <SelectContent>
                  {relationTargets.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.label} ({t.name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Entry values store the slug of the related entry.
              </p>
            </div>
          )}

          {form.type === "REPEATER" && (
            <RepeaterBlocksEditor
              blocks={form.blocks}
              onChange={(blocks) => set({ blocks })}
            />
          )}

          <div className="space-y-3 rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="field-required"
                checked={form.required}
                onCheckedChange={(v) => set({ required: Boolean(v) })}
              />
              <Label htmlFor="field-required" className="font-normal">
                Required
              </Label>
            </div>
            {!editing && (
              <>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="field-is-title"
                    checked={form.isTitle}
                    onCheckedChange={(v) => set({ isTitle: Boolean(v) })}
                  />
                  <Label htmlFor="field-is-title" className="font-normal">
                    Title field — used as the entry title
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="field-slug-source"
                    checked={form.isSlugSource}
                    onCheckedChange={(v) => set({ isSlugSource: Boolean(v) })}
                  />
                  <Label htmlFor="field-slug-source" className="font-normal">
                    Slug source — entry slugs are generated from this field
                  </Label>
                </div>
              </>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onSubmit} disabled={isPending || !form.label.trim()}>
            {isPending ? "Saving..." : editing ? "Save changes" : "Add field"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RepeaterBlocksEditor({
  blocks,
  onChange,
}: {
  blocks: BlockSpec[];
  onChange: (blocks: BlockSpec[]) => void;
}) {
  const set = (index: number, patch: Partial<BlockSpec>) =>
    onChange(blocks.map((b, i) => (i === index ? { ...b, ...patch } : b)));

  return (
    <div className="space-y-2">
      <Label>Block fields</Label>
      <p className="text-xs text-muted-foreground">
        Each item in this repeater contains these sub-fields.
      </p>
      {blocks.map((block, index) => (
        <div key={index} className="space-y-2 rounded-lg border p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Block {index + 1}</span>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={() => onChange(blocks.filter((_, i) => i !== index))}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Name</Label>
              <Input
                value={block.name}
                onChange={(e) => set(index, { name: e.target.value })}
                placeholder="feature"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Label</Label>
              <Input
                value={block.label}
                onChange={(e) => set(index, { label: e.target.value })}
                placeholder="Feature"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Type</Label>
              <Select
                value={block.type}
                onValueChange={(v) => set(index, { type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REPEATER_SUB_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Checkbox
                id={`block-required-${index}`}
                checked={Boolean(block.required)}
                onCheckedChange={(v) => set(index, { required: Boolean(v) })}
              />
              <Label htmlFor={`block-required-${index}`} className="text-xs">
                Required
              </Label>
            </div>
          </div>
          {block.type === "SELECT" && (
            <div className="space-y-1">
              <Label className="text-xs">Options (comma separated)</Label>
              <Input
                value={(block.options ?? []).join(", ")}
                onChange={(e) =>
                  set(index, {
                    options: e.target.value
                      .split(",")
                      .map((o) => o.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="red, green, blue"
              />
            </div>
          )}
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          onChange([...blocks, { name: "", label: "", type: "TEXT" }])
        }
      >
        <FilePlus2 className="mr-2 size-4" /> Add block field
      </Button>
    </div>
  );
}