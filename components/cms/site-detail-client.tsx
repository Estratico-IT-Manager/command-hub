"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus, Trash2, FileText, ArrowLeft, Images } from "lucide-react";
import { useParams } from "next/navigation";
import {
  useCmsSite,
  useCmsContentTypes,
  useCreateContentType,
  useDeleteContentType,
} from "@/hooks/use-cms";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function SiteDetailClient() {
  const params = useParams<{ siteId: string }>();
  const siteId = params.siteId;

  const { data: siteData, isLoading: siteLoading } = useCmsSite(siteId);
  const { data: typesData, isLoading: typesLoading } = useCmsContentTypes(siteId);
  const createType = useCreateContentType(siteId);

  const [label, setName] = useState("");
  const [nameOverride, setNameOverride] = useState("");
  const [description, setDescription] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  if (siteLoading || typesLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const site = siteData?.site;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/cms/sites" aria-label="Back to sites">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <h2 className="text-xl font-semibold">{site?.name}</h2>
            <p className="text-sm text-muted-foreground">
              {site?.slug}
              {site?.description ? ` — ${site.description}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href={`/dashboard/cms/sites/${siteId}/media`}>
              <Images className="mr-2 size-4" /> Media
            </Link>
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 size-4" /> New Content Type
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create content type</DialogTitle>
                <DialogDescription>
                  A content type is a collection of entries, e.g. &quot;posts&quot;,
                  &quot;services&quot; or &quot;projects&quot;. A default &quot;Title&quot;
                  field is created automatically.
                </DialogDescription>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  createType.mutate(
                    {
                      name: nameOverride || undefined,
                      label,
                      description,
                    },
                    {
                      onSuccess: () => {
                        setName("");
                        setNameOverride("");
                        setDescription("");
                        setDialogOpen(false);
                      },
                    },
                  );
                }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="type-label">Label</Label>
                  <Input
                    id="type-label"
                    value={label}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Blog Posts"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type-name">API name (optional)</Label>
                  <Input
                    id="type-name"
                    value={nameOverride}
                    onChange={(e) => setNameOverride(e.target.value)}
                    placeholder="posts (defaults to slugified label)"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type-desc">Description</Label>
                  <Textarea
                    id="type-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                  />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={createType.isPending}>
                    {createType.isPending ? "Creating..." : "Create type"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {typesData?.contentTypes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <FileText className="size-10 text-muted-foreground" />
            <p className="font-medium">No content types yet</p>
            <p className="text-sm text-muted-foreground">
              Create your first content type to start managing content.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {typesData?.contentTypes.map((type) => (
            <TypeCard
              key={type.id}
              siteId={siteId}
              type={type}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TypeCard({ siteId, type }: { siteId: string; type: any }) {
  const deleteType = useDeleteContentType(siteId, type.id);
  const disabled = (type._count?.entries ?? 0) > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle>
              <Link href={`/dashboard/cms/sites/${siteId}/types/${type.id}`} className="hover:underline">
                {type.label}
              </Link>
            </CardTitle>
            <CardDescription className="mt-1">
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{type.name}</code>
              {type.description ? ` — ${type.description}` : ""}
            </CardDescription>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-destructive">
                <Trash2 className="size-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {type.label}?</AlertDialogTitle>
                <AlertDialogDescription>
                  {type._count?.entries > 0
                    ? `This type has ${type._count.entries} entries. You must delete them first.`
                    : "This permanently deletes the content type and its schema."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteType.mutate()}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={disabled}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{type.fields?.length ?? 0} fields</Badge>
          <Badge variant="outline">{type._count?.entries ?? 0} entries</Badge>
        </div>
      </CardContent>
    </Card>
  );
}