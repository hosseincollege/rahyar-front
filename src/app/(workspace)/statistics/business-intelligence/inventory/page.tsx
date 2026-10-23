import { redirect } from "next/navigation";

export default function LegacyInventoryReportPage() {
  redirect("/statistics/reports/inventory");
}
