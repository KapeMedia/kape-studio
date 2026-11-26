import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toast";

export const metadata: Metadata = {
  title: "KAPE Studio",
  description: "Bannere on-brand pentru clienții KAPE Media",
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro">
      <body>
        <Toaster>{children}</Toaster>
      </body>
    </html>
  );
}
