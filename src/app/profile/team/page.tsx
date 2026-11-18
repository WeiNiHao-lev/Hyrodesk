"use client";

import { Admin } from "@/components/profile/sections";
import { useAuth } from "@/lib/store/auth";
import { useT } from "@/lib/i18n";

export default function TeamPage() {
  const t = useT();
  const me = useAuth((s) => s.me);
  if (!me?.isAdmin) return <p className="text-[0.8rem] text-ink-500">{t("Only the administrator manages the team.")}</p>;
  return <Admin />;
}
