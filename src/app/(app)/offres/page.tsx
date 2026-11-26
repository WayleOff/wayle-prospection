import { Package } from "lucide-react";
import { Soon } from "@/components/soon";

export const metadata = { title: "Offres" };
export default function Page() {
  return <Soon title="Offres" icon={<Package size={22} />} text="Les offres, devis et le PDF arrivent dans une prochaine étape." />;
}
