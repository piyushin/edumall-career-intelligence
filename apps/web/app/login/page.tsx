import { Suspense } from "react";
import { LoginForm } from "./login-form";

function LoginFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#fff8f3] px-6 py-12">
      <div className="w-full max-w-md rounded-2xl border border-orange-100 bg-white p-8 shadow-xl shadow-orange-100">
        <p className="text-sm font-semibold text-slate-600">Loading secure login...</p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  );
}
