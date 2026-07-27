"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, HomeIcon } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/common";
import { useFolders } from "@/hooks";
import { cn } from "@/lib/utils";

export function Header() {
  const pathname = usePathname();
  const { data: flatFolders = [] } = useFolders();

  const folderId = pathname.match(/^\/folders\/([^/]+)/)?.[1];

  // Walk parentId chain to build the ancestor trail for the active folder.
  const crumbs: typeof flatFolders = [];
  if (folderId) {
    let node = flatFolders.find((f) => f.id === folderId);
    while (node) {
      crumbs.unshift(node);
      const parentId = node.parentId;
      node = parentId ? flatFolders.find((f) => f.id === parentId) : undefined;
    }
  }

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-4" />

      {crumbs.length > 0 && (
        <nav className="flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
          <Link
            href="/dashboard"
            className="flex items-center gap-1 transition-colors hover:text-foreground"
          >
            <HomeIcon className="size-3.5 shrink-0" />
            <span className="hidden sm:inline">Home</span>
          </Link>
          {crumbs.map((c, i) => (
            <span key={c.id} className="flex min-w-0 items-center gap-1">
              <ChevronRight className="size-3.5 shrink-0" />
              <Link
                href={`/folders/${c.id}`}
                className={cn(
                  "truncate",
                  i === crumbs.length - 1
                    ? "font-medium text-foreground"
                    : "transition-colors hover:text-foreground",
                )}
              >
                {c.name}
              </Link>
            </span>
          ))}
        </nav>
      )}

      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />
      </div>
    </header>
  );
}
