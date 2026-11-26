import { notFound } from "next/navigation";
import { getDb } from "@/server/db/client";
import { getClientBySlug } from "@/server/services/clients";
import { PageHeader } from "@/components/ui";

export default async function ClientPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const client = await getClientBySlug(await getDb(), slug);
  if (!client) notFound();
  return <PageHeader title={client.name} description={client.description} />;
}
