import { notFound } from "next/navigation";
import { SoloGameShell } from "@/components/minigames/solo/SoloGameShell";
import { getSoloGameBySlug } from "@/lib/minigames/solo/registry";

export default async function SoloGamePage({ params }: { params: Promise<{ game: string }> }) {
  const { game: slug } = await params;
  const game = getSoloGameBySlug(slug);
  if (!game) notFound();
  return <SoloGameShell gameType={game.key} />;
}
