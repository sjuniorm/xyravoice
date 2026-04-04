"use client";

import { useState } from "react";
import { updateProfile, updateCompanyName } from "./actions";
import { User, Building2 } from "lucide-react";

interface SettingsFormsProps {
  fullName: string;
  email: string;
  role: string;
  companyName: string;
}

export default function SettingsForms({
  fullName,
  email,
  role,
  companyName,
}: SettingsFormsProps) {
  const [profileMsg, setProfileMsg] = useState("");
  const [companyMsg, setCompanyMsg] = useState("");
  const [loading1, setLoading1] = useState(false);
  const [loading2, setLoading2] = useState(false);

  async function handleProfileSubmit(formData: FormData) {
    setProfileMsg("");
    setLoading1(true);
    const result = await updateProfile(formData);
    setLoading1(false);
    setProfileMsg(result.error ?? "Profile updated");
  }

  async function handleCompanySubmit(formData: FormData) {
    setCompanyMsg("");
    setLoading2(true);
    const result = await updateCompanyName(formData);
    setLoading2(false);
    setCompanyMsg(result.error ?? "Company name updated");
  }

  return (
    <div className="space-y-8">
      {/* Profile section */}
      <div className="rounded-xl border border-neutral-800 bg-navy-900 p-6">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-xyra-500/10 p-2">
            <User size={18} className="text-xyra-400" />
          </div>
          <h2 className="text-lg font-semibold">Profile</h2>
        </div>

        <form action={handleProfileSubmit} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="full_name"
              className="block text-sm font-medium text-neutral-300"
            >
              Full Name
            </label>
            <input
              id="full_name"
              name="full_name"
              type="text"
              required
              defaultValue={fullName}
              className="mt-1 block w-full max-w-sm rounded-lg border border-neutral-700 bg-navy-950 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-xyra-500 focus:outline-none focus:ring-1 focus:ring-xyra-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-300">
              Email
            </label>
            <p className="mt-1 text-sm text-neutral-400">{email}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-300">
              Role
            </label>
            <p className="mt-1 text-sm capitalize text-neutral-400">{role}</p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={loading1}
              className="rounded-lg bg-xyra-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-xyra-600 disabled:opacity-50"
            >
              {loading1 ? "Saving..." : "Save Profile"}
            </button>
            {profileMsg && (
              <span
                className={`text-sm ${
                  profileMsg.includes("updated")
                    ? "text-emerald-400"
                    : "text-red-400"
                }`}
              >
                {profileMsg}
              </span>
            )}
          </div>
        </form>
      </div>

      {/* Company section */}
      <div className="rounded-xl border border-neutral-800 bg-navy-900 p-6">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-blue-500/10 p-2">
            <Building2 size={18} className="text-blue-400" />
          </div>
          <h2 className="text-lg font-semibold">Company</h2>
        </div>

        <form action={handleCompanySubmit} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="company_name"
              className="block text-sm font-medium text-neutral-300"
            >
              Company Name
            </label>
            <input
              id="company_name"
              name="company_name"
              type="text"
              required
              defaultValue={companyName}
              className="mt-1 block w-full max-w-sm rounded-lg border border-neutral-700 bg-navy-950 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-xyra-500 focus:outline-none focus:ring-1 focus:ring-xyra-500"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={loading2}
              className="rounded-lg bg-xyra-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-xyra-600 disabled:opacity-50"
            >
              {loading2 ? "Saving..." : "Save Company"}
            </button>
            {companyMsg && (
              <span
                className={`text-sm ${
                  companyMsg.includes("updated")
                    ? "text-emerald-400"
                    : "text-red-400"
                }`}
              >
                {companyMsg}
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
