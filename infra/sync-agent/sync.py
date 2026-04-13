#!/usr/bin/env python3
"""
Xyra Voice — Asterisk sync agent

Polls Supabase every N seconds, regenerates Asterisk pjsip + dialplan
fragments from the trunks/dids tables, and reloads Asterisk if anything
has changed. Runs on the VPS host (not in docker) so it can reach the
asterisk container via `docker exec`.

The agent is intentionally dumb and stateless: it always reads the full
state from the DB, generates the configs, hashes them, and only writes
+ reloads when the hash differs from the previous run.

Required environment variables:
  SYNC_DB_URL          postgres URL for asterisk_ro role (Supavisor)
  SYNC_OUTPUT_DIR      directory where pjsip_realtime.conf + extensions_realtime.conf land
  SYNC_ASTERISK_CTNR   docker container name for asterisk (default xyra-asterisk)
  SYNC_INTERVAL        poll interval in seconds (default 30)

Run via systemd timer; see install.sh.
"""
from __future__ import annotations

import hashlib
import logging
import os
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path

import json

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    print("ERROR: psycopg2 not installed. Run: pip3 install psycopg2-binary", file=sys.stderr)
    sys.exit(1)

# ─── Config ─────────────────────────────────────────────────
DB_URL = os.environ.get("SYNC_DB_URL", "")
OUTPUT_DIR = Path(os.environ.get("SYNC_OUTPUT_DIR", "/opt/xyravoice/infra/asterisk/etc/generated"))
ASTERISK_CTNR = os.environ.get("SYNC_ASTERISK_CTNR", "xyra-asterisk")
INTERVAL = int(os.environ.get("SYNC_INTERVAL", "30"))
ONESHOT = os.environ.get("SYNC_ONESHOT", "").lower() in ("1", "true", "yes")

PJSIP_OUT = OUTPUT_DIR / "pjsip_realtime.conf"
DIALPLAN_OUT = OUTPUT_DIR / "extensions_realtime.conf"
CDR_CSV = Path(os.environ.get("SYNC_CDR_CSV", "/opt/xyravoice/infra/logs/asterisk/cdr-custom/Master.csv"))
CDR_OFFSET_FILE = Path(os.environ.get("SYNC_CDR_OFFSET", "/opt/xyravoice/infra/sync-agent/.cdr_offset"))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
log = logging.getLogger("xyra-sync")


# ─── Data classes ───────────────────────────────────────────
@dataclass
class Trunk:
    id: str
    tenant_id: str
    name: str
    host: str
    port: int
    username: str | None
    password: str | None
    transport: str
    enabled: bool
    caller_id: str | None
    register: bool
    from_user: str | None
    from_domain: str | None

    @property
    def slug(self) -> str:
        """Globally unique endpoint name for this trunk."""
        return f"trunk_{self.id.replace('-', '')[:16]}"

    @property
    def tenant_slug(self) -> str:
        """Short tenant prefix matching what we use for sip_users (t_<8hex>)."""
        return f"t_{self.tenant_id.replace('-', '')[:8]}"


@dataclass
class Did:
    id: str
    tenant_id: str
    trunk_id: str
    did_number: str
    destination_type: str
    destination_value: str
    enabled: bool


@dataclass
class CallFlow:
    id: str
    tenant_id: str
    name: str
    steps: list[dict]
    is_active: bool

    @property
    def context(self) -> str:
        """Asterisk context name for this call flow."""
        return f"cf-{self.id.replace('-', '')[:8]}"

    @property
    def tenant_slug(self) -> str:
        return f"t_{self.tenant_id.replace('-', '')[:8]}"


# ─── DB ─────────────────────────────────────────────────────
def fetch_state() -> tuple[list[Trunk], list[Did], list[CallFlow]]:
    if not DB_URL:
        raise RuntimeError("SYNC_DB_URL not set")

    with psycopg2.connect(DB_URL) as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                select id, tenant_id, name, host, port, username, password,
                       transport, enabled, caller_id, register, from_user, from_domain
                from public.trunks
                where enabled = true
                order by tenant_id, created_at
            """)
            trunks = [
                Trunk(
                    id=str(r["id"]),
                    tenant_id=str(r["tenant_id"]),
                    name=r["name"],
                    host=r["host"],
                    port=r["port"] or 5060,
                    username=r["username"],
                    password=r["password"],
                    transport=r["transport"] or "udp",
                    enabled=r["enabled"],
                    caller_id=r["caller_id"],
                    register=bool(r["register"]),
                    from_user=r["from_user"],
                    from_domain=r["from_domain"],
                )
                for r in cur.fetchall()
            ]

            cur.execute("""
                select id, tenant_id, trunk_id, did_number,
                       destination_type, destination_value, enabled
                from public.dids
                where enabled = true
            """)
            dids = [
                Did(
                    id=str(r["id"]),
                    tenant_id=str(r["tenant_id"]),
                    trunk_id=str(r["trunk_id"]),
                    did_number=r["did_number"],
                    destination_type=r["destination_type"],
                    destination_value=r["destination_value"],
                    enabled=r["enabled"],
                )
                for r in cur.fetchall()
            ]

            cur.execute("""
                select id, tenant_id, name, steps, is_active
                from public.call_flows
                where is_active = true
            """)
            call_flows = [
                CallFlow(
                    id=str(r["id"]),
                    tenant_id=str(r["tenant_id"]),
                    name=r["name"],
                    steps=json.loads(r["steps"]) if isinstance(r["steps"], str) else r["steps"],
                    is_active=r["is_active"],
                )
                for r in cur.fetchall()
            ]
    return trunks, dids, call_flows


# ─── Generators ─────────────────────────────────────────────
# Known SIP/RTP source-IP ranges for major providers, indexed by the
# substring of the trunk host that identifies them. PJSIP only resolves
# the FQDN's A record, so when a provider sends INVITEs from media-relay
# IPs that aren't in that record, we need to add the wider subnet here
# or inbound calls will be rejected as "No matching endpoint".
_PROVIDER_SUBNETS: dict[str, list[str]] = {
    "zadarma.com": ["185.45.152.0/24", "195.122.19.0/24"],
}


def _provider_cidrs(host: str) -> list[str]:
    host_l = host.lower()
    for needle, cidrs in _PROVIDER_SUBNETS.items():
        if needle in host_l:
            return cidrs
    return []


def gen_pjsip(trunks: list[Trunk]) -> str:
    """
    Generate the per-trunk pjsip section.

    For each trunk we emit: endpoint, auth, aor, identify, registration.
    The endpoint name is the trunk slug (globally unique).
    """
    lines: list[str] = [
        "; ============================================================",
        "; Generated by xyra-sync — DO NOT EDIT BY HAND.",
        "; Source of truth: public.trunks in Supabase.",
        "; ============================================================",
        "",
    ]

    for t in trunks:
        from_user = t.from_user or t.username or ""
        from_domain = t.from_domain or t.host

        lines += [
            f"; ─── Trunk: {t.name} (tenant {t.tenant_slug}) ──────────────",
            f"[{t.slug}]",
            "type=endpoint",
            f"transport=transport-{t.transport}",
            f"context=from-trunk",
            "disallow=all",
            "allow=alaw",
            "allow=ulaw",
            "direct_media=no",
            "rtp_symmetric=yes",
            "force_rport=yes",
            "rewrite_contact=yes",
            f"from_user={from_user}",
            f"from_domain={from_domain}",
            f"aors={t.slug}",
            f"outbound_auth={t.slug}",
            "",
            f"[{t.slug}]",
            "type=aor",
            f"contact=sip:{t.host}:{t.port}",
            "qualify_frequency=60",
            "",
            f"[{t.slug}]",
            "type=auth",
            "auth_type=userpass",
            f"username={t.username or ''}",
            f"password={t.password or ''}",
            "",
            # Two separate identify blocks. PJSIP iterates them and
            # picks the first hit. Combining `match` and `match_header`
            # in one block requires BOTH to match — useless as a fallback.
            #
            # Block 1: source-IP match. We list both the FQDN (which
            # PJSIP resolves via DNS) and known provider subnets, since
            # carriers like Zadarma send INVITEs from media-relay IPs
            # outside their advertised SIP DNS A record.
            f"[{t.slug}-ip]",
            "type=identify",
            f"endpoint={t.slug}",
            f"match={t.host}",
            *([f"match={cidr}" for cidr in _provider_cidrs(t.host)]),
            "",
            # Block 2: From: header regex (catches IPs outside DNS
            # — e.g. Zadarma sends from 185.45.152.180 even though
            # sip.zadarma.com only resolves to 161/142/174).
            f"[{t.slug}-hdr]",
            "type=identify",
            f"endpoint={t.slug}",
            # Allow optional display name (e.g. `"BUZZ ALARMAS"`) before
            # the URI. PJSIP uses POSIX regex on the full header value.
            f"match_header=From: .*sip:.*@{t.host}.*",
            "",
        ]

        if t.register:
            lines += [
                f"[{t.slug}]",
                "type=registration",
                f"transport=transport-{t.transport}",
                f"outbound_auth={t.slug}",
                f"server_uri=sip:{t.host}:{t.port}",
                f"client_uri=sip:{t.username}@{t.host}",
                "retry_interval=60",
                "max_retries=10000",
                "expiration=120",
                "",
            ]

    return "\n".join(lines) + "\n"


def _resolve_dial_target(dest: str, tenant_slug: str, trunk: Trunk | None) -> str:
    """
    Turn a destination string into an Asterisk Dial() target.

    Destination formats from the UI:
      "ext:101"       → local extension via Kamailio
      "101" (1-4 dig) → local extension via Kamailio
      "+34600123456"  → external number via tenant trunk
      "0034600123456" → external number via tenant trunk
    """
    # Explicit extension prefix from IVR option values
    if dest.startswith("ext:"):
        ext = dest[4:]
        return f"PJSIP/{tenant_slug}_{ext}@kamailio-out"
    # Short digit string = extension
    if dest.isdigit() and len(dest) <= 4:
        return f"PJSIP/{tenant_slug}_{dest}@kamailio-out"
    # External number → route via trunk
    if trunk:
        return f"PJSIP/{dest}@{trunk.slug}"
    # Fallback: try via Kamailio (will hit from-kamailio outbound)
    return f"PJSIP/{dest}@kamailio-out"


def _gen_callflow_context(cf: CallFlow, trunk: Trunk | None) -> list[str]:
    """
    Generate an Asterisk dialplan context for a single call flow.

    Each step type:
      ring_group  — Dial() with & for simultaneous, chained for sequential
      forward     — Dial() to destination (always/busy/no_answer)
      ivr         — Answer + WaitExten, digit extensions for each option

    Steps chain sequentially on the `s` extension. If DIALSTATUS != ANSWER
    after a Dial(), execution falls through to the next step.
    """
    tenant = cf.tenant_slug
    lines: list[str] = [
        f"; ─── Call Flow: {cf.name} (tenant {tenant}) ──────────────",
        f"[{cf.context}]",
    ]

    if not cf.steps:
        lines += [
            "exten => s,1,NoOp(Empty call flow)",
            " same => n,Hangup()",
            "",
        ]
        return lines

    # We build the `s` extension incrementally. IVR steps are special:
    # they branch via WaitExten, so we add digit extensions separately.
    s_lines: list[str] = ["exten => s,1,Answer()"]
    ivr_extensions: list[str] = []
    step_count = len(cf.steps)

    for i, step in enumerate(cf.steps):
        step_type = step.get("type", "")
        is_last = i == step_count - 1
        label = f"step{i}"
        s_lines.append(f" same => n({label}),NoOp(Step {i+1}: {step_type})")

        if step_type == "ring_group":
            members = step.get("members", [])
            strategy = step.get("strategy", "simultaneous")
            timeout = step.get("timeout", 30)

            if not members:
                s_lines.append(f" same => n,NoOp(Ring group has no members)")
            elif strategy == "simultaneous":
                targets = "&".join(
                    f"PJSIP/{tenant}_{m}@kamailio-out" for m in members
                )
                s_lines.append(f" same => n,Dial({targets},{timeout})")
                if not is_last:
                    s_lines.append(
                        f' same => n,GotoIf($["${{DIALSTATUS}}" = "ANSWER"]?done)'
                    )
            else:
                # Sequential: try each member one by one
                per_member_timeout = max(timeout // len(members), 10)
                for m in members:
                    target = f"PJSIP/{tenant}_{m}@kamailio-out"
                    s_lines.append(f" same => n,Dial({target},{per_member_timeout})")
                    s_lines.append(
                        f' same => n,GotoIf($["${{DIALSTATUS}}" = "ANSWER"]?done)'
                    )

        elif step_type == "forward":
            mode = step.get("mode", "always")
            dest = step.get("destination", "")
            if not dest:
                s_lines.append(f" same => n,NoOp(Forward has no destination)")
            else:
                target = _resolve_dial_target(dest, tenant, trunk)
                if mode == "always":
                    s_lines.append(f" same => n,Dial({target},60)")
                elif mode == "busy":
                    # Only forward if previous step returned BUSY
                    s_lines.append(
                        f' same => n,GotoIf($["${{DIALSTATUS}}" != "BUSY"]?step{i}_skip)'
                    )
                    s_lines.append(f" same => n,Dial({target},60)")
                    s_lines.append(f" same => n(step{i}_skip),NoOp(Not busy — skipping forward)")
                elif mode == "no_answer":
                    # Only forward if previous step returned NOANSWER or CHANUNAVAIL
                    s_lines.append(
                        f' same => n,GotoIf($["${{DIALSTATUS}}" = "ANSWER"]?done)'
                    )
                    s_lines.append(f" same => n,Dial({target},60)")

        elif step_type == "ivr":
            # IVR: play prompt (beep for MVP — real TTS/audio is Phase 2)
            # then WaitExten for DTMF input.
            ivr_timeout = 10
            s_lines.append(f" same => n,Background(beep)")
            s_lines.append(f" same => n,WaitExten({ivr_timeout})")
            # If WaitExten times out, it jumps to exten `t`. If no `t`
            # extension, Asterisk hangs up. We'll add a `t` extension
            # that falls through to the next step (if any) or hangs up.

            # Generate digit extensions for each IVR option
            options = step.get("options", {})
            for digit, dest in options.items():
                if not dest:
                    continue
                target = _resolve_dial_target(dest, tenant, trunk)
                ivr_extensions += [
                    f"exten => {digit},1,NoOp(IVR option {digit})",
                    f" same => n,Dial({target},60)",
                    " same => n,Hangup()",
                ]

            # Invalid input → replay IVR
            ivr_extensions += [
                f"exten => i,1,Playback(pbx-invalid)",
                f" same => n,Goto(s,{label})",
            ]

            # Timeout → fall through to next step or hangup
            if not is_last:
                ivr_extensions += [
                    f"exten => t,1,NoOp(IVR timeout — continuing to next step)",
                    f" same => n,Goto(s,step{i+1})",
                ]
            else:
                ivr_extensions += [
                    "exten => t,1,NoOp(IVR timeout — no more steps)",
                    " same => n,Hangup()",
                ]

    s_lines.append(" same => n(done),Hangup()")

    lines += s_lines
    if ivr_extensions:
        lines.append("")
        lines += ivr_extensions
    lines.append("")

    return lines


def gen_dialplan(trunks: list[Trunk], dids: list[Did], call_flows: list[CallFlow] | None = None) -> str:
    """
    Generate the dialplan fragment that handles:
      [from-kamailio]   — outbound: dial via the tenant's trunk
      [from-trunk]      — inbound: route DID to a destination
    """
    lines: list[str] = [
        "; ============================================================",
        "; Generated by xyra-sync — DO NOT EDIT BY HAND.",
        "; ============================================================",
        "",
    ]

    # Map tenant_slug → trunk slug (one trunk per tenant for MVP).
    # If a tenant has multiple enabled trunks we just take the first.
    tenant_to_trunk: dict[str, Trunk] = {}
    for t in trunks:
        tenant_to_trunk.setdefault(t.tenant_slug, t)

    # ─── from-kamailio (outbound) ────────────────────────────
    # Kamailio forwards calls here when the dialed number doesn't match
    # a registered local extension. The CALLERID(num) is the SIP username
    # of the calling browser (e.g. t_abc123_101) — we extract the tenant
    # slug from that and pick the matching trunk.
    #
    # Number normalization (defensive — softphone already does this):
    #   leading "00"  → strip and prefix with "+"  (European IDD)
    #   leading "+"   → unchanged
    #   bare digits   → unchanged (assume already E.164 or local)
    lines += [
        "[from-kamailio]",
        "; Outbound: tenant prefix is encoded in the caller ID (SIP username).",
        "; Format: t_<8hex>_<extension>  →  tenant slug = t_<8hex>",
    ]

    if not tenant_to_trunk:
        lines += [
            "exten => _X.,1,NoOp(No trunks configured for any tenant)",
            " same => n,Hangup(34)",  # 34 = no circuit available
            "",
        ]
    else:
        for tenant_slug, trunk in tenant_to_trunk.items():
            cli = trunk.caller_id or trunk.username or "unknown"
            slug_len = len(tenant_slug)

            # Three patterns: bare digits, leading "+", and leading "00".
            # Each routes through the same dial_ label for this tenant.
            lines += [
                f"; Tenant {tenant_slug} → trunk {trunk.name}",
                # Bare digits: dial as-is
                f"exten => _X.,1,GotoIf($[\"${{CALLERID(num):0:{slug_len}}}\" = \"{tenant_slug}\"]?dial_{tenant_slug})",
                f" same => n,NoOp(No trunk matched caller ${{CALLERID(num)}})",
                f" same => n,Hangup(34)",
                f"exten => _X.,n(dial_{tenant_slug}),Set(DEST=${{EXTEN}})",
                f" same => n,Set(CALLERID(all)=\"{cli}\" <{cli}>)",
                f" same => n,Dial(PJSIP/${{DEST}}@{trunk.slug},60)",
                " same => n,Hangup()",
                # Leading "+" (E.164): dial as-is
                f"exten => _+X.,1,GotoIf($[\"${{CALLERID(num):0:{slug_len}}}\" = \"{tenant_slug}\"]?dial_{tenant_slug}_plus)",
                f" same => n,Hangup(34)",
                f"exten => _+X.,n(dial_{tenant_slug}_plus),Set(DEST=${{EXTEN}})",
                f" same => n,Set(CALLERID(all)=\"{cli}\" <{cli}>)",
                f" same => n,Dial(PJSIP/${{DEST}}@{trunk.slug},60)",
                " same => n,Hangup()",
                # Leading "00": strip and convert to +
                f"exten => _00X.,1,GotoIf($[\"${{CALLERID(num):0:{slug_len}}}\" = \"{tenant_slug}\"]?dial_{tenant_slug}_idd)",
                f" same => n,Hangup(34)",
                f"exten => _00X.,n(dial_{tenant_slug}_idd),Set(DEST=+${{EXTEN:2}})",
                f" same => n,Set(CALLERID(all)=\"{cli}\" <{cli}>)",
                f" same => n,Dial(PJSIP/${{DEST}}@{trunk.slug},60)",
                " same => n,Hangup()",
                "",
            ]

    # ─── from-trunk (inbound) ─────────────────────────────────
    # Provider sends an INVITE to us. We match the dialed number against
    # configured DIDs. If matched, forward to Kamailio with the destination
    # extension's globally-unique SIP username so Kamailio can route to the
    # registered browser.
    lines += [
        "[from-trunk]",
        "; Inbound: match the dialed DID and forward to Kamailio.",
    ]

    if not dids:
        lines += [
            "exten => _X.,1,NoOp(No DIDs configured)",
            " same => n,Hangup(1)",
            "",
        ]
    else:
        # Group DIDs by tenant so we know which tenant prefix to use.
        # Build a (did_number → (tenant_slug, destination)) map.
        for d in dids:
            # Find the trunk this DID belongs to → its tenant slug
            trunk = next((t for t in trunks if t.id == d.trunk_id), None)
            if not trunk:
                continue
            tenant_slug = trunk.tenant_slug

            # Strip leading + because providers vary on whether they send it.
            did_no_plus = d.did_number.lstrip("+")

            if d.destination_type == "extension":
                target = f"{tenant_slug}_{d.destination_value}"
                lines += [
                    f"; DID {d.did_number} → extension {d.destination_value} (tenant {tenant_slug})",
                    f"exten => +{did_no_plus},1,NoOp(Inbound for DID {d.did_number})",
                    f" same => n,Dial(PJSIP/{target}@kamailio-out,60)",
                    " same => n,Hangup()",
                    f"exten => {did_no_plus},1,NoOp(Inbound for DID {d.did_number})",
                    f" same => n,Dial(PJSIP/{target}@kamailio-out,60)",
                    " same => n,Hangup()",
                    "",
                ]
            elif d.destination_type == "callflow":
                # Find the call flow to get its context name
                cf = next(
                    (f for f in (call_flows or []) if f.id == d.destination_value and f.is_active),
                    None,
                )
                if cf:
                    lines += [
                        f"; DID {d.did_number} → call flow \"{cf.name}\" (tenant {tenant_slug})",
                        f"exten => +{did_no_plus},1,NoOp(Inbound for DID {d.did_number} → callflow)",
                        f" same => n,Goto({cf.context},s,1)",
                        f"exten => {did_no_plus},1,NoOp(Inbound for DID {d.did_number} → callflow)",
                        f" same => n,Goto({cf.context},s,1)",
                        "",
                    ]
                else:
                    lines += [
                        f"; DID {d.did_number} → callflow {d.destination_value} (NOT FOUND / INACTIVE)",
                        f"exten => {did_no_plus},1,NoOp(Callflow not found: {d.destination_value})",
                        " same => n,Hangup(1)",
                        "",
                    ]

        # Some carriers (Zadarma included) send the inbound INVITE to
        # `sip:<host>` (no user → Asterisk uses extension `s`) or
        # `sip:<sip_account_id>@<host>` instead of the actual DID.
        # Build dispatch entries that look at CHANNEL(endpoint) and
        # jump to the trunk's first DID.
        trunk_default_did: dict[str, str] = {}
        for d in dids:
            if d.trunk_id not in trunk_default_did:
                trunk_default_did[d.trunk_id] = d.did_number.lstrip("+")

        if trunk_default_did:
            lines += [
                "; Carrier-quirk fallbacks: dispatch by source endpoint",
                "; when the To: URI is missing or contains the SIP account ID",
                "; rather than the actual DID.",
                "exten => s,1,NoOp(Inbound on ${CHANNEL(endpoint)} → s)",
            ]
            for trunk in trunks:
                default_did = trunk_default_did.get(trunk.id)
                if not default_did:
                    continue
                lines.append(
                    f' same => n,GotoIf($["${{CHANNEL(endpoint)}}" = "{trunk.slug}"]?from-trunk,{default_did},1)'
                )
            lines += [
                " same => n,Hangup(1)",
                "",
            ]

            # Per-trunk SIP-username aliases (e.g. Zadarma sends to its
            # account ID 263045@host on some routes).
            seen_users: set[str] = set()
            for trunk in trunks:
                default_did = trunk_default_did.get(trunk.id)
                if not default_did or not trunk.username:
                    continue
                if trunk.username in seen_users:
                    continue
                seen_users.add(trunk.username)
                lines += [
                    f"exten => {trunk.username},1,NoOp(Inbound on ${{CHANNEL(endpoint)}} → {trunk.username})",
                    f' same => n,GotoIf($["${{CHANNEL(endpoint)}}" = "{trunk.slug}"]?from-trunk,{default_did},1)',
                    " same => n,Hangup(1)",
                    "",
                ]

        lines += [
            "exten => _X.,1,NoOp(Unmatched inbound DID: ${EXTEN})",
            " same => n,Hangup(1)",
            "",
        ]

    # ─── Call flow contexts ──────────────────────────────────
    if call_flows:
        lines += [
            "; ============================================================",
            "; Call Flow contexts — generated from public.call_flows",
            "; ============================================================",
            "",
        ]
        for cf in call_flows:
            # Find the tenant's trunk for external number routing
            cf_trunk = tenant_to_trunk.get(cf.tenant_slug)
            lines += _gen_callflow_context(cf, cf_trunk)

    return "\n".join(lines) + "\n"


# ─── Reload ─────────────────────────────────────────────────
def reload_asterisk() -> None:
    # `pjsip reload` is not a recognized command on this Asterisk build —
    # we have to reload the modules individually. `module reload res_pjsip.so`
    # picks up endpoint/auth/aor/identify/registration changes.
    cmds = [
        ["docker", "exec", ASTERISK_CTNR, "asterisk", "-rx", "module reload res_pjsip.so"],
        ["docker", "exec", ASTERISK_CTNR, "asterisk", "-rx", "dialplan reload"],
    ]
    for cmd in cmds:
        try:
            out = subprocess.run(
                cmd, capture_output=True, text=True, timeout=15, check=False
            )
            log.info("reload: %s → rc=%d", " ".join(cmd[-2:]), out.returncode)
            if out.stdout.strip():
                log.info("  stdout: %s", out.stdout.strip())
            if out.returncode != 0 and out.stderr.strip():
                log.warning("  stderr: %s", out.stderr.strip())
        except Exception as e:
            log.error("reload failed (%s): %s", " ".join(cmd[-2:]), e)


# ─── CDR → Supabase ────────────────────────────────────────
# cdr_custom.conf writes CSV lines with these fields (in order):
#   uniqueid, clid, src, dst, dcontext, channel, dstchannel,
#   lastapp, lastdata, start, answer, end, duration, billsec,
#   disposition, userfield
#
# We tail the CSV from a saved byte offset so we only process new
# lines on each tick. The offset is persisted to a file so it
# survives restarts.

import csv
import io
import re

_TENANT_RE = re.compile(r"^(t_[0-9a-f]{8})_")


def _read_offset() -> int:
    try:
        return int(CDR_OFFSET_FILE.read_text().strip())
    except Exception:
        return 0


def _write_offset(offset: int) -> None:
    CDR_OFFSET_FILE.parent.mkdir(parents=True, exist_ok=True)
    CDR_OFFSET_FILE.write_text(str(offset))


def _disposition_to_status(disp: str) -> str:
    d = disp.strip().upper()
    if d == "ANSWERED":
        return "answered"
    if d == "BUSY":
        return "busy"
    if d == "NO ANSWER":
        return "no_answer"
    if d == "FAILED":
        return "failed"
    return "missed"


def _detect_direction(dcontext: str) -> str:
    if dcontext == "from-trunk" or dcontext.startswith("cf-"):
        return "inbound"
    if dcontext == "from-kamailio":
        return "outbound"
    return "internal"


def _extract_tenant_slug(*fields: str) -> str | None:
    """Try to extract the tenant slug (t_<8hex>) from any of the given fields."""
    for val in fields:
        m = _TENANT_RE.search(val)
        if m:
            return m.group(1)
    return None


_TRUNK_RE = re.compile(r"trunk_([0-9a-f]{16})")


def _extract_trunk_slug(*fields: str) -> str | None:
    """Try to extract a trunk slug (trunk_<16hex>) from any field."""
    for val in fields:
        m = _TRUNK_RE.search(val)
        if m:
            return f"trunk_{m.group(1)}"
    return None


def _resolve_tenant_id(
    tenant_slug: str | None,
    trunk_slug: str | None,
    tenant_map: dict[str, str],
    trunk_to_tenant: dict[str, str],
) -> str | None:
    """Map tenant slug or trunk slug → tenant UUID."""
    if tenant_slug and tenant_slug in tenant_map:
        return tenant_map[tenant_slug]
    if trunk_slug and trunk_slug in trunk_to_tenant:
        return trunk_to_tenant[trunk_slug]
    return None


def _fetch_tenant_map() -> tuple[dict[str, str], dict[str, str]]:
    """
    Return:
      tenant_map:     {tenant_slug: tenant_id}
      trunk_to_tenant: {trunk_slug: tenant_id}
    """
    if not DB_URL:
        return {}, {}
    tenant_map: dict[str, str] = {}
    trunk_to_tenant: dict[str, str] = {}
    with psycopg2.connect(DB_URL) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM public.tenants")
            for (tid,) in cur.fetchall():
                tid_str = str(tid)
                slug = f"t_{tid_str.replace('-', '')[:8]}"
                tenant_map[slug] = tid_str

            cur.execute("SELECT id, tenant_id FROM public.trunks WHERE enabled = true")
            for (trunk_id, tenant_id) in cur.fetchall():
                trunk_slug = f"trunk_{str(trunk_id).replace('-', '')[:16]}"
                trunk_to_tenant[trunk_slug] = str(tenant_id)
    return tenant_map, trunk_to_tenant


def process_cdr(tenant_map: dict[str, str], trunk_to_tenant: dict[str, str]) -> None:
    """Read new CDR lines from Master.csv and insert into call_logs."""
    if not CDR_CSV.exists():
        return

    offset = _read_offset()
    file_size = CDR_CSV.stat().st_size
    if file_size <= offset:
        if file_size < offset:
            # File was truncated/rotated — reset
            offset = 0
        else:
            return  # no new data

    with open(CDR_CSV, "r") as f:
        f.seek(offset)
        new_data = f.read()
        new_offset = f.tell()

    if not new_data.strip():
        _write_offset(new_offset)
        return

    reader = csv.reader(io.StringIO(new_data))
    rows_to_insert: list[dict] = []

    for row in reader:
        # The CDR CSV has 16 base fields, but lastdata (field 8) can
        # contain unquoted commas (e.g. "PJSIP/user@host,60") which
        # shifts subsequent columns. Parse from the known-fixed ends:
        #   - Fields 0-6 are always clean (no embedded commas).
        #   - The last 7 fields (start, answer, end, duration, billsec,
        #     disposition, userfield) are always clean.
        #   - Everything in between is lastapp + lastdata (may have extra commas).
        if len(row) < 15:
            continue

        uniqueid = row[0]
        clid = row[1]
        src = row[2]
        dst = row[3]
        dcontext = row[4]
        channel = row[5]
        dstchannel = row[6]

        # Last 7 fields from the end: start, answer, end, duration, billsec, disposition, userfield
        disposition = row[-2] if len(row) >= 2 else ""
        billsec = row[-3] if len(row) >= 3 else "0"
        duration = row[-4] if len(row) >= 4 else "0"
        end = row[-5] if len(row) >= 5 else ""
        answer = row[-6] if len(row) >= 6 else ""
        start = row[-7] if len(row) >= 7 else ""

        # Everything between field 7 and -7 is lastapp + lastdata (joined)
        middle = row[7:-7] if len(row) > 14 else row[7:9]
        lastapp = middle[0] if middle else ""
        lastdata = ",".join(middle[1:]) if len(middle) > 1 else ""

        direction = _detect_direction(dcontext)
        status = _disposition_to_status(disposition)
        # Search all available fields for the tenant slug (t_<8hex>_...)
        # The lastdata field often contains the Dial target with the
        # full SIP username, e.g. PJSIP/t_ce2836fe_101@kamailio-out
        tenant_slug = _extract_tenant_slug(src, dst, channel, dstchannel, lastdata)
        trunk_slug = _extract_trunk_slug(channel, dstchannel, lastdata)
        tenant_id = _resolve_tenant_id(tenant_slug, trunk_slug, tenant_map, trunk_to_tenant)

        if not tenant_id:
            log.warning("CDR: could not resolve tenant for %s (src=%s dst=%s)", uniqueid, src, dst)
            continue

        # Clean up caller/callee display: strip tenant prefix for readability
        caller_display = src
        callee_display = dst
        if _TENANT_RE.match(src):
            # Extract just the extension number
            parts = src.split("_", 2)
            if len(parts) >= 3:
                caller_display = parts[2]
        if _TENANT_RE.match(dst):
            parts = dst.split("_", 2)
            if len(parts) >= 3:
                callee_display = parts[2]

        rec: dict = {
            "tenant_id": tenant_id,
            "direction": direction,
            "caller": caller_display,
            "callee": callee_display,
            "status": status,
            "started_at": start or None,
            "answered_at": answer if answer else None,
            "ended_at": end if end else None,
            "duration_secs": int(billsec) if billsec else 0,
            "channel_id": uniqueid,
        }

        # Try to identify the trunk name from the channel
        if direction == "outbound" and "PJSIP/" in (dstchannel or ""):
            # e.g. PJSIP/trunk_abc123-00000001
            trunk_part = dstchannel.split("/", 1)[-1].split("-")[0]
            if trunk_part.startswith("trunk_"):
                rec["trunk_name"] = trunk_part
        elif direction == "inbound":
            chan_part = channel.split("/", 1)[-1].split("-")[0] if "/" in channel else ""
            if chan_part.startswith("trunk_"):
                rec["trunk_name"] = chan_part

        rows_to_insert.append(rec)

    if rows_to_insert:
        try:
            with psycopg2.connect(DB_URL) as conn:
                with conn.cursor() as cur:
                    for rec in rows_to_insert:
                        cur.execute("""
                            INSERT INTO public.call_logs
                                (tenant_id, direction, caller, callee, status,
                                 started_at, answered_at, ended_at, duration_secs,
                                 trunk_name, channel_id)
                            VALUES
                                (%(tenant_id)s, %(direction)s, %(caller)s, %(callee)s, %(status)s,
                                 %(started_at)s, %(answered_at)s, %(ended_at)s, %(duration_secs)s,
                                 %(trunk_name)s, %(channel_id)s)
                            ON CONFLICT (channel_id) WHERE channel_id IS NOT NULL DO NOTHING
                        """, rec)
                conn.commit()
            log.info("CDR: inserted %d call log(s)", len(rows_to_insert))
        except Exception as e:
            log.error("CDR insert failed: %s", e)
            return  # don't advance offset on failure

    _write_offset(new_offset)


# ─── Main loop ──────────────────────────────────────────────
def write_if_changed(path: Path, content: str) -> bool:
    path.parent.mkdir(parents=True, exist_ok=True)
    new_hash = hashlib.sha256(content.encode()).hexdigest()
    if path.exists():
        old_hash = hashlib.sha256(path.read_bytes()).hexdigest()
        if old_hash == new_hash:
            return False
    path.write_text(content)
    log.info("wrote %s (%d bytes, sha256=%s)", path, len(content), new_hash[:12])
    return True


def tick() -> None:
    try:
        trunks, dids, call_flows = fetch_state()
        log.info("fetched %d trunks, %d dids, %d call_flows", len(trunks), len(dids), len(call_flows))
    except Exception as e:
        log.error("fetch_state failed: %s", e)
        return

    pjsip = gen_pjsip(trunks)
    dialplan = gen_dialplan(trunks, dids, call_flows)

    changed = False
    changed |= write_if_changed(PJSIP_OUT, pjsip)
    changed |= write_if_changed(DIALPLAN_OUT, dialplan)

    if changed:
        log.info("config changed → reloading asterisk")
        reload_asterisk()

    # Process CDR (call detail records) → push to Supabase
    try:
        tenant_map, trunk_to_tenant = _fetch_tenant_map()
        process_cdr(tenant_map, trunk_to_tenant)
    except Exception as e:
        log.error("CDR processing failed: %s", e)


def main() -> None:
    log.info(
        "xyra-sync starting (interval=%ds, output=%s, ctnr=%s, oneshot=%s)",
        INTERVAL, OUTPUT_DIR, ASTERISK_CTNR, ONESHOT,
    )
    if ONESHOT:
        tick()
        return

    while True:
        tick()
        time.sleep(INTERVAL)


if __name__ == "__main__":
    main()
