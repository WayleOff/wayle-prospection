import { MessageSquare } from "lucide-react";
import { Soon } from "@/components/soon";

export const metadata = { title: "Messages" };
export default function Page() {
  return <Soon title="Messages" icon={<MessageSquare size={22} />} text="Le générateur de messages avec Claude et les séquences de relance arrivent à l'étape d." />;
}
