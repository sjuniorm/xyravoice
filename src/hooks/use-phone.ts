"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  UserAgent,
  Registerer,
  Inviter,
  SessionState,
  type Session,
} from "sip.js";

export type PhoneStatus =
  | "disconnected"
  | "connecting"
  | "registered"
  | "error";

export type CallStatus =
  | "idle"
  | "dialing"
  | "ringing"    // incoming
  | "in_call"
  | "ending";

export interface PhoneConfig {
  sipServer: string;      // WSS URL, e.g. wss://sip.example.com:8089/ws
  sipUsername: string;
  sipPassword: string;
  sipDomain: string;      // SIP domain, e.g. sip.example.com
}

export interface PhoneState {
  phoneStatus: PhoneStatus;
  callStatus: CallStatus;
  callDuration: number;
  isMuted: boolean;
  remoteNumber: string;
}

export interface PhoneActions {
  connect: (config: PhoneConfig) => void;
  disconnect: () => void;
  call: (target: string) => void;
  hangup: () => void;
  answer: () => void;
  toggleMute: () => void;
}

export function usePhone(): PhoneState & PhoneActions {
  const [phoneStatus, setPhoneStatus] = useState<PhoneStatus>("disconnected");
  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [remoteNumber, setRemoteNumber] = useState("");

  const uaRef = useRef<UserAgent | null>(null);
  const registererRef = useRef<Registerer | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Ensure audio element exists and is attached to the DOM
  useEffect(() => {
    if (typeof window !== "undefined" && !audioRef.current) {
      const el = document.createElement("audio");
      el.autoplay = true;
      el.setAttribute("playsinline", "true");
      // Attach but keep it invisible — some browsers need an element in
      // the DOM tree before they will start audio playback automatically.
      el.style.display = "none";
      document.body.appendChild(el);
      audioRef.current = el;
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function attachMedia(session: Session) {
    const pc = (session as unknown as { sessionDescriptionHandler?: { peerConnection?: RTCPeerConnection } })
      .sessionDescriptionHandler?.peerConnection;
    if (!pc || !audioRef.current) return;

    const remoteStream = new MediaStream();
    audioRef.current.srcObject = remoteStream;

    // Add any tracks that already exist on receivers
    pc.getReceivers().forEach((receiver) => {
      if (receiver.track) {
        remoteStream.addTrack(receiver.track);
      }
    });

    // And keep adding tracks as they arrive (the usual case — the remote
    // description is set after Established fires, so receivers don't have
    // tracks yet at the moment we get here).
    pc.ontrack = (event) => {
      event.streams[0]?.getTracks().forEach((track) => {
        if (!remoteStream.getTracks().find((t) => t.id === track.id)) {
          remoteStream.addTrack(track);
        }
      });
      // Force playback in case autoplay was blocked
      audioRef.current?.play().catch(() => {
        // ignore — user gesture already happened via the Accept/Call button
      });
    };

    // Attempt immediate playback as well
    audioRef.current.play().catch(() => {});
  }

  function startTimer() {
    setCallDuration(0);
    timerRef.current = setInterval(() => {
      setCallDuration((d) => d + 1);
    }, 1000);
  }

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setCallDuration(0);
  }

  function setupSessionListeners(session: Session) {
    sessionRef.current = session;

    session.stateChange.addListener((state) => {
      switch (state) {
        case SessionState.Establishing:
          setCallStatus("dialing");
          break;
        case SessionState.Established:
          setCallStatus("in_call");
          attachMedia(session);
          startTimer();
          break;
        case SessionState.Terminating:
        case SessionState.Terminated:
          setCallStatus("idle");
          setRemoteNumber("");
          setIsMuted(false);
          stopTimer();
          sessionRef.current = null;
          break;
      }
    });
  }

  const connect = useCallback((config: PhoneConfig) => {
    if (uaRef.current) return;

    setPhoneStatus("connecting");

    const uri = UserAgent.makeURI(
      `sip:${config.sipUsername}@${config.sipDomain}`
    );
    if (!uri) {
      setPhoneStatus("error");
      return;
    }

    const ua = new UserAgent({
      uri,
      transportOptions: {
        server: config.sipServer,
      },
      authorizationUsername: config.sipUsername,
      authorizationPassword: config.sipPassword,
      displayName: config.sipUsername,
      // Handle incoming calls
      delegate: {
        onInvite(invitation) {
          sessionRef.current = invitation;
          const from = invitation.remoteIdentity.uri.user || "Unknown";
          setRemoteNumber(from);
          setCallStatus("ringing");
          setupSessionListeners(invitation);
        },
      },
    });

    const registerer = new Registerer(ua);

    ua.start()
      .then(() => {
        registerer
          .register()
          .then(() => {
            setPhoneStatus("registered");
          })
          .catch(() => {
            setPhoneStatus("error");
          });
      })
      .catch(() => {
        setPhoneStatus("error");
      });

    uaRef.current = ua;
    registererRef.current = registerer;
  }, []);

  const disconnect = useCallback(() => {
    if (sessionRef.current) {
      try {
        sessionRef.current.dispose();
      } catch {
        // ignore
      }
    }
    if (registererRef.current) {
      try {
        registererRef.current.unregister();
      } catch {
        // ignore
      }
    }
    if (uaRef.current) {
      uaRef.current.stop().catch(() => {});
    }
    uaRef.current = null;
    registererRef.current = null;
    sessionRef.current = null;
    setPhoneStatus("disconnected");
    setCallStatus("idle");
    setRemoteNumber("");
    setIsMuted(false);
    stopTimer();
  }, []);

  const call = useCallback(
    (target: string) => {
      if (!uaRef.current || phoneStatus !== "registered") return;

      const ua = uaRef.current;
      const targetUri = UserAgent.makeURI(`sip:${target}@${ua.configuration.uri.host}`);
      if (!targetUri) return;

      const inviter = new Inviter(ua, targetUri, {
        sessionDescriptionHandlerOptions: {
          constraints: { audio: true, video: false },
        },
      });

      setRemoteNumber(target);
      setupSessionListeners(inviter);

      inviter.invite().catch(() => {
        setCallStatus("idle");
        setRemoteNumber("");
      });
    },
    [phoneStatus]
  );

  const hangup = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;

    setCallStatus("ending");

    switch (session.state) {
      case SessionState.Initial:
      case SessionState.Establishing:
        if ("cancel" in session) {
          (session as Inviter).cancel();
        } else {
          session.dispose();
        }
        break;
      case SessionState.Established:
        session.bye().catch(() => session.dispose());
        break;
      default:
        session.dispose();
    }
  }, []);

  const answer = useCallback(() => {
    const session = sessionRef.current;
    if (!session || callStatus !== "ringing") return;
    if ("accept" in session) {
      (session as { accept: (options?: object) => Promise<void> }).accept({
        sessionDescriptionHandlerOptions: {
          constraints: { audio: true, video: false },
        },
      });
    }
  }, [callStatus]);

  const toggleMute = useCallback(() => {
    const session = sessionRef.current;
    if (!session || callStatus !== "in_call") return;

    const pc = (session as unknown as { sessionDescriptionHandler?: { peerConnection?: RTCPeerConnection } })
      .sessionDescriptionHandler?.peerConnection;
    if (!pc) return;

    pc.getSenders().forEach((sender) => {
      if (sender.track && sender.track.kind === "audio") {
        sender.track.enabled = isMuted; // toggle: if muted, enable; if unmuted, disable
      }
    });
    setIsMuted(!isMuted);
  }, [callStatus, isMuted]);

  return {
    phoneStatus,
    callStatus,
    callDuration,
    isMuted,
    remoteNumber,
    connect,
    disconnect,
    call,
    hangup,
    answer,
    toggleMute,
  };
}
