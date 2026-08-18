"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toastError, toastSuccess } from "@/hooks/use-toast";

async function handle<T>(request: Promise<Response>): Promise<T> {
  const res = await request;
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Request failed (${res.status})`);
  }
  return res.json();
}

// --- Sites ---

export function useCmsSites() {
  return useQuery({
    queryKey: ["cms", "sites"],
    queryFn: () => handle<{ sites: any[] }>(fetch("/api/cms/sites")),
  });
}

export function useCmsSite(siteId: string | undefined) {
  return useQuery({
    queryKey: ["cms", "sites", siteId],
    queryFn: () => handle<{ site: any }>(fetch(`/api/cms/sites/${siteId}`)),
    enabled: Boolean(siteId),
  });
}

export function useCreateSite() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      handle<{ site: any }>(
        fetch("/api/cms/sites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }),
      ),
    onSuccess: () => {
      toastSuccess("Site created");
      queryClient.invalidateQueries({ queryKey: ["cms", "sites"] });
      router.refresh();
    },
    onError: (e: Error) => toastError(e.message),
  });
}

export function useUpdateSite(siteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name?: string; description?: string; isActive?: boolean }) =>
      handle<{ site: any }>(
        fetch(`/api/cms/sites/${siteId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }),
      ),
    onSuccess: () => {
      toastSuccess("Site updated");
      queryClient.invalidateQueries({ queryKey: ["cms", "sites"] });
    },
    onError: (e: Error) => toastError(e.message),
  });
}

export function useDeleteSite(siteId: string) {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: () =>
      handle<{ ok: boolean }>(fetch(`/api/cms/sites/${siteId}`, { method: "DELETE" })),
    onSuccess: () => {
      toastSuccess("Site deleted");
      queryClient.invalidateQueries({ queryKey: ["cms", "sites"] });
      router.refresh();
    },
    onError: (e: Error) => toastError(e.message),
  });
}

export function useRegenerateApiKey(siteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      handle<{ apiKey: string }>(fetch(`/api/cms/sites/${siteId}/api-key`, { method: "POST" })),
    onSuccess: () => {
      toastSuccess("API key regenerated");
      queryClient.invalidateQueries({ queryKey: ["cms", "sites", siteId] });
      queryClient.invalidateQueries({ queryKey: ["cms", "sites"] });
    },
    onError: (e: Error) => toastError(e.message),
  });
}

// --- Content types ---

export function useCmsContentTypes(siteId: string | undefined) {
  return useQuery({
    queryKey: ["cms", "sites", siteId, "types"],
    queryFn: () => handle<{ contentTypes: any[] }>(fetch(`/api/cms/sites/${siteId}/types`)),
    enabled: Boolean(siteId),
  });
}

export function useCreateContentType(siteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name?: string; label: string; description?: string }) =>
      handle<{ contentType: any }>(
        fetch(`/api/cms/sites/${siteId}/types`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }),
      ),
    onSuccess: () => {
      toastSuccess("Content type created");
      queryClient.invalidateQueries({ queryKey: ["cms", "sites", siteId, "types"] });
      queryClient.invalidateQueries({ queryKey: ["cms", "sites", siteId] });
    },
    onError: (e: Error) => toastError(e.message),
  });
}

export function useDeleteContentType(siteId: string, typeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      handle<{ ok: boolean }>(
        fetch(`/api/cms/sites/${siteId}/types/${typeId}`, { method: "DELETE" }),
      ),
    onSuccess: () => {
      toastSuccess("Content type deleted");
      queryClient.invalidateQueries({ queryKey: ["cms", "sites", siteId, "types"] });
      queryClient.invalidateQueries({ queryKey: ["cms", "sites", siteId] });
    },
    onError: (e: Error) => toastError(e.message),
  });
}

// --- Fields ---

export function useCreateField(siteId: string, typeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      handle<{ field: any }>(
        fetch(`/api/cms/sites/${siteId}/types/${typeId}/fields`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }),
      ),
    onSuccess: () => {
      toastSuccess("Field added");
      queryClient.invalidateQueries({ queryKey: ["cms", "sites", siteId, "types"] });
    },
    onError: (e: Error) => toastError(e.message),
  });
}

export function useUpdateField(siteId: string, typeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { fieldId: string } & Record<string, unknown>) => {
      const { fieldId, ...rest } = data;
      return handle<{ field: any }>(
        fetch(`/api/cms/sites/${siteId}/types/${typeId}/fields/${fieldId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(rest),
        }),
      );
    },
    onSuccess: () => {
      toastSuccess("Field updated");
      queryClient.invalidateQueries({ queryKey: ["cms", "sites", siteId, "types"] });
    },
    onError: (e: Error) => toastError(e.message),
  });
}

export function useDeleteField(siteId: string, typeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fieldId: string) =>
      handle<{ ok: boolean }>(
        fetch(`/api/cms/sites/${siteId}/types/${typeId}/fields/${fieldId}`, {
          method: "DELETE",
        }),
      ),
    onSuccess: () => {
      toastSuccess("Field deleted");
      queryClient.invalidateQueries({ queryKey: ["cms", "sites", siteId, "types"] });
    },
    onError: (e: Error) => toastError(e.message),
  });
}

// --- Entries ---

export function useCmsEntries(siteId: string | undefined, typeId: string | undefined) {
  return useQuery({
    queryKey: ["cms", "sites", siteId, "types", typeId, "entries"],
    queryFn: () =>
      handle<{ entries: any[] }>(
        fetch(`/api/cms/sites/${siteId}/types/${typeId}/entries`),
      ),
    enabled: Boolean(siteId && typeId),
  });
}

export function useCmsEntry(
  siteId: string | undefined,
  typeId: string | undefined,
  entryId: string | undefined,
) {
  return useQuery({
    queryKey: ["cms", "sites", siteId, "types", typeId, "entries", entryId],
    queryFn: () =>
      handle<{ entry: any }>(
        fetch(`/api/cms/sites/${siteId}/types/${typeId}/entries/${entryId}`),
      ),
    enabled: Boolean(siteId && typeId && entryId),
  });
}

export function useCreateEntry(siteId: string, typeId: string) {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: (data: { payload: Record<string, unknown>; status?: "DRAFT" | "PUBLISHED" }) =>
      handle<{ entry: any }>(
        fetch(`/api/cms/sites/${siteId}/types/${typeId}/entries`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }),
      ),
    onSuccess: () => {
      toastSuccess("Entry created");
      queryClient.invalidateQueries({ queryKey: ["cms", "sites", siteId, "types", typeId, "entries"] });
      router.refresh();
    },
    onError: (e: Error) => toastError(e.message),
  });
}

export function useUpdateEntry(siteId: string, typeId: string, entryId: string) {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: (data: {
      payload?: Record<string, unknown>;
      status?: "DRAFT" | "PUBLISHED";
      slug?: string;
      title?: string;
    }) =>
      handle<{ entry: any }>(
        fetch(`/api/cms/sites/${siteId}/types/${typeId}/entries/${entryId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }),
      ),
    onSuccess: () => {
      toastSuccess("Entry saved");
      queryClient.invalidateQueries({ queryKey: ["cms", "sites", siteId, "types", typeId, "entries"] });
      router.refresh();
    },
    onError: (e: Error) => toastError(e.message),
  });
}

export function useDeleteEntry(siteId: string, typeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (entryId: string) =>
      handle<{ ok: boolean }>(
        fetch(`/api/cms/sites/${siteId}/types/${typeId}/entries/${entryId}`, {
          method: "DELETE",
        }),
      ),
    onSuccess: () => {
      toastSuccess("Entry deleted");
      queryClient.invalidateQueries({ queryKey: ["cms", "sites", siteId, "types", typeId, "entries"] });
    },
    onError: (e: Error) => toastError(e.message),
  });
}

// --- Media ---

export function useCmsMedia(siteId: string | undefined) {
  return useQuery({
    queryKey: ["cms", "sites", siteId, "media"],
    queryFn: () => handle<{ media: any[] }>(fetch(`/api/cms/sites/${siteId}/media`)),
    enabled: Boolean(siteId),
  });
}

export function useUploadMedia(siteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return handle<{ media: any }>(
        fetch(`/api/cms/sites/${siteId}/media`, {
          method: "POST",
          body: formData,
        }),
      );
    },
    onSuccess: () => {
      toastSuccess("File uploaded");
      queryClient.invalidateQueries({ queryKey: ["cms", "sites", siteId, "media"] });
    },
    onError: (e: Error) => toastError(e.message),
  });
}