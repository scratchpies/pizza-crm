import { Suspense } from "react";
import LeadsClient from "./LeadsClient";

export default function LeadsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-neutral-500">Loading...</div>}>
      <LeadsClient />
    </Suspense>
  );
}
