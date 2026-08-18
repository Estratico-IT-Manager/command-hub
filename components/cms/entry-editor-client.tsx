"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { ArrowLeft, ImagePlus, Plus, Trash2 } from "lucide-react";
import { toastError } from "@/hooks/use-toast";
import {
  useCmsContentTypes,
  useCmsEntry,
  useCmsEntries,
  useCreateEntry,
  useUpdateEntry,
  useUploadMedia,
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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type FieldSpec = {
  id: string;
  name: string;
  label: string;
  type: string;
  required: boolean;
  options: any;
  relationTypeId: string | null;
  isTitle: boolean;
  isSlugSource: boolean;
};

function defaultValue(field: FieldSpec): unknown {
  switch (field.type) {
    case "NUMBER":
      return "";
    case "BOOLEAN":
      return false;
    case "MULTISELECT":
      return [];
    case "REPEATER":
      return [];
    case "DATE":
    case "DATETIME":
      return "";
    default:
      return "";
  }
}

function defaultRepeaterItem(field: FieldSpec): Record<string, unknown> {
  const item: Record<string, unknown> = {};
  const blocks: any[] = Array.isArray(field.options?.fields) ? field.options.fields : [];
  for (const block of blocks) {
    item[block.name] =
      block.type === "BOOLEAN" ? false : block.type === "NUMBER" ? "" : "";
  }
  return item;
}

export function EntryEditorClient() {
  const params = useParams<{ siteId: string; typeId: string; entryId: string }>();
  const { siteId, typeId, entryId } = params;
  const router = useRouter();

  const { data: typesData, isLoading: typesLoading } = useCmsContentTypes(siteId);
  const isNew = entryId === "new";
  const { data: entryData, isLoading: entryLoading } = useCmsEntry(
    siteId,
    typeId,
    isNew ? undefined : entryId,
  );
  const { data: relatedData } = useCmsEntries(siteId, typeId);
  const updateEntry = useUpdateEntry(siteId, typeId, entryId);
  const createEntry = useCreateEntry(siteId, typeId);
  const uploadMedia = useUploadMedia(siteId);

  const type = typesData?.contentTypes.find((t) => t.id === typeId);
  const fields: FieldSpec[] = useMemo(
    () => (type ? [...type.fields].sort((a, b) => a.order - b.order) : []),
    [type],
  );

  const [values, setValues] = useState<Record<string, unknown>>({});
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState<"DRAFT" | "PUBLISHED" | null>(null);

  const relationEntriesByType = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const type of typesData?.contentTypes ?? []) {
      const list = relatedData?.entries ?? [];
      map.set(type.id, list);
    }
    return map;
  }, [relatedData, typesData]);

  useEffect(() => {
    if (isNew) {
      const next: Record<string, unknown> = {};
      for (const field of fields) {
        next[field.name] = defaultValue(field);
      }
      setValues(next);
      setLoaded(true);
      return;
    }
    if (entryData?.entry && !loaded) {
      const next: Record<string, unknown> = {};
      for (const field of fields) {
        next[field.name] =
          entryData.entry.payload?.[field.name] ?? defaultValue(field);
      }
      setValues(next);
      setLoaded(true);
    }
  }, [entryData, fields, loaded, isNew]);

  if (typesLoading || (!isNew && entryLoading)) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-96 w-full" />
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

  const titleField = fields.find((f) => f.isTitle);

  const entryTitle =
    (titleField && typeof values[titleField.name] === "string"
      ? (values[titleField.name] as string)
      : "") || "";

  const set = (name: string, value: unknown) =>
    setValues((prev) => ({ ...prev, [name]: value }));

  const save = (status: "DRAFT" | "PUBLISHED") => {
    setSaving(status);
    const payload: Record<string, unknown> = {};
    for (const field of fields) {
      const raw = values[field.name];
      if (field.required && (raw === "" || raw === null || raw === undefined)) {
        toastError(`"${field.label}" is required`);
        setSaving(null);
        return;
      }
      if (field.type === "NUMBER" && raw !== "" && raw !== null) {
        const num = Number(raw);
        if (Number.isNaN(num)) {
          toastError(`"${field.label}" must be a number`);
          setSaving(null);
          return;
        }
        payload[field.name] = num;
        continue;
      }
      if (field.type === "MULTISELECT" && Array.isArray(raw)) {
        payload[field.name] = raw.filter(Boolean);
        continue;
      }
      payload[field.name] = raw;
    }

    if (isNew) {
      createEntry.mutate(
        { payload, status },
        {
          onError: () => setSaving(null),
          onSuccess: (res) => {
            setSaving(null);
            router.replace(
              `/dashboard/cms/sites/${siteId}/types/${typeId}/entries/${res.entry.id}`,
            );
          },
        },
      );
      return;
    }

    updateEntry.mutate(
      { payload, status },
      {
        onError: () => setSaving(null),
        onSuccess: () => setSaving(null),
      },
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link
              href={`/dashboard/cms/sites/${siteId}/types/${typeId}?view=content`}
              aria-label="Back to entries"
            >
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <h2 className="text-xl font-semibold">
              {isNew ? "New entry" : entryTitle || "Untitled entry"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {type.label} ·{" "}
              {entryData?.entry ? (
                <>
                  <code className="rounded bg-muted px-1 py-0.5 text-xs">
                    {entryData.entry.slug}
                  </code>{" "}
                  · v{entryData.entry.version}
                </>
              ) : null}
              {entryData?.entry?.status === "PUBLISHED" ? (
                <Badge className="ml-2">Published</Badge>
              ) : (
                <Badge variant="secondary" className="ml-2">
                  Draft
                </Badge>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isNew && entryData?.entry?.status === "PUBLISHED" && (
            <Button variant="outline" onClick={() => save("DRAFT")} disabled={saving !== null}>
              Unpublish
            </Button>
          )}
          <Button variant="secondary" onClick={() => save("DRAFT")} disabled={saving !== null}>
            {saving === "DRAFT" ? "Saving..." : "Save draft"}
          </Button>
          <Button onClick={() => save("PUBLISHED")} disabled={saving !== null}>
            {saving === "PUBLISHED" ? "Publishing..." : "Publish"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {fields.map((field) => (
            <FieldControl
              key={field.id}
              field={field}
              value={values[field.name]}
              onChange={(v) => set(field.name, v)}
              relationEntries={relationEntriesByType.get(field.relationTypeId ?? "") ?? []}
              uploadMedia={uploadMedia}
            />
          ))}
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-sm">Entry info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex justify-between">
              <span>Type</span>
              <span className="font-medium text-foreground">{type.label}</span>
            </div>
            <div className="flex justify-between">
              <span>Slug</span>
              <span>
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                  {entryData?.entry?.slug ?? "auto"}
                </code>
              </span>
            </div>
            <div className="flex justify-between">
              <span>Created</span>
              <span>
                {entryData?.entry?.createdAt
                  ? new Date(entryData.entry.createdAt).toLocaleDateString()
                  : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Updated</span>
              <span>
                {entryData?.entry?.updatedAt
                  ? new Date(entryData.entry.updatedAt).toLocaleDateString()
                  : "—"}
              </span>
            </div>
            {entryData?.entry?.publishedAt && (
              <div className="flex justify-between">
                <span>Published</span>
                <span>{new Date(entryData.entry.publishedAt).toLocaleDateString()}</span>
              </div>
            )}
            <p className="pt-2 text-xs">
              Entries are read by websites via the public API. Unpublished drafts are never
              exposed.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FieldControl({
  field,
  value,
  onChange,
  relationEntries,
  uploadMedia,
}: {
  field: FieldSpec;
  value: unknown;
  onChange: (value: unknown) => void;
  relationEntries: any[];
  uploadMedia: { mutate: (file: File) => void; isPending: boolean };
}) {
  const common = (
    <div className="space-y-2">
      <Label htmlFor={`field-${field.name}`}>
        {field.label}
        {field.required && <span className="text-destructive"> *</span>}
      </Label>
      {renderControl()}
    </div>
  );

  function renderControl() {
    switch (field.type) {
      case "TEXT":
        return (
          <Input
            id={`field-${field.name}`}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
          />
        );
      case "TEXTAREA":
        return (
          <Textarea
            id={`field-${field.name}`}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            rows={4}
          />
        );
      case "MARKDOWN":
        return (
          <div className="grid gap-3 md:grid-cols-2">
            <Textarea
              id={`field-${field.name}`}
              value={(value as string) ?? ""}
              onChange={(e) => onChange(e.target.value)}
              rows={10}
              className="font-mono text-xs"
            />
            <div className="prose prose-sm dark:prose-invert max-h-64 overflow-y-auto rounded-lg border p-3">
              <ReactMarkdown>{(value as string) ?? ""}</ReactMarkdown>
            </div>
          </div>
        );
      case "IMAGE":
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Input
                value={(value as string) ?? ""}
                onChange={(e) => onChange(e.target.value)}
                placeholder="Paste image URL, or upload:"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={uploadMedia.isPending}
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = "image/*";
                  input.onchange = () => {
                    const file = input.files?.[0];
                    if (!file) return;
                    uploadMedia.mutate(file);
                  };
                  input.click();
                }}
              >
                <ImagePlus className="size-4" />
              </Button>
            </div>
            {(value as string) && (
              <img
                src={value as string}
                alt={field.label}
                className="max-h-48 rounded-lg border object-contain"
              />
            )}
          </div>
        );
      case "NUMBER":
        return (
          <Input
            id={`field-${field.name}`}
            type="number"
            value={(value as string | number) ?? ""}
            onChange={(e) => onChange(e.target.value)}
          />
        );
      case "BOOLEAN":
        return (
          <div className="flex items-center gap-2 rounded-lg border p-3">
            <Checkbox
              id={`field-${field.name}`}
              checked={Boolean(value)}
              onCheckedChange={(v) => onChange(Boolean(v))}
            />
            <Label htmlFor={`field-${field.name}`} className="font-normal">
              {field.label}
            </Label>
          </div>
        );
      case "SELECT": {
        const options: string[] = Array.isArray(field.options?.options)
          ? field.options.options
          : [];
        return (
          <Select
            value={(value as string) ?? ""}
            onValueChange={(v) => onChange(v)}
          >
            <SelectTrigger id={`field-${field.name}`}>
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      }
      case "MULTISELECT": {
        const options: string[] = Array.isArray(field.options?.options)
          ? field.options.options
          : [];
        const current = Array.isArray(value) ? (value as string[]) : [];
        return (
          <div className="space-y-2">
            {options.map((o) => (
              <div key={o} className="flex items-center gap-2">
                <Checkbox
                  id={`field-${field.name}-${o}`}
                  checked={current.includes(o)}
                  onCheckedChange={(checked) => {
                    onChange(
                      checked
                        ? [...current, o]
                        : current.filter((c) => c !== o),
                    );
                  }}
                />
                <Label htmlFor={`field-${field.name}-${o}`} className="font-normal">
                  {o}
                </Label>
              </div>
            ))}
          </div>
        );
      }
      case "DATE":
        return (
          <Input
            id={`field-${field.name}`}
            type="date"
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
          />
        );
      case "DATETIME":
        return (
          <Input
            id={`field-${field.name}`}
            type="datetime-local"
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
          />
        );
      case "RELATION": {
        const currentSlug = value as string;
        return (
          <Select
            value={currentSlug}
            onValueChange={(v) => onChange(v)}
          >
            <SelectTrigger id={`field-${field.name}`}>
              <SelectValue placeholder="Select related entry..." />
            </SelectTrigger>
            <SelectContent>
              {relationEntries.map((entry) => (
                <SelectItem key={entry.id} value={entry.slug}>
                  {entry.title || entry.slug}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      }
      case "REPEATER": {
        const blocks: any[] = Array.isArray(field.options?.fields)
          ? field.options.fields
          : [];
        const items = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
        return (
          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={index} className="space-y-3 rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {field.label} #{index + 1}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() =>
                      onChange(items.filter((_, i) => i !== index))
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                {blocks.map((block) => (
                  <RepeaterBlockControl
                    key={block.name}
                    block={block}
                    value={item[block.name]}
                    onChange={(v) => {
                      const next = items.map((it, i) =>
                        i === index ? { ...it, [block.name]: v } : it,
                      );
                      onChange(next);
                    }}
                  />
                ))}
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onChange([...items, defaultRepeaterItem(field)])}
            >
              <Plus className="mr-2 size-4" /> Add {field.label} item
            </Button>
          </div>
        );
      }
      default:
        return <p className="text-sm text-muted-foreground">Unsupported field type.</p>;
    }
  }

  return <div className="rounded-lg border p-4">{common}</div>;
}

function RepeaterBlockControl({
  block,
  value,
  onChange,
}: {
  block: { name: string; label: string; type: string; required?: boolean; options?: string[] };
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const label = (
    <Label>
      {block.label}
      {block.required && <span className="text-destructive"> *</span>}
    </Label>
  );

  switch (block.type) {
    case "TEXT":
      return (
        <div className="space-y-1.5">
          {label}
          <Input value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} />
        </div>
      );
    case "TEXTAREA":
      return (
        <div className="space-y-1.5">
          {label}
          <Textarea value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} rows={3} />
        </div>
      );
    case "MARKDOWN":
      return (
        <div className="space-y-1.5">
          {label}
          <Textarea
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            rows={5}
            className="font-mono text-xs"
          />
        </div>
      );
    case "IMAGE":
      return (
        <div className="space-y-1.5">
          {label}
          <Input
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Image URL"
          />
        </div>
      );
    case "NUMBER":
      return (
        <div className="space-y-1.5">
          {label}
          <Input
            type="number"
            value={(value as string | number) ?? ""}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );
    case "BOOLEAN":
      return (
        <div className="flex items-center gap-2">
          <Checkbox checked={Boolean(value)} onCheckedChange={(v) => onChange(Boolean(v))} />
          {label}
        </div>
      );
    case "SELECT":
      return (
        <div className="space-y-1.5">
          {label}
          <Select value={(value as string) ?? ""} onValueChange={onChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              {(block.options ?? []).map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    case "DATE":
      return (
        <div className="space-y-1.5">
          {label}
          <Input
            type="date"
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );
    default:
      return null;
  }
}