import { Suspense, type ReactNode } from "react";
import { Shell } from "@/components/shell";

export default function AppLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={null}><Shell>{children}</Shell></Suspense>;
}
