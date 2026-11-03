"use client";

import { Toaster } from "sonner";

import { AuthProvider } from "@/components/auth-provider";
import { PwaRegister } from "@/components/pwa-register";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      {children}
      <PwaRegister />
      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          style: {
            background: "#101216",
            border: "1px solid #23262d",
            color: "#f4f4f5",
          },
        }}
      />
    </AuthProvider>
  );
}
