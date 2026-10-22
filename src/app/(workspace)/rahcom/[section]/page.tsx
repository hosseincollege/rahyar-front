import { notFound } from 'next/navigation';
import { RahcomSectionPage, type RahcomSection } from '../rahcom-section';

const sections = new Set<RahcomSection>(['map', 'actions', 'systems', 'daily-traffic', 'solar-daily']);

export default async function RahcomSubpage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!sections.has(section as RahcomSection)) notFound();
  return <RahcomSectionPage section={section as RahcomSection} />;
}
