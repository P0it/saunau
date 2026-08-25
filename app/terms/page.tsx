import type { Metadata } from "next";
import { LegalScreen } from "@/components/legal/LegalScreen";
import { readLegalDoc } from "@/lib/legal";

export const metadata: Metadata = {
  title: "이용약관",
  description: "사우나우 이용약관",
  alternates: { canonical: "/terms" },
};

export default async function TermsPage() {
  const body = await readLegalDoc("terms");
  return <LegalScreen title="이용약관" body={body} />;
}
