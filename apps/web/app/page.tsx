import Link from "next/link";
import { BrandLogo } from "../components/brand-logo";

const segments = [
  {
    key: "6–8",
    title: "Early Career Discovery",
    audience: "Classes 6–8",
    time: "~20 min",
    description:
      "Explore interests, personality, learning preferences, strengths and early career possibilities.",
    accent: "from-orange-50 to-amber-100 border-orange-200",
  },
  {
    key: "9–10",
    title: "Stream & Career Direction",
    audience: "Classes 9–10",
    time: "~30 min",
    description:
      "Understand suitable streams, career clusters, aptitude patterns and the directions worth exploring.",
    accent: "from-red-50 to-orange-100 border-red-200",
  },
  {
    key: "11–12",
    title: "Career & Course Selection",
    audience: "Classes 11–12",
    time: "~40 min",
    description:
      "Connect your profile with career pathways, course choices and a structured next-step roadmap.",
    accent: "from-rose-50 to-red-100 border-rose-200",
  },
  {
    key: "UG/PG",
    title: "Career & Employability Intelligence",
    audience: "College / UG / PG",
    time: "~45 min",
    description:
      "Explore career direction, employability strengths, motivators and job-family fit before graduation or transition.",
    accent: "from-amber-50 to-yellow-100 border-amber-200",
  },
  {
    key: "PRO",
    title: "Career Growth & Transition",
    audience: "Professionals",
    time: "~40 min",
    description:
      "Understand work personality, competencies, motivators and possible career-growth or transition directions.",
    accent: "from-orange-50 to-red-100 border-orange-200",
  },
  {
    key: "SKILL",
    title: "Skill & Job-Fit Assessment",
    audience: "Skilled Workforce",
    time: "~35 min",
    description:
      "Identify practical strengths, workstyle, safety orientation, job-family fit and upskilling priorities.",
    accent: "from-yellow-50 to-orange-100 border-yellow-200",
  },
] as const;

const insights = [
  [
    "Personality",
    "Understand patterns in how you approach people, tasks, change and responsibility.",
  ],
  [
    "Career Interests",
    "See the fields and activities that naturally attract your attention and energy.",
  ],
  [
    "Abilities & Aptitude",
    "Explore reasoning and ability evidence included in the assessment for your segment.",
  ],
  ["Motivators", "Understand what may influence satisfaction, persistence and career choices."],
  [
    "Learning Preferences",
    "Recognise the ways you prefer to engage with learning and new information.",
  ],
  [
    "Work Style",
    "Understand patterns related to collaboration, organisation, initiative and adaptability.",
  ],
  [
    "CareerFit",
    "Receive indicative career or job-family recommendations derived from your assessment responses.",
  ],
  [
    "Development Roadmap",
    "Turn insight into practical next steps for learning, exploration and counselling.",
  ],
] as const;

const steps = [
  [
    "01",
    "Create your account",
    "Sign up securely and tell us which assessment segment is right for you.",
  ],
  [
    "02",
    "Complete the assessment",
    "Answer thoughtfully. Personality and preference questions do not have good or bad answers.",
  ],
  [
    "03",
    "Build your Career Intelligence profile",
    "Your responses move through deterministic scoring and governed interpretation rules.",
  ],
  [
    "04",
    "Explore CareerFit directions",
    "Review ranked, indicative career or job-family directions relevant to your segment.",
  ],
  [
    "05",
    "Validate with a counsellor",
    "Discuss important findings before making major educational, career or employment decisions.",
  ],
] as const;

const faqs = [
  [
    "Is this an exam?",
    "No. Some sections may include ability questions, while others explore interests, preferences, motivators and workstyle. The purpose is structured career discovery, not pass/fail ranking.",
  ],
  [
    "Will the system choose my career for me?",
    "No. Career recommendations are indicative, not prescriptive. They are designed to support exploration and counsellor-guided decision making.",
  ],
  [
    "Can parents use the report?",
    "Yes. The report can create a better conversation between students, parents and counsellors by making strengths, preferences and possible directions visible.",
  ],
  [
    "Can schools, colleges or organisations use it in groups?",
    "Yes. The platform supports organisation-based assessment assignment, candidate delivery, staff review and report release workflows.",
  ],
] as const;

export default function HomePage() {
  const registrationEnabled = process.env.NEXT_PUBLIC_REGISTRATION_ENABLED !== "false";

  return (
    <main className="min-h-screen bg-[#fffaf6] text-slate-950">
      <header className="sticky top-0 z-50 border-b border-orange-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-5 py-3 sm:px-6">
          <Link href="/" aria-label="The EduMall Career Intelligence home">
            <BrandLogo priority className="h-auto w-[148px] sm:w-[172px]" />
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-semibold text-slate-700 lg:flex">
            <a href="#assessments" className="transition hover:text-red-600">
              Assessments
            </a>
            <a href="#how-it-works" className="transition hover:text-red-600">
              How it works
            </a>
            <a href="#discover" className="transition hover:text-red-600">
              What you discover
            </a>
            <a href="#institutions" className="transition hover:text-red-600">
              For institutions
            </a>
            <a href="#faq" className="transition hover:text-red-600">
              FAQ
            </a>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/login"
              className="rounded-full border border-red-200 bg-white px-4 py-2 text-sm font-bold text-red-700 transition hover:border-red-300 hover:bg-red-50"
            >
              Login
            </Link>
            {registrationEnabled ? (
              <Link
                href="/signup"
                className="rounded-full bg-gradient-to-r from-red-600 to-orange-500 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-orange-200 transition hover:-translate-y-0.5"
              >
                Sign up
              </Link>
            ) : null}
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-orange-100 bg-white">
        <div className="absolute -left-24 top-16 h-64 w-64 rounded-full bg-red-100 blur-3xl" />
        <div className="absolute -right-20 top-8 h-80 w-80 rounded-full bg-orange-100 blur-3xl" />
        <div className="mx-auto grid max-w-7xl gap-12 px-6 py-16 sm:py-20 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:py-24">
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-orange-700">
              Controlled Pilot • Research Edition 2026
            </div>
            <h1 className="mt-7 max-w-4xl text-5xl font-black tracking-[-0.04em] text-slate-950 sm:text-6xl lg:text-7xl">
              Discover who you are. <span className="text-red-600">Choose your direction.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600 sm:text-xl">
              The EduMall Career Intelligence helps school students, college learners, professionals
              and skilled workers understand their profile, explore CareerFit directions and move
              forward with counsellor-guided clarity.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              {registrationEnabled ? (
                <Link
                  href="/signup"
                  className="rounded-2xl bg-gradient-to-r from-red-600 via-red-500 to-orange-500 px-6 py-3.5 text-base font-extrabold text-white shadow-xl shadow-red-200 transition hover:-translate-y-0.5"
                >
                  Start my assessment
                </Link>
              ) : null}
              <Link
                href="/login"
                className="rounded-2xl border border-slate-200 bg-white px-6 py-3.5 text-base font-extrabold text-slate-800 shadow-sm transition hover:border-orange-200 hover:bg-orange-50"
              >
                Already registered? Login
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-7 gap-y-2 text-sm font-medium text-slate-600">
              <span>✓ Six age/career segments</span>
              <span>✓ Secure candidate workspace</span>
              <span>✓ Counsellor-reviewed report workflow</span>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 rounded-[40px] bg-gradient-to-br from-red-100 via-orange-100 to-yellow-100 blur-xl" />
            <div className="relative overflow-hidden rounded-[36px] border border-orange-100 bg-[#fff7ef] p-7 shadow-2xl shadow-orange-100 sm:p-9">
              <BrandLogo className="h-auto w-[230px]" />
              <p className="mt-6 text-sm font-extrabold uppercase tracking-[0.18em] text-red-600">
                Career Intelligence Journey
              </p>
              <div className="mt-6 space-y-3">
                {[
                  "Assess",
                  "Understand",
                  "Discover CareerFit",
                  "Counsellor Review",
                  "Get Your Report",
                ].map((label, index) => (
                  <div
                    key={label}
                    className="flex items-center gap-4 rounded-2xl border border-white bg-white/90 p-4 shadow-sm"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-red-600 to-orange-500 text-sm font-black text-white">
                      {index + 1}
                    </span>
                    <span className="font-bold text-slate-800">{label}</span>
                  </div>
                ))}
              </div>
              <div className="mt-6 rounded-2xl bg-slate-950 p-5 text-sm leading-6 text-slate-200">
                <span className="font-bold text-orange-300">Important:</span> Career recommendations
                are indicative, not prescriptive. Discuss important decisions with your counsellor.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="assessments" className="mx-auto max-w-7xl px-6 py-20 sm:py-24">
        <div className="max-w-3xl">
          <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-red-600">
            Find your assessment
          </p>
          <h2 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
            Which Career Intelligence journey is right for you?
          </h2>
          <p className="mt-5 text-lg leading-8 text-slate-600">
            Choose the segment that matches where you are today. Each battery is designed around a
            different educational or work-life decision.
          </p>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {segments.map((segment) => (
            <article
              key={segment.key}
              className={`group rounded-[28px] border bg-gradient-to-br ${segment.accent} p-6 transition hover:-translate-y-1 hover:shadow-xl`}
            >
              <div className="flex items-start justify-between gap-4">
                <span className="rounded-full bg-white px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-red-600 shadow-sm">
                  {segment.audience}
                </span>
                <span className="text-sm font-bold text-slate-500">{segment.time}</span>
              </div>
              <h3 className="mt-6 text-2xl font-black tracking-tight text-slate-950">
                {segment.title}
              </h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">{segment.description}</p>
              {registrationEnabled ? (
                <Link
                  href="/signup"
                  className="mt-6 inline-flex items-center gap-2 text-sm font-black text-red-700"
                >
                  Start this assessment <span aria-hidden="true">→</span>
                </Link>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="bg-slate-950 py-20 text-white sm:py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="max-w-3xl">
            <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-orange-300">
              Simple and guided
            </p>
            <h2 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">How it works</h2>
            <p className="mt-5 text-lg leading-8 text-slate-300">
              From first login to report release, the experience is designed to keep the candidate
              informed at every step.
            </p>
          </div>
          <div className="mt-10 grid gap-4 lg:grid-cols-5">
            {steps.map(([number, title, description]) => (
              <div
                key={number}
                className="rounded-[26px] border border-white/10 bg-white/5 p-5 backdrop-blur"
              >
                <span className="text-3xl font-black text-orange-300">{number}</span>
                <h3 className="mt-5 text-lg font-black">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-300">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="discover" className="mx-auto max-w-7xl px-6 py-20 sm:py-24">
        <div className="grid gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:items-start">
          <div className="lg:sticky lg:top-28">
            <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-red-600">
              Your profile, made understandable
            </p>
            <h2 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
              What will you discover?
            </h2>
            <p className="mt-5 text-lg leading-8 text-slate-600">
              Your report is designed to turn assessment evidence into language that candidates,
              parents and counsellors can discuss together.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {insights.map(([title, description], index) => (
              <article
                key={title}
                className="rounded-[24px] border border-orange-100 bg-white p-6 shadow-sm"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-red-600 to-orange-500 text-lg font-black text-white">
                  {index + 1}
                </div>
                <h3 className="mt-5 text-xl font-black">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="institutions" className="border-y border-orange-100 bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-5 lg:grid-cols-3">
            <article className="rounded-[30px] bg-gradient-to-br from-red-600 to-red-500 p-8 text-white shadow-xl shadow-red-100">
              <p className="text-xs font-black uppercase tracking-[0.15em] text-red-100">
                For parents
              </p>
              <h3 className="mt-4 text-3xl font-black">Better conversations, less guesswork.</h3>
              <p className="mt-4 text-sm leading-7 text-red-50">
                Use the report to discuss interests, strengths, evidence and options—without
                treating one score as destiny.
              </p>
            </article>
            <article className="rounded-[30px] bg-gradient-to-br from-orange-500 to-amber-400 p-8 text-white shadow-xl shadow-orange-100">
              <p className="text-xs font-black uppercase tracking-[0.15em] text-orange-50">
                For schools & colleges
              </p>
              <h3 className="mt-4 text-3xl font-black">Career guidance at cohort scale.</h3>
              <p className="mt-4 text-sm leading-7 text-orange-50">
                Organisation-based assignment, candidate delivery, staff review and controlled
                report release support structured guidance programmes.
              </p>
            </article>
            <article className="rounded-[30px] bg-slate-950 p-8 text-white shadow-xl shadow-slate-200">
              <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-300">
                For organisations
              </p>
              <h3 className="mt-4 text-3xl font-black">Development and job-fit insights.</h3>
              <p className="mt-4 text-sm leading-7 text-slate-300">
                Professional and skilled-workforce assessments can support development
                conversations. Results must not be the sole basis for recruitment, rejection,
                promotion or termination.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section id="faq" className="mx-auto max-w-5xl px-6 py-20 sm:py-24">
        <div className="text-center">
          <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-red-600">
            Questions before you begin?
          </p>
          <h2 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
            Frequently asked questions
          </h2>
        </div>
        <div className="mt-10 space-y-3">
          {faqs.map(([question, answer]) => (
            <details
              key={question}
              className="group rounded-2xl border border-orange-100 bg-white p-5 shadow-sm open:shadow-md"
            >
              <summary className="cursor-pointer list-none text-base font-black text-slate-900">
                {question}
              </summary>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="px-6 pb-20">
        <div className="mx-auto max-w-7xl overflow-hidden rounded-[36px] bg-gradient-to-r from-red-600 via-red-500 to-orange-500 px-7 py-10 text-white shadow-2xl shadow-orange-200 sm:px-10 lg:flex lg:items-center lg:justify-between lg:gap-8">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-orange-100">
              Your career deserves more than guesswork.
            </p>
            <h2 className="mt-3 text-3xl font-black sm:text-4xl">
              Discover • Understand • Decide • Succeed
            </h2>
          </div>
          <div className="mt-7 flex flex-wrap gap-3 lg:mt-0">
            {registrationEnabled ? (
              <Link
                href="/signup"
                className="rounded-2xl bg-white px-6 py-3 font-black text-red-600 shadow-lg"
              >
                Start assessment
              </Link>
            ) : null}
            <Link
              href="/login"
              className="rounded-2xl border border-white/40 bg-white/10 px-6 py-3 font-black text-white"
            >
              Login
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-orange-100 bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 py-10 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <BrandLogo className="h-auto w-[160px]" />
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500">
              Career Intelligence is an initiative of Meetium Pvt. Ltd. This public experience is
              currently a controlled pilot/research edition and does not claim
              population-standardised norms.
            </p>
          </div>
          <div className="text-sm leading-6 text-slate-600 md:text-right">
            <p className="font-bold text-slate-900">The EduMall, Kudasan, Gandhinagar</p>
            <p>+91 82381 03232 • +91 85115 50150</p>
            <p>careeradTEM@gmail.com • www.theedumall.com</p>
            <Link
              href="/status"
              className="mt-2 inline-block text-xs font-semibold text-slate-400 hover:text-red-600"
            >
              Service status
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
