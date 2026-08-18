"use client";

import { useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function TypeViewTabs({
  siteId,
  typeId,
  active,
}: {
  siteId: string;
  typeId: string;
  active: "content" | "schema";
}) {
  const router = useRouter();
  const base = `/dashboard/cms/sites/${siteId}/types/${typeId}`;

  return (
    <Tabs
      value={active}
      onValueChange={(v) => router.push(`${base}?view=${v}`)}
    >
      <TabsList>
        <TabsTrigger value="content">Content</TabsTrigger>
        <TabsTrigger value="schema">Schema</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}