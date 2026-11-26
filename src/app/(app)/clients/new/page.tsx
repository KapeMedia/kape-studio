import { Card, CardContent, PageHeader } from "@/components/ui";
import { ClientForm } from "@/components/clients/client-form";

export default function NewClientPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Client nou" description="Toate câmpurile, în afară de nume, sunt opționale. Logo-ul, culorile și fonturile le adaugi apoi în Brand kit." />
      <Card>
        <CardContent>
          <ClientForm />
        </CardContent>
      </Card>
    </div>
  );
}
