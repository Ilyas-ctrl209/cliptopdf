import PdfReaderClient from "./PdfReaderClient";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function PdfPage({ params }: PageProps) {
  const { id } = await params;
  return <PdfReaderClient id={id} />;
}
