"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, FilePlus2, Pencil, Trash2 } from "lucide-react";
import {
  useCmsContentTypes,
  useCmsEntries,
  useDeleteEntry,
} from "@/hooks/use-cms";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Skeleton } from "@/components/ui/skeleton";

export function EntriesListClient() {
  const params = useParams<{ siteId: string; typeId: string }>();
  const { siteId, typeId } = params;
  const router = useRouter();

  const { data: typesData, isLoading: typesLoading } = useCmsContentTypes(siteId);
  const { data: entriesData, isLoading: entriesLoading } = useCmsEntries(siteId, typeId);
  const deleteEntry = useDeleteEntry(siteId, typeId);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  const type = typesData?.contentTypes.find((t) => t.id === typeId);

  if (typesLoading || entriesLoading) {
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

  const filtered = (entriesData?.entries ?? []).filter((e) => {
    const matchesSearch =
      !search ||
      e.title.toLowerCase().includes(search.toLowerCase()) ||
      e.slug.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !statusFilter || e.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const draftCount = (entriesData?.entries ?? []).filter((e) => e.status === "DRAFT").length;
  const publishedCount = (entriesData?.entries ?? []).filter((e) => e.status === "PUBLISHED").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{type.label}</h2>
          <p className="text-sm text-muted-foreground">
            {publishedCount} published · {draftCount} drafts
          </p>
        </div>
        <Button asChild>
          <Link href={`/dashboard/cms/sites/${siteId}/types/${typeId}/entries/new`}>
            <FilePlus2 className="mr-2 size-4" /> New Entry
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="max-w-xs"
          placeholder="Search by title or slug..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="rounded-md border bg-background px-3 py-2 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="PUBLISHED">Published</option>
          <option value="DRAFT">Draft</option>
        </select>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="w-28 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  No entries{search ? ` matching "${search}"` : " yet"}.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/dashboard/cms/sites/${siteId}/types/${typeId}/entries/${entry.id}`}
                      className="hover:underline"
                    >
                      {entry.title || entry.slug}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{entry.slug}</code>
                  </TableCell>
                  <TableCell>
                    {entry.status === "PUBLISHED" ? (
                      <Badge>Published</Badge>
                    ) : (
                      <Badge variant="secondary">Draft</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(entry.updatedAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" asChild>
                        <Link
                          href={`/dashboard/cms/sites/${siteId}/types/${typeId}/entries/${entry.id}`}
                        >
                          <Pencil className="size-4" />
                        </Link>
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-destructive">
                            <Trash2 className="size-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete &quot;{entry.title || entry.slug}&quot;?</AlertDialogTitle>
                            <AlertDialogDescription>
                              The entry is soft-deleted and stops appearing in the public API.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteEntry.mutate(entry.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}