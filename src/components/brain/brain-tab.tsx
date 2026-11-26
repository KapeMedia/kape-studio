import { EmptyState } from "@/components/ui";

export async function BrainTab({ clientId }: { clientId: string }) {
  void clientId;
  return <EmptyState title="Brain gol" description="Regulile învățate din feedback vor apărea aici." />;
}
