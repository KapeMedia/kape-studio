import Link from "next/link";
import { cn } from "@/lib/utils";

export function ButtonLink({
  href,
  children,
  variant = "primary",
  className,
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "outline" | "ghost";
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-9 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium whitespace-nowrap",
        variant === "primary" && "bg-accent text-white hover:bg-accent-hover",
        variant === "outline" && "border bg-white hover:bg-gray-50",
        variant === "ghost" && "text-gray-700 hover:bg-gray-100",
        className,
      )}
    >
      {children}
    </Link>
  );
}
