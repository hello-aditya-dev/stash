"use client";

import React from "react";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <Toaster position="top-center" richColors closeButton />
      {children}
    </AuthProvider>
  );
}
