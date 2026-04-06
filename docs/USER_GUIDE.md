# Xyra Voice — User Guide

Welcome to **Xyra Voice**, your cloud-based Virtual PBX. This guide will walk you through setting up and using your business telephony system.

---

## Getting Started

### 1. Create your account

1. Go to [your Xyra Voice URL]
2. Click **"Get Started Free"**
3. Fill in:
   - **Full Name** — your name
   - **Company Name** — your business (this becomes your tenant)
   - **Email** — used for login and notifications
   - **Password** — at least 6 characters
4. Click **Create Account**
5. You'll be taken to your dashboard

> Your company is now isolated from all other Xyra Voice tenants. Only people you invite can see your data.

---

## Dashboard Overview

The dashboard shows you at a glance:
- **Extensions** — how many SIP users you have
- **Trunks** — connected SIP providers
- **Call Flows** — routing rules configured
- **Quick Actions** — shortcuts to common tasks

The sidebar lets you navigate between:
| Section | Purpose |
|---------|---------|
| Dashboard | Overview and stats |
| Extensions | Manage SIP users (your team) |
| Trunks | Connect to SIP providers |
| Call Flow | Configure how calls are routed |
| Settings | Profile and company name |

---

## Step 1: Create Extensions

An **extension** is a SIP user — usually one per employee or device.

1. Click **Extensions** in the sidebar
2. Click **+ New Extension**
3. Fill in:
   - **Extension Number** — e.g. `101`, `102` (2-6 digits)
   - **Display Name** — e.g. "John Doe" or "Reception"
   - **Max Concurrent Calls** — usually 2 is fine
4. Click **Create Extension**

### What happens
Xyra automatically generates:
- A **SIP username** (globally unique, used by your SIP server)
- A **SIP password** (16-character random)

You'll need these credentials to register a softphone or IP phone. Click the password field to reveal it.

### Managing extensions
- **Toggle Active/Disabled** — temporarily disable an extension without deleting it
- **Delete** — permanently remove (with confirmation)

> **Tip:** Use a numbering plan. For example: 100s for sales, 200s for support, 300s for management.

---

## Step 2: Connect a SIP Trunk

A **SIP trunk** is your connection to the outside phone network. You need credentials from a SIP provider (e.g. FlashTelecom, Telnyx, Twilio, VoIP.ms).

1. Click **Trunks** in the sidebar
2. Click **+ Add Trunk**
3. Fill in the details from your provider:

| Field | Example | Where to get it |
|-------|---------|----------------|
| **Trunk Name** | "Main Line" | Any label you want |
| **Host** | `sip.flashtelecom.com` | Your provider's SIP server |
| **Port** | `5060` | Usually 5060 (UDP/TCP) or 5061 (TLS) |
| **Transport** | UDP / TCP / TLS | Whatever your provider supports — TLS is most secure |
| **Username** | `12345` | Your SIP account username |
| **Password** | `••••••` | Your SIP account password |

4. Click **Add Trunk**

### Managing trunks
- **Edit** — update credentials or settings
- **Toggle Active/Disabled** — temporarily disable
- **Delete** — remove permanently

> **You don't need to buy numbers from us.** Bring your own SIP provider — your numbers stay with them, you just connect them to Xyra Voice.

---

## Step 3: Configure Call Flow

A **call flow** is how an incoming call is handled. You can build flows using three types of steps:

### IVR Menu — "Press 1 for sales, 2 for support..."
- A greeting message plays
- Caller presses a key
- Each key routes to a different extension

### Ring Group — Ring multiple extensions at once
- **Simultaneous** — all phones ring at the same time
- **Sequential** — phones ring one by one
- Set a timeout before falling back

### Call Forward — Send calls to another number
- **Always** — always forward
- **When Busy** — only when the destination is busy
- **No Answer** — only if not picked up

### Building a flow

1. Click **Call Flow** in the sidebar
2. Click **+ New Call Flow**
3. Give it a name (e.g. "Main Office Hours")
4. Click the flow to expand it
5. Click **Add step:** then choose IVR, Ring Group, or Call Forward
6. Configure each step
7. Click **Save Changes**

Steps run in order from top to bottom. You can add as many as you need.

### Example flow: "Business Hours Reception"
1. **IVR Menu** — Greeting: "Welcome to Acme. Press 1 for sales, 2 for support, 0 for reception."
   - Option `1` → Ext 101 (Sales)
   - Option `2` → Ext 201 (Support)
   - Option `0` → Ext 301 (Reception)
2. (If no option selected → next step)
3. **Ring Group** — Ring all reception extensions for 30s
4. **Call Forward** — No Answer → mobile number `+34600123456`

---

## Step 4: Use the Softphone

The **softphone** is the floating phone button at the bottom-right of every page. Use it to make and receive calls directly from your browser — no separate app needed.

### Connect for the first time
1. Click the floating phone button (bottom-right)
2. Click the **gear icon** (top-right of softphone panel)
3. Fill in:
   - **SIP Server** — your Xyra Voice SIP server WebSocket URL (e.g. `wss://sip.xyravoice.com:8089/ws`)
   - **SIP Domain** — your SIP server domain
   - **Extension** — pick from the dropdown (your created extensions)
4. Click **Done** → **Connect**
5. Status should show **"Registered"** in green

### Making a call
1. Type a number in the input field, OR use the dial pad
2. Click **Call**
3. The call connects via your selected trunk
4. During the call:
   - **Mute** — toggle your microphone
   - **Hangup** — end the call
   - **Live timer** — see call duration

### Receiving a call
- The softphone pops up automatically
- Shows the caller's number
- Click **Accept** or **Reject**

### Browser permissions
The first time you connect, your browser will ask for **microphone access**. You must allow this for calls to work.

---

## Settings

### Update your profile
**Settings** → edit your full name → **Save Profile**

### Change company name
**Settings** → edit company name → **Save Company**

> Email and role can't be changed from here. Contact your admin to change roles.

---

## Sign Out
Click **Sign Out** at the bottom of the sidebar.

---

## Troubleshooting

### "Connection failed" on softphone
- Check your SIP server URL (must be `wss://...`)
- Make sure the extension you selected is **enabled** in the Extensions page
- Try refreshing the page
- Check that your browser allowed microphone access

### Can't hear the other person
- Check your speaker volume
- Check browser tab isn't muted (right-click tab → unmute)
- Try a different browser (Chrome/Edge work best)

### Other person can't hear you
- Check your microphone permission (browser address bar → site settings)
- Click **Mute → Unmute** in the softphone
- Test your microphone in your computer's sound settings

### "Extension already exists" error
- That extension number is already used in your tenant
- Choose a different number

### Forgot password
- Go to the login page
- Click **"Forgot password?"** (or contact your admin)
- Check your email for the reset link

### Email not arriving
- Check your spam folder
- Make sure your email is correct in your profile
- Contact support if it still doesn't arrive

---

## FAQs

### How many extensions can I create?
No hard limit — depends on your subscription plan.

### Can multiple people use the same extension?
Yes — you can register the same SIP credentials on a desk phone, mobile app, and the web softphone simultaneously (up to your `Max Concurrent Calls` setting).

### Do I need to buy phone numbers from Xyra Voice?
No. Bring your own SIP trunk from any provider. Xyra Voice is the PBX layer — your numbers stay with your provider.

### Can I record calls?
Coming in a future update.

### Can I see call history?
Coming in a future update.

### Is my data isolated from other companies?
Yes. Xyra Voice uses **Row-Level Security** — your data is completely isolated at the database level. Other tenants cannot see anything from your company.

### What browsers are supported?
- **Chrome** ✓ (recommended)
- **Edge** ✓
- **Firefox** ✓
- **Safari** ✓
- Mobile Chrome/Safari ✓

---

## Need Help?

Contact support at: **support@xyravoice.com** (or your configured support email)
