"use client";

import { useEffect, useState } from "react";
import {
  Phone,
  PhoneOff,
  PhoneCall,
  PhoneIncoming,
  Mic,
  MicOff,
  ChevronDown,
  ChevronUp,
  Wifi,
  WifiOff,
  Settings2,
  X,
  Delete,
} from "lucide-react";
import { usePhone, type PhoneConfig } from "@/hooks/use-phone";
import { createClient } from "@/lib/supabase/client";
import type { SipUser } from "@/types";
import DialPad from "./dial-pad";

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function Softphone() {
  const phone = usePhone();
  const [minimized, setMinimized] = useState(true);
  const [dialInput, setDialInput] = useState("");
  const [showConfig, setShowConfig] = useState(false);
  const [sipServer, setSipServer] = useState("");
  const [sipDomain, setSipDomain] = useState("");
  const [extensions, setExtensions] = useState<SipUser[]>([]);
  const [selectedExt, setSelectedExt] = useState<SipUser | null>(null);

  // Load extensions from Supabase
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("sip_users")
      .select("*")
      .eq("enabled", true)
      .order("extension")
      .then(({ data }) => {
        if (data) setExtensions(data as SipUser[]);
      });
  }, []);

  function handleConnect() {
    if (!selectedExt || !sipServer || !sipDomain) {
      setShowConfig(true);
      return;
    }
    const config: PhoneConfig = {
      sipServer,
      sipUsername: selectedExt.sip_username,
      sipPassword: selectedExt.sip_password,
      sipDomain,
    };
    phone.connect(config);
  }

  function handleDial() {
    if (!dialInput) return;

    // If the dialed number matches a known extension in our tenant,
    // translate it to the globally-unique SIP username so Kamailio
    // can find the registration. Otherwise pass the number through
    // as-is (for external/PSTN calls via trunks).
    const match = extensions.find((e) => e.extension === dialInput);
    const target = match ? match.sip_username : dialInput;

    phone.call(target);
    setDialInput("");
  }

  function handleDialPadPress(key: string) {
    setDialInput((prev) => prev + key);
  }

  const isInCall =
    phone.callStatus === "in_call" ||
    phone.callStatus === "dialing" ||
    phone.callStatus === "ringing";

  // Minimized floating button
  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        className={`fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-xl transition hover:scale-105 ${
          phone.phoneStatus === "registered"
            ? "bg-xyra-500 shadow-xyra-500/30"
            : "bg-navy-800 shadow-black/30"
        } ${isInCall ? "animate-pulse" : ""}`}
      >
        {isInCall ? (
          <PhoneCall size={22} className="text-white" />
        ) : (
          <Phone size={22} className="text-white" />
        )}
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-72 rounded-2xl border border-neutral-800 bg-navy-900 shadow-2xl shadow-black/50">
      {/* Header */}
      <div className="flex items-center justify-between rounded-t-2xl bg-navy-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <Phone size={16} className="text-xyra-400" />
          <span className="text-sm font-semibold">Softphone</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="rounded-lg p-1.5 text-neutral-400 hover:text-white"
          >
            <Settings2 size={14} />
          </button>
          <button
            onClick={() => setMinimized(true)}
            className="rounded-lg p-1.5 text-neutral-400 hover:text-white"
          >
            <ChevronDown size={14} />
          </button>
        </div>
      </div>

      {/* Config panel */}
      {showConfig && (
        <div className="border-b border-neutral-800 p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-neutral-400">
              SIP Server (WSS)
            </label>
            <input
              type="text"
              value={sipServer}
              onChange={(e) => setSipServer(e.target.value)}
              placeholder="wss://sip.example.com:8089/ws"
              className="mt-1 block w-full rounded-lg border border-neutral-700 bg-navy-950 px-2.5 py-1.5 text-xs text-white placeholder-neutral-500 focus:border-xyra-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-400">
              SIP Domain
            </label>
            <input
              type="text"
              value={sipDomain}
              onChange={(e) => setSipDomain(e.target.value)}
              placeholder="sip.example.com"
              className="mt-1 block w-full rounded-lg border border-neutral-700 bg-navy-950 px-2.5 py-1.5 text-xs text-white placeholder-neutral-500 focus:border-xyra-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-400">
              Extension
            </label>
            <select
              value={selectedExt?.id ?? ""}
              onChange={(e) => {
                const ext = extensions.find((x) => x.id === e.target.value);
                setSelectedExt(ext ?? null);
              }}
              className="mt-1 block w-full rounded-lg border border-neutral-700 bg-navy-950 px-2.5 py-1.5 text-xs text-white focus:border-xyra-500 focus:outline-none"
            >
              <option value="">Select extension...</option>
              {extensions.map((ext) => (
                <option key={ext.id} value={ext.id}>
                  {ext.extension} — {ext.display_name}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() => setShowConfig(false)}
            className="w-full rounded-lg bg-xyra-500/10 px-3 py-1.5 text-xs font-medium text-xyra-400 transition hover:bg-xyra-500/20"
          >
            Done
          </button>
        </div>
      )}

      {/* Status bar */}
      <div className="flex items-center gap-2 px-4 py-2 text-xs">
        {phone.phoneStatus === "registered" ? (
          <>
            <Wifi size={12} className="text-emerald-400" />
            <span className="text-emerald-400">Registered</span>
            <span className="text-neutral-500">
              ({selectedExt?.extension ?? "?"})
            </span>
          </>
        ) : phone.phoneStatus === "connecting" ? (
          <>
            <Wifi size={12} className="animate-pulse text-amber-400" />
            <span className="text-amber-400">Connecting...</span>
          </>
        ) : phone.phoneStatus === "error" ? (
          <>
            <WifiOff size={12} className="text-red-400" />
            <span className="text-red-400">Connection failed</span>
          </>
        ) : (
          <>
            <WifiOff size={12} className="text-neutral-500" />
            <span className="text-neutral-500">Disconnected</span>
          </>
        )}
      </div>

      {/* Incoming call */}
      {phone.callStatus === "ringing" && (
        <div className="border-t border-neutral-800 p-4">
          <div className="flex items-center gap-3">
            <PhoneIncoming
              size={20}
              className="animate-pulse text-emerald-400"
            />
            <div>
              <p className="text-sm font-semibold">Incoming Call</p>
              <p className="text-xs text-neutral-400">{phone.remoteNumber}</p>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={phone.answer}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600"
            >
              <Phone size={14} />
              Accept
            </button>
            <button
              onClick={phone.hangup}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500 py-2 text-sm font-semibold text-white transition hover:bg-red-600"
            >
              <PhoneOff size={14} />
              Reject
            </button>
          </div>
        </div>
      )}

      {/* In-call display */}
      {(phone.callStatus === "in_call" || phone.callStatus === "dialing") && (
        <div className="border-t border-neutral-800 p-4 text-center">
          <p className="text-xs text-neutral-400">
            {phone.callStatus === "dialing" ? "Calling..." : "In Call"}
          </p>
          <p className="mt-1 text-lg font-bold">{phone.remoteNumber}</p>
          <p className="text-sm font-mono text-xyra-400">
            {formatDuration(phone.callDuration)}
          </p>

          <div className="mt-4 flex justify-center gap-4">
            <button
              onClick={phone.toggleMute}
              className={`flex h-12 w-12 items-center justify-center rounded-full transition ${
                phone.isMuted
                  ? "bg-amber-500/20 text-amber-400"
                  : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
              }`}
            >
              {phone.isMuted ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
            <button
              onClick={phone.hangup}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500 text-white transition hover:bg-red-600"
            >
              <PhoneOff size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Dial pad — only when idle and registered */}
      {phone.callStatus === "idle" && (
        <div className="border-t border-neutral-800 p-4">
          {phone.phoneStatus === "registered" ? (
            <>
              {/* Dial input */}
              <div className="mb-3 flex items-center gap-2 rounded-xl bg-navy-950 px-3 py-2">
                <input
                  type="text"
                  value={dialInput}
                  onChange={(e) => setDialInput(e.target.value)}
                  placeholder="Enter number..."
                  className="flex-1 bg-transparent text-sm text-white placeholder-neutral-500 focus:outline-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleDial();
                  }}
                />
                {dialInput && (
                  <button
                    onClick={() =>
                      setDialInput((prev) => prev.slice(0, -1))
                    }
                    className="text-neutral-500 hover:text-white"
                  >
                    <Delete size={16} />
                  </button>
                )}
              </div>

              <DialPad onPress={handleDialPadPress} />

              {/* Call button */}
              <button
                onClick={handleDial}
                disabled={!dialInput}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-40"
              >
                <Phone size={16} />
                Call
              </button>
            </>
          ) : (
            <button
              onClick={handleConnect}
              disabled={phone.phoneStatus === "connecting"}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-xyra-500 py-2.5 text-sm font-semibold text-white transition hover:bg-xyra-600 disabled:opacity-50"
            >
              {phone.phoneStatus === "connecting" ? (
                "Connecting..."
              ) : (
                <>
                  <Phone size={16} />
                  Connect
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Disconnect button when registered */}
      {phone.phoneStatus === "registered" && phone.callStatus === "idle" && (
        <div className="border-t border-neutral-800 px-4 py-2">
          <button
            onClick={phone.disconnect}
            className="flex w-full items-center justify-center gap-2 rounded-lg py-1.5 text-xs text-neutral-500 transition hover:text-red-400"
          >
            <X size={12} />
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
