"use client";

import { useParams } from "next/navigation";
import { PrepareView } from "@/components/views/PrepareView";

export default function ProjectPrepare() {
  const { id } = useParams<{ id: string }>();
  return <PrepareView projectId={id} />;
}
