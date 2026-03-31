# Parsed — EC2 Deployment Steps

Self-hosted deployment on AWS EC2 using Ollama (no external AI API keys required).

---

## 1. Launch EC2 Instance

1. Go to **EC2 → Launch Instance**
2. Name: `parsed`
3. AMI: **Ubuntu Server 24.04 LTS**
4. Instance type: **t3.small** (minimum — t2.micro will crash during build)
5. Key pair: create or select existing `.pem`
6. Storage: **20 GB gp3**
7. Launch

---

## 2. Open Port 3000 in Security Group

1. EC2 → Instances → your instance → **Security** tab
2. Click the security group link
3. **Edit inbound rules** → **Add rule**:
   - Type: `Custom TCP`
   - Port: `3000`
   - Source: `0.0.0.0/0`
4. **Save rules**

---

## 3. SSH Into the Instance

Before the first SSH, fix the key permissions (required — SSH refuses connections if the key is world-readable):

```bash
chmod 400 aws_key.pem
```

Then connect:

```bash
sudo ssh -i aws_key.pem ubuntu@<EC2_PUBLIC_IP>
```

---

## 4. Add Swap Space (Required — Prevents Build OOM Kill)

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h
```

Expected output shows `Swap: 2.0G`.

---

## 5. Install Node.js via NVM

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.4/install.sh | bash

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

nvm install 20
nvm use 20
node -v
npm -v
```

---

## 6. Install Ollama

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

Ollama runs as a **systemd service** — starts automatically on every boot.

Verify:

```bash
curl http://localhost:11434
# Expected: Ollama is running
```

---

## 7. Pull AI Models

```bash
ollama pull tinyllama:latest        # LLM for chat — ~637 MB
ollama pull nomic-embed-text:latest # Embeddings for document indexing — ~274 MB

ollama list
# Both models should appear
```

> Pinecone index must use **768 dimensions** (nomic-embed-text output), cosine metric, name `parsed`.

---

## 8. Install PM2

```bash
sudo npm install -g pm2
```

---

## 9. Clone the Repository

**Public repo:**
```bash
cd ~
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git parsed
cd parsed
```

**Private repo** — create a Personal Access Token first:
1. GitHub → Settings → Developer Settings → Personal Access Tokens → Tokens (classic) → Generate new token
2. Scope: `repo` (full control of private repositories)
3. Copy the token, then clone using it:

```bash
git clone https://YOUR_GITHUB_TOKEN@github.com/YOUR_USERNAME/YOUR_REPO.git parsed
cd parsed
```

---

## 10. Configure Environment Variables

```bash
cp .env.example .env
nano .env
```

Set these values:

```bash
# Database (Neon)
DATABASE_URL=postgresql://...

# Auth — MUST use EC2 public IP, not localhost
BETTER_AUTH_SECRET=your_secret
BETTER_AUTH_URL=http://<EC2_PUBLIC_IP>:3000
NEXT_PUBLIC_APP_URL=http://<EC2_PUBLIC_IP>:3000

# File Storage (Vercel Blob — cloud service, works from anywhere)
BLOB_READ_WRITE_TOKEN=your_token

# AI — Ollama only, no API keys needed
LLM_PROVIDER=ollama
LLM_MODEL=tinyllama
EMBEDDING_PROVIDER=ollama
EMBEDDING_MODEL=nomic-embed-text
OLLAMA_BASE_URL=http://localhost:11434

# Inngest — run locally, no cloud account needed
INNGEST_DEV=1

# Pinecone
PINECONE_API_KEY=your_key
PINECONE_INDEX_NAME=parsed

# Pusher (for real-time upload progress)
PUSHER_APP_ID=
PUSHER_KEY=
PUSHER_SECRET=
PUSHER_CLUSTER=
NEXT_PUBLIC_PUSHER_KEY=
NEXT_PUBLIC_PUSHER_CLUSTER=
```

Save: `Ctrl+O` then `Ctrl+X`

---

## 11. Install Dependencies

```bash
npm install
```

---

## 12. Run Database Migrations

```bash
npm run db:migrate
```

---

## 13. Build the App

```bash
npm run build
```

This runs two steps in order:
1. `build:widget` — installs widget dependencies and compiles `public/widget.js`
2. `next build` — compiles the Next.js app

Takes a few minutes. If it gets killed silently, swap is too small (Step 4).

---

## 14. Start with PM2

`npm start` runs **Next.js** (`next start`) and the **Inngest dev server** together via `concurrently`.

Start the app:

```bash
pm2 start npm --name "parsed" -- start
```

Set up PM2 to auto-start on server reboot — **order matters**:

```bash
# 1. Generate the systemd startup script
pm2 startup
# pm2 will print a command — copy it and run it. Looks like:
# sudo env PATH=$PATH:/home/ubuntu/.nvm/versions/node/v20.x.x/bin pm2 startup systemd -u ubuntu ...

# 2. After running that command, save the current process list
pm2 save
```

`pm2 save` must be run AFTER `pm2 start` — it snapshots which processes to restore on reboot.

---

## 15. Verify

```bash
pm2 status
# parsed should show as "online"

pm2 logs parsed
# Watch for Next.js ready message
```

Open in browser: `http://<EC2_PUBLIC_IP>:3000`

---

## How Everything Fits Together

```
Server Boot
    │
    ├── systemd → Ollama (port 11434)     ← auto-start via systemd
    │               ├── tinyllama          (LLM for chat)
    │               └── nomic-embed-text   (embeddings)
    │
    └── PM2 → npm start                   ← auto-start via PM2
                ├── next start  :3000      (Next.js app)
                └── inngest-cli dev :8288  (background job runner)
```

---

## Updating the App

```bash
cd ~/parsed
git pull
npm install            # only if package.json changed
npm run db:migrate     # only if schema files changed
npm run build
pm2 restart parsed
```

---

## Useful Commands

```bash
pm2 status                    # check if app is running
pm2 logs parsed               # live logs
pm2 logs parsed --lines 100   # last 100 log lines
pm2 restart parsed            # restart after changes
pm2 save                      # save process list for reboot

ollama list                   # list installed models
curl http://localhost:11434   # check Ollama is running

free -h                       # memory + swap usage
df -h                         # disk space
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `ssh: bad permissions` | `.pem` file is world-readable | `chmod 400 your-key.pem` — Step 3 |
| Build gets killed (`Killed`) | Not enough RAM | Add swap — Step 4 |
| Build fails at `build:widget` step | Widget deps not installed | `cd widget && npm ci` then retry `npm run build` from root |
| `db:migrate` fails | Wrong `DATABASE_URL` or DB unreachable | Double-check `.env`, verify Neon project is active |
| App loads but sign-in fails with `ERR_CONNECTION_REFUSED` | `BETTER_AUTH_URL` still set to `localhost` | Set to `http://<EC2_IP>:3000` in `.env`, rebuild |
| File stuck at "Uploading…" forever | Inngest not running | Add `INNGEST_DEV=1` to `.env`, restart |
| App doesn't restart after reboot | `pm2 save` ran before startup command | Re-run `pm2 startup`, run printed command, then `pm2 save` |
| `crypto.randomUUID is not a function` | HTTP context — browser restricts this to HTTPS | Fixed in code via `generateId()` in `src/lib/utils.ts` |
| `DOMMatrix is not defined` on server | Browser-only library imported server-side via barrel | Fixed — viewer components removed from `src/components/files/index.ts` barrel |
| 500 on any API route | Runtime error — check logs | `pm2 logs parsed --lines 50` |
| Port 3000 not reachable | Security group missing rule | Add inbound TCP 3000 rule — Step 2 |
