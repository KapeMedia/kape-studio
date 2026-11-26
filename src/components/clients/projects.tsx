"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Plus } from "lucide-react";
import { Badge, Button, Card, Dialog, DialogContent, DialogTrigger, EmptyState, Field, Input, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { createProjectAction, updateProjectAction } from "@/app/actions/clients";
import { formatDate } from "@/lib/utils";

export type ProjectView = { id: string; name: string; description: string; status: "active" | "archived"; createdAt: string; generations: number };

export function NewProjectButton({ clientId, slug }: { clientId: string; slug: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-3.5 w-3.5" /> Proiect nou
        </Button>
      </DialogTrigger>
      <DialogContent title="Proiect nou" description="O campanie sau o lună de lucru.">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await createProjectAction(clientId, { name, description });
              if (r.ok && r.data) {
                setOpen(false);
                router.push(`/clients/${slug}/projects/${r.data.id}`);
              } else if (!r.ok) toast({ title: "Eroare", description: r.error, tone: "error" });
            });
          }}
        >
          <Field label="Nume">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex: Black Friday 2026" autoFocus required />
          </Field>
          <Field label="Descriere">
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <div className="flex justify-end">
            <Button type="submit" loading={pending}>
              Creează
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ProjectsList({ slug, projects }: { slug: string; projects: ProjectView[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (!projects.length) return <EmptyState title="Niciun proiect" description="Creează un proiect ca să începi să generezi bannere." />;
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {projects.map((p) => (
        <Card key={p.id} className="flex items-start justify-between gap-3 p-4">
          <Link href={`/clients/${slug}/projects/${p.id}`} className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium hover:underline">{p.name}</span>
              {p.status === "archived" && <Badge>arhivat</Badge>}
            </div>
            <p className="mt-0.5 line-clamp-2 text-sm text-muted">{p.description || "Fără descriere"}</p>
            <p className="mt-2 text-xs text-muted">
              {p.generations} generări · creat {formatDate(p.createdAt)}
            </p>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            loading={pending}
            aria-label={p.status === "archived" ? "Restaurează" : "Arhivează"}
            title={p.status === "archived" ? "Restaurează" : "Arhivează"}
            onClick={() =>
              start(async () => {
                await updateProjectAction(p.id, { status: p.status === "archived" ? "active" : "archived" });
                router.refresh();
              })
            }
          >
            {p.status === "archived" ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
          </Button>
        </Card>
      ))}
    </div>
  );
}
