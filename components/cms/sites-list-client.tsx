"use client";

import Link from "next/link";
import { useState } from "react";
import { Globe, KeyRound, Plus, Trash2 } from "lucide-react";
import { useCmsSites, useCreateSite, useDeleteSite, useRegenerateApiKey } from "@/hooks/use-cms";
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

export function SitesListClient() {
  const { data, isLoading } = useCmsSites();
  const createSite = useCreateSite();
  const deleteSite = useDeleteSite;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-40 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Websites</h2>
          <p className="text-sm text-muted-foreground">
            Sites powered by this CMS. Each site has its own content types and API key.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 size-4" /> New Site
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create site</DialogTitle>
              <DialogDescription>
                Register a website that this CMS will power.
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createSite.mutate(
                  { name, description },
                  {
                    onSuccess: () => {
                      setName("");
                      setDescription("");
                      setDialogOpen(false);
                    },
                  },
                );
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="site-name">Site name</Label>
                <Input
                  id="site-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Estratico Profile"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="site-desc">Description</Label>
                <Textarea
                  id="site-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="The public marketing website for Estratico."
                  rows={3}
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createSite.isPending}>
                  {createSite.isPending ? "Creating..." : "Create site"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {data?.sites.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <Globe className="size-10 text-muted-foreground" />
            <p className="font-medium">No sites yet</p>
            <p className="text-sm text-muted-foreground">
              Create your first site to start building content types.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data?.sites.map((site) => (
            <SiteCard key={site.id} site={site} />
          ))}
        </div>
      )}
    </div>
  );
}

function SiteCard({ site }: { site: any }) {
  const regenerate = useRegenerateApiKey(site.id);
  const deleteMutation = useDeleteSite(site.id);
  const [showKey, setShowKey] = useState<string | null>(null);
  const [regenerateOpen, setRegenerateOpen] = useState(false);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Link href={`/dashboard/cms/sites/${site.id}`} className="hover:underline">
                {site.name}
              </Link>
              {!site.isActive && <Badge variant="secondary">Inactive</Badge>}
            </CardTitle>
            <CardDescription className="mt-1">
              {site.slug}
              {site.description ? ` · ${site.description}` : ""}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <div className="rounded-lg border p-2">
            <div className="text-lg font-semibold">{site._count?.contentTypes ?? 0}</div>
            <div className="text-xs text-muted-foreground">Types</div>
          </div>
          <div className="rounded-lg border p-2">
            <div className="text-lg font-semibold">{site._count?.entries ?? 0}</div>
            <div className="text-xs text-muted-foreground">Entries</div>
          </div>
          <div className="rounded-lg border p-2">
            <div className="text-lg font-semibold">{site._count?.media ?? 0}</div>
            <div className="text-xs text-muted-foreground">Files</div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs">
            <KeyRound className="size-3.5 text-muted-foreground" />
            {site.hasApiKey ? (
              <span className="text-muted-foreground">API key set</span>
            ) : (
              <span className="font-medium text-destructive">No API key</span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <Dialog
              open={regenerateOpen}
              onOpenChange={(open) => {
                setRegenerateOpen(open);
                if (open) setShowKey(null);
              }}
            >
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <KeyRound className="mr-1.5 size-3.5" /> API Key
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>API key</DialogTitle>
                  <DialogDescription>
                    {site.hasApiKey
                      ? "Regenerate the API key for this site. The old key stops working immediately."
                      : "Generate an API key for this site. Copy it now — it is shown only once."}
                  </DialogDescription>
                </DialogHeader>
                {showKey ? (
                  <div className="space-y-2">
                    <Label>Your API key</Label>
                    <code className="block break-all rounded-lg border bg-muted p-3 text-xs">
                      {showKey}
                    </code>
                    <p className="text-xs text-muted-foreground">
                      Send it as the <code className="rounded bg-muted px-1">x-api-key</code>{" "}
                      header when calling the public API.
                    </p>
                  </div>
                ) : (
                  <DialogFooter>
                    <Button
                      onClick={() =>
                        regenerate.mutate(undefined, {
                          onSuccess: (res) => {
                            setShowKey(res.apiKey);
                          },
                        })
                      }
                      disabled={regenerate.isPending}
                    >
                      {regenerate.isPending ? "Generating..." : "Regenerate key"}
                    </Button>
                  </DialogFooter>
                )}
              </DialogContent>
            </Dialog>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-destructive">
                  <Trash2 className="size-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {site.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently deletes the site, all its content types, entries and media.
                    This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteMutation.mutate()}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}