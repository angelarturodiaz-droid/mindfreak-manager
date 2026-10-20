import { redirect } from "next/navigation";

/** La encuesta ahora está en Configuración → Mensajes al cliente (tipo Encuesta). */
export default function SurveySettingsPage() {
  redirect("/settings/messages?tipo=encuesta");
}
