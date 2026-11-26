import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/server/db/client";
import { getEditorData } from "@/server/services/editor";
import { listBrandAssets } from "@/server/services/clients";
import { Badge } from "@/components/ui";
import { VariantEditorLazy } from "@/editor/lazy";
import { QaPanel } from "@/components/variants/qa-panel";
import { VariantStatusBar } from "@/components/variants/status-bar";
import { FeedbackPanel } from "@/components/brain/feedback-panel";
import { listFeedbackForVariant } from "@/server/services/brain/feedback";

export default async function VariantPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const db = await getDb();
  const data = await getEditorData(db, id);
  if (!data || data.client.slug !== slug) notFound();
  const { variant, client, project, style, styleVersion, template, brand, formats } = data;
  const fonts = (await listBrandAssets(db, client.id)).filter((a) => a.type === "font");
  const feedbackItems = await listFeedbackForVariant(db, variant.id);

  return (
    <div className="mx-auto max-w-[1400px]">
      <div className="mb-1 text-sm text-muted">
        <Link href={`/clients/${slug}`} className="hover:underline">
          {client.name}
        </Link>{" "}
        /{" "}
        <Link href={`/clients/${slug}/projects/${project.id}`} className="hover:underline">
          {project.name}
        </Link>{" "}
        / Varianta #{variant.index}
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight">Varianta #{variant.index}</h1>
          <Badge tone="accent">{variant.angle}</Badge>
          {style && (
            <Badge>
              {style.name} v{styleVersion?.version}
            </Badge>
          )}
          <span className="text-xs text-muted">versiune document {variant.documentVersion}</span>
        </div>
        <VariantStatusBar variantId={variant.id} status={variant.status} />
      </div>
      {variant.status === "pending" ? (
        <p className="rounded-lg border p-8 text-center text-sm text-muted">Imaginea se generează. Revino în câteva secunde.</p>
      ) : variant.status === "failed" && !Object.keys(variant.documents).length ? (
        <p className="rounded-lg border border-red-200 bg-red-50 p-8 text-center text-sm text-red-700">{variant.error ?? "Varianta a eșuat."}</p>
      ) : (
        <VariantEditorLazy
          key={variant.id}
          variantId={variant.id}
          initialDocs={variant.documents}
          documentVersion={variant.documentVersion}
          masterFormatKey={variant.masterFormatKey}
          copy={variant.copy}
          formats={formats.map((f) => ({ key: f.key, label: f.label, width: f.width, height: f.height, safeZone: f.safeZone, enabled: f.enabled }))}
          template={template ? { id: template.id, definition: template.definition } : null}
          brand={{
            palette: brand.palette,
            fonts: brand.fonts,
            fontSources: brand.fontSources,
            fontNames: fonts.map((f) => ({ family: `brand-${f.id}`, label: `${f.meta.family ?? f.name} (${f.meta.role === "body" ? "text" : "titluri"})` })),
            logo: brand.logo,
            logoLight: brand.logoLight,
            photos: brand.photos,
            colors: client.colors.map((c) => ({ name: c.name, hex: c.hex })),
          }}
          names={{ client: client.name, project: project.name, style: style?.name ?? null, index: variant.index }}
          sidebarExtra={
            <>
              <QaPanel qa={variant.qa} />
              <FeedbackPanel variantId={variant.id} clientId={client.id} slug={slug} items={feedbackItems} />
              {variant.rationale && (
                <div className="rounded-lg border bg-white p-3 text-xs text-muted">
                  <div className="mb-1 font-semibold tracking-wide text-gray-500 uppercase">De ce</div>
                  {variant.rationale}
                </div>
              )}
            </>
          }
        />
      )}
    </div>
  );
}
