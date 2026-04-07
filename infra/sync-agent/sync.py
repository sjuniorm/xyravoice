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


# ─── DB ─────────────────────────────────────────────────────
def fetch_state() -> tuple[list[Trunk], list[Did]]:
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
    return trunks, dids


# ─── Generators ─────────────────────────────────────────────
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
            f"[{t.slug}]",
            "type=identify",
            f"endpoint={t.slug}",
            f"match={t.host}",
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


def gen_dialplan(trunks: list[Trunk], dids: list[Did]) -> str:
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
            else:
                # callflow — TODO Step 5
                lines += [
                    f"; DID {d.did_number} → callflow {d.destination_value} (TODO)",
                    f"exten => {did_no_plus},1,NoOp(Callflow not implemented yet)",
                    " same => n,Hangup(1)",
                    "",
                ]

        lines += [
            "exten => _X.,1,NoOp(Unmatched inbound DID: ${EXTEN})",
            " same => n,Hangup(1)",
            "",
        ]

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
        trunks, dids = fetch_state()
        log.info("fetched %d trunks, %d dids", len(trunks), len(dids))
    except Exception as e:
        log.error("fetch_state failed: %s", e)
        return

    pjsip = gen_pjsip(trunks)
    dialplan = gen_dialplan(trunks, dids)

    changed = False
    changed |= write_if_changed(PJSIP_OUT, pjsip)
    changed |= write_if_changed(DIALPLAN_OUT, dialplan)

    if changed:
        log.info("config changed → reloading asterisk")
        reload_asterisk()


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
