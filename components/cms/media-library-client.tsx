"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useRef, useState } from "react";
import { ArrowLeft, Copy, FileImage, Upload } from "lucide-react";
import { toastSuccess } from "@/hooks/use-toast";
import { useCmsMedia, useUploadMedia } from "@/hooks/use-cms";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function MediaLibraryClient() {
  const params = useParams<{ siteId: string }>();
  const { siteId } = params;
  const { data, isLoading } = useCmsMedia(siteId);
  const upload = useUploadMedia(siteId);
  const inputRef = useRef<HTMLInputElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyUrl = async (url: string, id: string) => {
    await navigator.clipboard.writeText(url);
    setCopiedId(id);
    toastSuccess("URL copied");
    setTimeout(() => setCopiedId(null), 1500);
  };

  const isImage = (mimeType: string) => mimeType.startsWith("image/");

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
            <h2 className="text-xl font-semibold">Media Library</h2>
            <p className="text-sm text-muted-foreground">
              Uploaded files are stored in Google Drive and publicly readable.
            </p>
          </div>
        </div>
        <Button onClick={() => inputRef.current?.click()} disabled={upload.isPending}>
          <Upload className="mr-2 size-4" /> {upload.isPending ? "Uploading..." : "Upload"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*,application/pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload.mutate(file);
            e.target.value = "";
          }}
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="aspect-video rounded-xl" />
          ))}
        </div>
      ) : data?.media.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <FileImage className="size-10 text-muted-foreground" />
            <p className="font-medium">No files yet</p>
            <p className="text-sm text-muted-foreground">
              Upload images, videos or PDFs for use in content entries.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {data?.media.map((asset) => (
            <button
              key={asset.id}
              onClick={() => copyUrl(asset.url, asset.id)}
              className="group overflow-hidden rounded-xl border bg-background text-left transition hover:border-primary/50"
            >
              <div className="aspect-video w-full overflow-hidden bg-muted">
                {isImage(asset.mimeType) ? (
                  <img
                    src={asset.url}
                    alt={asset.fileName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                    {asset.mimeType}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between gap-2 p-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium">{asset.fileName}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {Math.round(asset.size / 1024)} KB ·{" "}
                    {new Date(asset.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <Copy className="size-3.5 shrink-0 text-muted-foreground" />
              </div>
              {copiedId === asset.id && (
                <div className="bg-primary px-2 py-1 text-center text-[10px] font-medium text-primary-foreground">
                  Copied!
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}