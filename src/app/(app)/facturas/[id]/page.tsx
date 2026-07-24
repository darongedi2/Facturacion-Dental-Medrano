export default async function RevisionFacturaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main className="p-8">
      <p className="text-muted-foreground">Revision de factura {id} — pendiente (paso 5: frontend)</p>
    </main>
  );
}
