import { CalendarCheck } from "lucide-react";
import { Soon } from "@/components/soon";

export const metadata = { title: "Aujourd'hui" };
export default function Page() {
  return <Soon title="Aujourd'hui" icon={<CalendarCheck size={22} />} text="Cet écran listera chaque matin les relances du jour, les prospects en retard et les nouveaux à contacter. Il arrive dans une prochaine étape." />;
}
