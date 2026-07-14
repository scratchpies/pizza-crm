import { Suspense } from "react";
import ContactsClient from "./ContactsClient";

export default function ContactsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-neutral-500">Loading...</div>}>
      <ContactsClient />
    </Suspense>
  );
}
