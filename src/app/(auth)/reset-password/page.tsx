import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/forms/reset-password-form";

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background text-foreground p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link
          className="flex items-center gap-2 self-center font-medium"
          href="/"
        >
          <div className="flex size-6 items-center justify-center rounded-md">
            <Image
              alt="Logo"
              height={50}
              priority
              src={"/logo.png"}
              width={50}
              style={{ width: "auto", height: "auto" }}
            />
          </div>
          WordingsAI
        </Link>
        <Suspense fallback={<div>Loading...</div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
