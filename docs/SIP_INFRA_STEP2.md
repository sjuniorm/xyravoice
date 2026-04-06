# SIP Infrastructure — Step 2: Authentication

This step makes Kamailio actually authenticate SIP users from your Supabase database.

After Step 2 you can register a softphone from the browser and see "Registered" — but **calls still won't work end-to-end** (that's Step 3).

---

## What changes

| Component | Change |
|-----------|--------|
| **Supabase** | New role `kamailio_ro` (read-only on `sip_users`) |
| **Kamailio config** | Loads `db_postgres`, `auth`, `auth_db`, `registrar`, `usrloc` modules. Handles REGISTER with auth. |
| **Secrets file** | New file at `infra/kamailio/secrets/kamailio-db.cfg` (gitignored) holds the DB connection string |

---

## 1 — Get your Supabase DB password

1. Go to **Supabase Dashboard → Project Settings → Database**
2. Scroll to **"Database password"**
3. If you've never used it, click **"Reset database password"** (Supabase will show it once — copy it now)
4. Save it somewhere temporary — you'll only need it for the next step

> **Note:** The "DB password" is different from the anon key. The anon key is for the browser; the DB password is for direct Postgres connections.

---

## 2 — Generate a strong password for kamailio_ro

On your local machine or the VPS:

```bash
openssl rand -base64 24
```

Copy the output. This will be the password for the new `kamailio_ro` role.

---

## 3 — Create the kamailio_ro role in Supabase

1. Open **Supabase SQL Editor → New query**
2. Paste the contents of [supabase/migrations/004_kamailio_role.sql](../supabase/migrations/004_kamailio_role.sql)
3. **Replace `CHANGE_ME_STRONG_PASSWORD`** (appears twice) with the password you generated in step 2
4. Click **Run**

Verify the bottom result panels show:
- A row with `kamailio_ro | t` (rolcanlogin = true)
- A new policy `Kamailio can read all sip_users` for role `{kamailio_ro}`

---

## 4 — Pull the latest code on your VPS

```bash
ssh root@<your-vps-ip>
cd /opt/xyravoice
git pull
cd infra
```

---

## 5 — Run the secrets setup script

```bash
chmod +x setup-kamailio-secrets.sh
apt install -y postgresql-client   # so we can test the connection
./setup-kamailio-secrets.sh
```

The script will:
1. Ask for the Supabase DB host (default works for your project)
2. Ask for the **kamailio_ro password** (the one you generated, NOT the main DB password)
3. Write `kamailio/secrets/kamailio-db.cfg` with the URL-encoded connection string
4. Test the connection with `psql` → should print a count from `sip_users`

If the test fails:
- Check you ran step 3 (the SQL migration)
- Check you used the right password
- Re-run the script

---

## 6 — Restart Kamailio with the new config

```bash
docker compose restart kamailio
sleep 3
docker compose ps
docker compose logs kamailio --tail 30
```

You should see:
- `xyra-kamailio` showing **Up** (not Restarting)
- Log line: `init_mod(): db_postgres successfully initialized`
- No error lines

---

## 7 — Test SIP REGISTER with auth

From your laptop, install `sipsak` if you don't have it:
```bash
brew install sipsak    # macOS
# or
apt install sipsak     # Linux
```

Then try a REGISTER without auth — should get a 401 challenge:
```bash
sipsak -U -s sip:nonexistent@sip.xyrachat.com
```
Expected: `401 Unauthorized`

That's correct — Kamailio is now requiring auth!

---

## 8 — Test from the web softphone

1. Open your Vercel app (e.g. `https://xyravoice.vercel.app`)
2. Log in
3. Make sure you have an extension created (Extensions page → + New Extension)
4. Open the **Softphone** (bottom-right floating button)
5. Click the **gear icon** → enter:
   - **SIP Server**: `wss://sip.xyrachat.com/ws`
   - **SIP Domain**: `sip.xyrachat.com`
   - **Extension**: pick your extension from the dropdown
6. Click **Done** → **Connect**

You should see:
- Status: **Registered** (green wifi icon)
- Extension number shown next to it

If you see "Connection failed":
- Open browser DevTools → Network → look for the WSS request
- `docker compose logs kamailio --tail 50` on the VPS to see what Kamailio said

---

## ✅ Step 2 complete

You now have:
- A read-only Supabase role with minimal access
- Kamailio authenticating SIP users against your live `sip_users` table
- Browser softphones can register

**You still cannot make real calls** — Step 3 will:
- Forward authenticated INVITEs from Kamailio → Asterisk
- Configure Asterisk to route calls based on the destination
- Wire up your `call_flows` table to actual Asterisk dialplans

---

## Troubleshooting

### Kamailio fails to start with "db_postgres" error
- The secrets file might be missing or have a typo
- Test the connection manually: `PGPASSWORD='your-pass' psql -h db.bfrnuhdihiidchsozdxm.supabase.co -U kamailio_ro -d postgres -c "select 1"`

### "401 Unauthorized" from softphone, but credentials are correct
- Make sure the softphone is using the **SIP username** (e.g. `t_a1b2c3d4_101`) not the extension number
- Check that the extension is **enabled** in the web app
- Look at Kamailio logs: `docker compose logs kamailio | grep -i auth`

### Connection works but no rows visible
- The RLS policy from migration 004 might not have been created
- Re-run the SQL migration in Supabase
- Verify with: `select policyname, roles from pg_policies where tablename = 'sip_users';`

### "no encryption" error from Postgres
- The DBURL must include `?sslmode=require` — the setup script adds this automatically
