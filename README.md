# ClawDocu

**Comment on docs. Discuss with your Claw.**

A Claw-native documentation review tool. Make suggestions directly on docs, let your Claw improve them.

## Features

- 📝 **Inline Comments** - Select any text or line, add comments. Your Claw sees the exact context and responds.
- 🤖 **Claw-Friendly Access** - Comments are stored as plain text format locally in the system. The Claw reads them directly - no need fetch from remote.
- 🌐 **Access Anywhere** - Comment and discuss your docs within Telegram or any other Claw chat app. No separate app switching.
- 📄 **Any File Type** - Comment on code, markdown, config files, or any text file. Not just code - all your documentation.
- 🔄 **GitHub Integration** - Connect your git repository. Browse files, add comments within your repo directly.
- 🔐 **Self-Hosted** - Deploy on your own VPS. Your code and comments stay on your infrastructure.

## Installation

### Option 1: Docker (Recommended)

**Using pre-built image:**

```bash
# Create a directory for ClawDocu
mkdir clawdocu && cd clawdocu

# Pull from GitHub Container Registry
docker pull ghcr.io/clawish/clawdocu:latest

# Create .env file
cat > .env << EOF
ADMIN_PASSWORD=your_secure_password
GITHUB_TOKEN=ghp_your_token
EOF

# Run
docker run -d -p 3000:3000 --env-file .env ghcr.io/clawish/clawdocu:latest
```

Open http://localhost:3000

**Or build from source:**

```bash
git clone https://github.com/clawish/clawdocu.git
cd clawdocu
cp .env.example .env
# Edit .env with your values
docker compose up -d
```

### Option 2: Git Clone + npm

For developers who want to customize or contribute:

```bash
# Clone
git clone https://github.com/clawish/clawdocu.git
cd clawdocu

# Install dependencies
npm install

# Configure
cp .env.example .env
# Edit .env with your password and GitHub token

# Development
npm run dev

# Production build
npm run build
npm start
```

### Option 3: VPS with PM2

For traditional VPS deployment:

```bash
git clone https://github.com/clawish/clawdocu.git
cd clawdocu
npm install
npm run build

# Install PM2
npm install -g pm2

# Start
pm2 start .output/server/index.mjs --name clawdocu

# Save PM2 config
pm2 save
pm2 startup
```

## Configuration

### Step 1: Create Environment File

Copy the example file and edit it:

```bash
cp .env.example .env
```

### Step 2: Set Admin Password

Edit `.env` and set a secure password:

```env
ADMIN_PASSWORD=your_secure_password_here
```

This password is used to log in to ClawDocu.

### Step 3: Get GitHub Token

ClawDocu needs a GitHub Personal Access Token to access your repositories.

**How to create a GitHub token:**

1. Go to **GitHub Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)**
   
   Direct link: https://github.com/settings/tokens

2. Click **"Generate new token"** → **"Generate new token (classic)"**

3. Fill in the form:
   - **Note:** `ClawDocu` (or any name you like)
   - **Expiration:** Choose based on your security needs (90 days, 1 year, or no expiration)
   - **Select scopes:**
     - ✅ `repo` - Full access to private and public repositories
     - OR just `public_repo` - If you only need public repositories

4. Click **"Generate token"** at the bottom

5. **Copy the token immediately** (you won't see it again!)
   
   It looks like: `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### Step 4: Add Token to .env

Edit `.env` and paste your token:

```env
ADMIN_PASSWORD=your_secure_password_here
GITHUB_TOKEN=ghp_your_token_here
```

**Security Notes:**
- Never commit `.env` to git (it's already in `.gitignore`)
- Keep your token secure - it has access to your repositories
- If compromised, delete the token in GitHub settings and generate a new one

## How to Use

### 1. Log In

Open http://localhost:3000 in your browser. Enter your admin password to log in.

### 2. Add a Project

1. Click **"Add Project"** on the dashboard
2. Enter a GitHub repository URL (e.g., `https://github.com/owner/repo`)
3. Click **"Add"** - the repo appears in your project list

### 3. Browse Files

1. Click on a project to open it
2. Use the file tree on the left to navigate folders and files
3. Click any file to view its content with syntax highlighting

### 4. Add Comments

1. Open a file
2. **Select text** you want to comment on
3. A **"Comment"** button appears - click it
4. Type your comment and press **Enter** or click **Save**

### 5. View Comments

- Comments appear in the right sidebar, positioned at their line numbers
- Click a comment to scroll to that line
- Each comment shows the selected text and your note

### 6. Sync to GitHub

Comments are stored locally. To save them to your repository:

1. Click the **"Sync"** button in the header
2. Comments are committed to `.clawdocu/` folder in your repo
3. Your Claw can now read them directly from the repo

### Mobile Usage

On mobile devices:
- Use the **bottom tabs** to switch between Files and Comments
- Tap **Files** to browse the repository
- Tap **Comments** to view all comments for the current file

## How It Works

### Comment Storage

Comments are stored in a `.clawdocu/` folder in your repository:

```
your-repo/
├── .clawdocu/
│   ├── src/
│   │   ├── index.js.json    # Comments for src/index.js
│   │   └── utils.ts.json    # Comments for src/utils.ts
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
      "id": "abc123",
      "line": 5,
      "text": "This function needs better error handling",
      "createdAt": "2026-05-01T12:00:00.000Z"
    }
  ]
}
```

### Claw-Native Format

Your Claw reads comments directly from the `.clawdocu/` folder:
- No API calls needed
- No CLI required
- Just share a line link in chat, ask questions

## License

MIT