import { BarChart3 } from "lucide-react";
import { Soon } from "@/components/soon";

export const metadata = { title: "Statistiques" };
export default function Page() {
  return <Soon title="Statistiques" icon={<BarChart3 size={22} />} text="Les tableaux de bord (conversion, activité, délais) arrivent dans une prochaine étape." />;
}
