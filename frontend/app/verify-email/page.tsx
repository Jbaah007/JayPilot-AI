import { Suspense } from "react";
import VerifyEmailForm from "./VerifyEmailForm";

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
          Loading verification...
        </div>
      }
    >
      <VerifyEmailForm />
    </Suspense>
  );
}
