import { EmptyState } from "@/components/ui";

export async function HistoryTab(props: { clientId: string; slug: string; status?: string; projectId?: string; projects: { id: string; name: string }[] }) {
  void props;
  return <EmptyState title="Nicio generare încă" />;
}
