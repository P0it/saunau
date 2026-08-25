import type { Metadata } from "next";
import { LegalScreen } from "@/components/legal/LegalScreen";
import { readLegalDoc } from "@/lib/legal";

export const metadata: Metadata = {
  title: "개인정보처리방침",
  description: "사우나우 개인정보처리방침",
  alternates: { canonical: "/privacy" },
};

export default async function PrivacyPage() {
  const body = await readLegalDoc("privacy");
  return <LegalScreen title="개인정보처리방침" body={body} />;
}
