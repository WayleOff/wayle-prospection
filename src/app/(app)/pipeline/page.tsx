import { Columns3 } from "lucide-react";
import { Soon } from "@/components/soon";

export const metadata = { title: "Pipeline" };
export default function Page() {
  return <Soon title="Pipeline" icon={<Columns3 size={22} />} text="Le tableau par colonnes (À contacter, Contacté, Répondu…) avec glisser-déposer arrive à l'étape suivante." />;
}
