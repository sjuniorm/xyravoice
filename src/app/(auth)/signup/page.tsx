"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          company_name: companyName,
        },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
  }

  return (
    <form onSubmit={handleSignup} className="space-y-6">
      <div className="text-center">
        <Image
          src="/logo-icon.png"
          alt="Xyra Voice"
          width={64}
          height={64}
          className="mx-auto mb-4"
        />
        <h1 className="text-2xl font-bold">Create your account</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Start managing your business telephony
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label htmlFor="fullName" className="block text-sm font-medium text-neutral-300">
            Full Name
          </label>
          <input
            id="fullName"
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-neutral-700 bg-navy-900 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-xyra-500 focus:outline-none focus:ring-1 focus:ring-xyra-500"
            placeholder="John Doe"
          />
        </div>

        <div>
          <label htmlFor="companyName" className="block text-sm font-medium text-neutral-300">
            Company Name
          </label>
          <input
            id="companyName"
            type="text"
            required
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-neutral-700 bg-navy-900 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-xyra-500 focus:outline-none focus:ring-1 focus:ring-xyra-500"
            placeholder="Acme Inc."
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-neutral-300">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-neutral-700 bg-navy-900 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-xyra-500 focus:outline-none focus:ring-1 focus:ring-xyra-500"
            placeholder="you@company.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-neutral-300">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-neutral-700 bg-navy-900 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-xyra-500 focus:outline-none focus:ring-1 focus:ring-xyra-500"
            placeholder="••••••••"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-xyra-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-xyra-500/25 transition hover:bg-xyra-600 disabled:opacity-50"
      >
        {loading ? "Creating account..." : "Create Account"}
      </button>

      <p className="text-center text-sm text-neutral-400">
        Already have an account?{" "}
        <Link href="/login" className="text-xyra-400 hover:text-xyra-300">
          Sign in
        </Link>
      </p>
    </form>
  );
}
