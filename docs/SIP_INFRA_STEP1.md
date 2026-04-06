# SIP Infrastructure — Step 1: Foundation

This guide walks you through deploying the **base SIP server stack** on your Hetzner CX22.

By the end of Step 1, you'll have:
- Kamailio + Asterisk + Nginx running in Docker
- A valid TLS certificate from Let's Encrypt
- Health check accessible at `https://sip.yourdomain.com/health`
- Kamailio responding to SIP `OPTIONS` pings

**No real calls work yet** — that comes in Step 2 (auth + routing).

---

## 0 — Prerequisites

| Item | What you need |
|------|---------------|
| **VPS** | Hetzner CX22, Ubuntu 22.04 or 24.04 |
| **Public IP** | The IPv4 address of your CX22 (Hetzner Cloud Console → Server) |
| **Domain** | A subdomain (e.g. `sip.xyravoice.com`) |
| **SSH access** | You can `ssh root@<your-ip>` |

---

## 1 — Point your subdomain to the VPS

In your DNS provider (Cloudflare, Namecheap, etc.):

| Type | Name | Value | TTL |
|------|------|-------|-----|
| `A`  | `sip` | `<your-CX22-public-IP>` | Auto |

> **If using Cloudflare:** Set the proxy status to **"DNS only"** (grey cloud, not orange). Cloudflare's proxy doesn't support SIP/RTP traffic.

Verify with:
```bash
dig +short sip.yourdomain.com
# should print your VPS IP
```

---

## 2 — Configure the Hetzner Cloud Firewall

In **Hetzner Cloud Console → Firewalls → Create Firewall**, add these rules and apply to your CX22:

### Inbound rules

| Protocol | Port | Source | Purpose |
|----------|------|--------|---------|
| TCP | 22 | Your IP (or 0.0.0.0/0) | SSH |
| TCP | 80 | 0.0.0.0/0 | Let's Encrypt HTTP challenge |
| TCP | 443 | 0.0.0.0/0 | HTTPS / WSS for browsers |
| UDP | 5060 | 0.0.0.0/0 | SIP (UDP) — for IP phones, trunks |
| TCP | 5060 | 0.0.0.0/0 | SIP (TCP) |
| UDP | 10000-20000 | 0.0.0.0/0 | RTP (audio media) |
| ICMP | — | 0.0.0.0/0 | Ping (optional but useful) |

### Outbound rules
Leave default (allow all).

> **Why so many RTP ports?** Each call uses a unique pair of UDP ports for audio. 10,000 ports = capacity for ~5,000 simultaneous calls, which is overkill but standard.

---

## 3 — Initial VPS setup

SSH into your CX22:

```bash
ssh root@<your-vps-ip>
```

Install Docker + Docker Compose + Certbot:

```bash
apt update && apt upgrade -y
apt install -y curl ca-certificates git ufw certbot

# Install Docker
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker

# Verify
docker --version
docker compose version
```

> Note: We're using Hetzner's cloud firewall above, but if you also want host-level firewall, ufw is installed too.

---

## 4 — Clone the Xyra Voice repo

```bash
cd /opt
git clone https://github.com/sjuniorm/xyravoice.git
cd xyravoice/infra
```

---

## 5 — Get a Let's Encrypt certificate

Replace `sip.yourdomain.com` and `you@yourdomain.com` below.

```bash
# Create the webroot directory for ACME challenges
mkdir -p /var/www/certbot

# Stop anything that might be on port 80
docker compose down 2>/dev/null || true

# Run certbot in standalone mode
certbot certonly --standalone \
  -d sip.yourdomain.com \
  --email you@yourdomain.com \
  --agree-tos --no-eff-email --non-interactive

# Copy certs into our infra folder so docker can mount them
mkdir -p ./letsencrypt
cp -rL /etc/letsencrypt/live ./letsencrypt/
cp -rL /etc/letsencrypt/archive ./letsencrypt/
```

> The cert is now at `./letsencrypt/live/sip.yourdomain.com/fullchain.pem`

---

## 6 — Replace the domain placeholder in nginx config

```bash
sed -i 's/SIP_DOMAIN_PLACEHOLDER/sip.yourdomain.com/g' nginx/nginx.conf
```

Verify:
```bash
grep server_name nginx/nginx.conf
# should show your real domain twice
```

---

## 7 — Start the stack

```bash
docker compose up -d
```

Check that all 3 containers are running:

```bash
docker compose ps
```

You should see:
```
NAME             STATUS
xyra-asterisk    Up
xyra-kamailio    Up
xyra-nginx       Up
```

---

## 8 — Verify everything works

### Test 1: Nginx health check
```bash
curl https://sip.yourdomain.com/health
# Expected: "Xyra Voice SIP gateway online"
```

### Test 2: Kamailio responds to OPTIONS
From your **local machine** (not the VPS), install `sipsak`:
```bash
# macOS
brew install sipsak
# Linux
apt install sipsak
```

Then ping the SIP server:
```bash
sipsak -O sip.yourdomain.com -s sip:test@sip.yourdomain.com
# Expected: 200 "Xyra Voice — Kamailio Online"
```

### Test 3: WebSocket reachability
```bash
curl -i \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Key: x3JJHMbDL1EzLkh9GBhXDw==" \
  -H "Sec-WebSocket-Version: 13" \
  https://sip.yourdomain.com/ws
# Expected: HTTP/1.1 101 Switching Protocols (or similar handshake response)
```

### Test 4: Container logs
```bash
docker compose logs kamailio | tail -20
docker compose logs asterisk | tail -20
docker compose logs nginx | tail -20
```

No error messages = all good.

---

## 9 — Auto-renew Let's Encrypt cert

Add a cron job to renew weekly:
```bash
crontab -e
```
Add:
```
0 3 * * 0 certbot renew --quiet --deploy-hook "cp -rL /etc/letsencrypt/live /opt/xyravoice/infra/letsencrypt/ && cp -rL /etc/letsencrypt/archive /opt/xyravoice/infra/letsencrypt/ && docker compose -f /opt/xyravoice/infra/docker-compose.yml restart nginx"
```

---

## ✅ Step 1 complete

You now have:
- A running SIP server on `sip.yourdomain.com`
- Valid TLS certificate
- Kamailio listening on UDP 5060, TCP 5060, WS 8088
- Nginx terminating TLS for browsers on 443/wss
- Asterisk listening on 5080 (internal), waiting for calls from Kamailio

**You cannot make real calls yet.** Next steps:
- **Step 2** — PostgreSQL auth (Kamailio reads SIP credentials from Supabase)
- **Step 3** — Routing logic (Kamailio → Asterisk for PBX features)
- **Step 4** — Asterisk dialplan that reads call_flows from Supabase
- **Step 5** — Test end-to-end call from your browser softphone

---

## Troubleshooting

### `docker compose up` fails
```bash
docker compose logs <service-name>
```

### Cert error / nginx won't start
- Make sure DNS A record is propagated (`dig sip.yourdomain.com`)
- Check `./letsencrypt/live/sip.yourdomain.com/fullchain.pem` exists
- Verify nginx config: `docker compose exec nginx nginx -t`

### Kamailio won't start
- Check syntax: `docker compose run --rm kamailio kamailio -c -f /etc/kamailio/kamailio.cfg`
- Check ports aren't already used: `ss -tulnp | grep -E '5060|8088'`

### Browser softphone "Connection failed"
- Open browser DevTools → Network → check the WSS request
- Try `wss://sip.yourdomain.com/ws` (with `/ws` path!)
- Make sure the cert is valid (visit `https://sip.yourdomain.com/health` in a browser)
