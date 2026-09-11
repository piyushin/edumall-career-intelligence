"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BrandLogo } from "../../components/brand-logo";
import { ApiError } from "../../lib/api";
import { signup, type PublicSignupSegment } from "../../lib/auth";

const segmentOptions: readonly { value: PublicSignupSegment; label: string; helper: string }[] = [
  { value: "SCHOOL_6_8", label: "School — Classes 6 to 8", helper: "Early career discovery" },
  {
    value: "SCHOOL_9_10",
    label: "School — Classes 9 to 10",
    helper: "Stream and career direction",
  },
  {
    value: "SCHOOL_11_12",
    label: "School — Classes 11 to 12",
    helper: "Career and course selection",
  },
  { value: "COLLEGE", label: "College / UG / PG", helper: "Career and employability intelligence" },
  { value: "PROFESSIONAL", label: "Working Professional", helper: "Career growth and transition" },
  {
    value: "SKILLED_WORKFORCE",
    label: "Skilled / Blue-Collar Workforce",
    helper: "Skill and job-family fit",
  },
];

export function SignupForm() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [segment, setSegment] = useState<PublicSignupSegment>("SCHOOL_11_12");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!accepted) {
      setError("Please confirm that you understand the pilot and counsellor-guidance notice.");
      return;
    }

    setSubmitting(true);
    try {
      await signup({
        firstName,
        lastName,
        email,
        mobile: `${countryCode}${mobile}`,
        password,
        segment,
      });
      router.replace("/candidate/assessments");
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Unable to create your account. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#fff8f3] via-white to-orange-50 px-5 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto grid w-full max-w-6xl overflow-hidden rounded-[32px] border border-orange-100 bg-white shadow-2xl shadow-orange-100 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="relative overflow-hidden bg-gradient-to-br from-red-600 via-red-500 to-orange-500 p-8 text-white sm:p-10 lg:p-12">
          <div className="absolute -right-20 -top-20 h-60 w-60 rounded-full bg-white/10" />
          <Link href="/" className="relative inline-block rounded-2xl bg-white px-4 py-2 shadow-lg">
            <BrandLogo className="h-auto w-[170px]" priority />
          </Link>
          <p className="relative mt-10 text-xs font-black uppercase tracking-[0.18em] text-orange-100">
            Create your Career Intelligence account
          </p>
          <h1 className="relative mt-4 text-4xl font-black leading-tight sm:text-5xl">
            Your next direction starts with understanding yourself.
          </h1>
          <div className="relative mt-8 space-y-4 text-sm leading-6 text-red-50">
            <p>✓ Select the assessment segment that matches your current stage.</p>
            <p>✓ Your account is automatically assigned the relevant pilot assessment.</p>
            <p>✓ Complete it securely from your candidate workspace.</p>
            <p>✓ Important findings should be discussed with an authorised counsellor.</p>
          </div>
          <div className="relative mt-8 rounded-2xl border border-white/20 bg-white/10 p-5 text-xs leading-5 text-white/90">
            Public signup creates candidate access only. Counsellor and administrator accounts
            remain controlled and invite-only.
          </div>
        </section>

        <section className="p-7 sm:p-10 lg:p-12">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-extrabold text-red-600">Secure candidate signup</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                Create your account
              </h2>
            </div>
            <Link href="/login" className="text-sm font-bold text-red-600 hover:text-red-700">
              Login
            </Link>
          </div>
          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-bold text-slate-800">First name</span>
                <input
                  required
                  maxLength={100}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-red-400 focus:ring-4 focus:ring-red-50"
                />
              </label>
              <label className="block">
                <span className="text-sm font-bold text-slate-800">Last name</span>
                <input
                  required
                  maxLength={100}
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-red-400 focus:ring-4 focus:ring-red-50"
                />
              </label>
            </div>
            <label className="block">
              <span className="text-sm font-bold text-slate-800">Email</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-red-400 focus:ring-4 focus:ring-red-50"
              />
            </label>
            <fieldset>
              <legend className="text-sm font-bold text-slate-800">Mobile number</legend>
              <div className="mt-2 grid grid-cols-[7rem_1fr] gap-3">
                <label>
                  <span className="sr-only">Country code</span>
                  <input
                    type="tel"
                    required
                    inputMode="tel"
                    autoComplete="tel-country-code"
                    aria-label="Country code"
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    placeholder="+91"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-red-400 focus:ring-4 focus:ring-red-50"
                  />
                </label>
                <label>
                  <span className="sr-only">Mobile number</span>
                  <input
                    type="tel"
                    required
                    inputMode="numeric"
                    autoComplete="tel-national"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="Mobile number"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-red-400 focus:ring-4 focus:ring-red-50"
                  />
                </label>
              </div>
              <span className="mt-1 block text-xs text-slate-500">
                Include the international country code. No OTP is required in this release.
              </span>
            </fieldset>
            <label className="block">
              <span className="text-sm font-bold text-slate-800">I am a...</span>
              <select
                value={segment}
                onChange={(e) => setSegment(e.target.value as PublicSignupSegment)}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none transition focus:border-red-400 focus:ring-4 focus:ring-red-50"
              >
                {segmentOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} — {option.helper}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-bold text-slate-800">Password</span>
                <input
                  type="password"
                  required
                  minLength={12}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-red-400 focus:ring-4 focus:ring-red-50"
                />
                <span className="mt-1 block text-xs text-slate-500">
                  Use at least 12 characters.
                </span>
              </label>
              <label className="block">
                <span className="text-sm font-bold text-slate-800">Confirm password</span>
                <input
                  type="password"
                  required
                  minLength={12}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-red-400 focus:ring-4 focus:ring-red-50"
                />
              </label>
            </div>
            <label className="flex items-start gap-3 rounded-2xl bg-orange-50 p-4 text-sm leading-6 text-slate-700">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                className="mt-1 h-4 w-4 accent-red-600"
              />
              <span>
                I understand this is a controlled pilot/research edition. Career recommendations are
                indicative, not prescriptive, and important decisions should be discussed with a
                counsellor.
              </span>
            </label>
            {error ? (
              <div
                role="alert"
                className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800"
              >
                {error}
              </div>
            ) : null}
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-2xl bg-gradient-to-r from-red-600 to-orange-500 px-5 py-3.5 text-sm font-black text-white shadow-lg shadow-red-100 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Creating your account..." : "Create account & start"}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-slate-500">
            Already registered?{" "}
            <Link href="/login" className="font-black text-red-600">
              Login here
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
