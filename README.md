# ClawDocu

**Self-hosted documentation discussion with inline comments.**

A simple, single-user version of ClawDocu that you can deploy on your own VPS.

## Features

- 📁 **Project Browser** - Add any GitHub repository (public or private)
- 📄 **File Viewer** - View code with syntax highlighting
- 📝 **Markdown Support** - Rendered markdown files
- 💬 **Inline Comments** - Click line numbers to add comments
- 🔄 **Version Controlled** - Comments stored in `.clawdocu/` folder in your repo
- 🔓 **No Vendor Lock-in** - Your data stays in your repo
- 🚀 **Portable** - Move repos, comments follow
- 🔐 **Simple Auth** - Single admin password, no OAuth setup needed

## Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/clawish/clawdocu.git
cd clawdocu
npm install
```

### 2. Configure Environment

Create a `.env` file:

```env
ADMIN_PASSWORD=your_secure_password
GITHUB_TOKEN=your_github_personal_access_token
```

**Getting a GitHub Token:**
1. Go to https://github.com/settings/tokens
2. Generate new token (classic)
3. Select `repo` scope for private repos, `public_repo` for public only

### 3. Run

```bash
npm run dev
```

Open http://localhost:3000

## Deployment

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN npm run build
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
```

```bash
docker build -t clawdocu-community .
docker run -p 3000:3000 -e ADMIN_PASSWORD=secret -e GITHUB_TOKEN=ghp_xxx clawdocu-community
```

### VPS (Manual)

```bash
# Build
npm run build

# Run with PM2
pm2 start .output/server/index.mjs --name clawdocu
```

## How It Works

### Comment Storage

Comments are stored in a `.clawdocu/` folder in your repository:

```
your-repo/
├── .clawdocu/
│   ├── src/
│   │   ├── index.js.json    # Comments for index.js
│   │   └── utils.ts.json    # Comments for utils.ts
│   └── README.md.json       # Comments for README.md
├── src/
│   ├── index.js
│   └── utils.ts
└── README.md
```

Each JSON file contains:

```json
{
  "comments": [
    {
      "id": "1234567890",
      "line": 5,
      "text": "This function needs better error handling",
      "createdAt": "2026-04-07T12:00:00.000Z"
    }
  ]
}
```

## License

MIT
