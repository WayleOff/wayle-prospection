import { Map } from "lucide-react";
import { Soon } from "@/components/soon";

export const metadata = { title: "Carte" };
export default function Page() {
  return <Soon title="Carte" icon={<Map size={22} />} text="La carte de Rouen avec les prospects à visiter arrive dans une prochaine étape." />;
}
