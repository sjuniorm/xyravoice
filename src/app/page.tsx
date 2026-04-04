import Image from "next/image";
import Link from "next/link";
import { Phone, GitBranch, Shield, Zap } from "lucide-react";

const features = [
  {
    icon: Phone,
    title: "SIP Extensions",
    description: "Create and manage extensions with auto-generated SIP credentials",
  },
  {
    icon: GitBranch,
    title: "Call Routing",
    description: "IVR menus, ring groups, and call forwarding — all configurable",
  },
  {
    icon: Shield,
    title: "Multi-Tenant",
    description: "Complete data isolation between companies with role-based access",
  },
  {
    icon: Zap,
    title: "WebRTC Calling",
    description: "Make and receive calls directly from your browser",
  },
];

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      {/* Hero */}
      <section className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
        <Image
          src="/logo.png"
          alt="Xyra Voice"
          width={100}
          height={100}
          className="mb-8"
          priority
        />

        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
          <span className="bg-gradient-to-r from-xyra-300 via-xyra-400 to-xyra-600 bg-clip-text text-transparent">
            Xyra Voice
          </span>
        </h1>

        <p className="mt-4 max-w-lg text-lg text-neutral-400">
          Cloud-based Virtual PBX for modern businesses. Manage extensions, call
          routing, and telephony — all from your browser.
        </p>

        <div className="mt-10 flex flex-col gap-4 sm:flex-row">
          <Link
            href="/signup"
            className="rounded-xl bg-xyra-500 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-xyra-500/25 transition hover:bg-xyra-600 hover:shadow-xyra-500/40"
          >
            Get Started Free
          </Link>
          <Link
            href="/login"
            className="rounded-xl border border-neutral-700 px-8 py-3 text-sm font-semibold text-neutral-300 transition hover:border-xyra-500 hover:text-white"
          >
            Sign In
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-neutral-800 px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-sm font-semibold uppercase tracking-wider text-xyra-400">
            Everything you need
          </h2>
          <p className="mt-2 text-center text-2xl font-bold">
            Business telephony, simplified
          </p>

          <div className="mt-12 grid gap-8 sm:grid-cols-2">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="rounded-xl border border-neutral-800 bg-navy-900 p-6 transition hover:border-neutral-700"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-xyra-500/10">
                    <Icon size={20} className="text-xyra-400" />
                  </div>
                  <h3 className="mt-4 font-semibold">{feature.title}</h3>
                  <p className="mt-1 text-sm text-neutral-400">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-neutral-800 px-6 py-8">
        <p className="text-center text-sm text-neutral-500">
          Xyra Voice — Built by Axion Labs
        </p>
      </footer>
    </main>
  );
}
