'use client'

import React, { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";
import SyncProvider from "./syncProvider";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "./theme-provider";

type Props = {
  children: ReactNode;
};

export default function Providers({ children }: Props) {
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <SyncProvider>
          {children}
          <Toaster />
        </SyncProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
