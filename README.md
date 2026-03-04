# Summoner Desktop

<p align="center">
  <img width="500px" src="assets/originals/summoner-logo-mark-gold-type.png" />
</p>

Summoner Desktop is a chat-based Electron app for interacting with TCP servers. It keeps long‑lived connections, lets you target remote agents, and structures messages with optional `to`/`from` fields.

[![Build & Release (mac + linux + windows)](https://github.com/Summoner-Network/summoner-desktop/actions/workflows/build-release.yml/badge.svg)](https://github.com/Summoner-Network/summoner-desktop/actions/workflows/build-release.yml)

## YouTube Demo Video

<p align="center">
  See Summoner Desktop in action in 4 minutes. Click the thumbnail to watch the walkthrough.
</p>

<p align="center">
  <a href="https://youtu.be/rOVRLYdC11U" target="_blank" rel="noopener noreferrer">
    <img src="assets/img/thumbnail_play_rounded.png" width="560" alt="Watch the Summoner Desktop demo on YouTube">
  </a>
</p>

## Getting Started

This guide helps you set up and run the app locally, even if you are new to Node.js or Electron.


### 1. Prerequisites: Install Node.js + npm

You will need **Node.js (v22.12 or later)** and **npm** (Node package manager). You can check if they're already installed:

```bash
node -v
npm -v
```

If either command is not found, install them:

#### macOS (recommended via [Homebrew](https://brew.sh)):

```bash
brew install node
```

#### Linux (Debian/Ubuntu):

```bash
sudo apt update
sudo apt install nodejs npm
```

> 💡 Tip: You can also use [nvm](https://github.com/nvm-sh/nvm) to manage multiple Node.js versions if you're working on different projects.

#### Windows

Use the official installer at [https://nodejs.org/en](https://nodejs.org/en). See the [docs](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm) for Node.js and npm. 


### 2. Clone the repository

```bash
git clone https://github.com/Summoner-Network/summoner-desktop.git
cd summoner-desktop
```

### 3. Install the app

#### Run the app

For developers:

```bash
npm install
npm run dev
```

#### Build the app

For users:

```bash
npm install
npm run dist
```

Outputs installers into `release/`.

## Requirements (Complete)

This section is designed so you can use the desktop app without running into missing tools. If you want **full functionality** (projects, local server, agents), install everything below.

### Core (run the desktop app)
- **Node.js v22.12+** and **npm** (required for dev/run/build)

### Full functionality (recommended to avoid broken flows)
- **Git** (required for creating projects or importing agents)
- **Python** (required for running local server and agents)
  - The app will try `.venv`/`venv` first, then `python3`, then `python`
- **pip** (required to install agent `requirements.txt`)
- **bash** (macOS/Linux) or **PowerShell** (Windows)
  - Used by the project setup/reset scripts
- **macOS/Linux:** `lsof` (used to find/stop processes by port)
- **Windows:** `netstat` (used to find/stop processes by port)

### macOS packaging only
- **xattr** (used by `npm run dist:mac`)

### Why these are needed
- **Project creation/reset** clones `summoner-sdk` using `git` and runs setup scripts (`bash` or PowerShell).
- **Local server + agents** run Python scripts and install dependencies with `pip`.
- **Port cleanup** uses `lsof` or `netstat` to detect/stop stuck processes.

## How to use

This is the main chat view for agent management, interaction, and monitoring message flow.

<p align="center">
  <img src="assets/img/screenshot_rounded.png" width="400">  
</p>

### 1) Pick a server
- Open **Servers** to add or select a TCP server.
- The default servers are:
  - **Default Space** (`187.77.102.80:8888`)
  - **Localhost** (`127.0.0.1:8888`)
- Clicking a server in **My Servers** switches the chat to that server.

### 2) Chat
- Type a message and press **Enter**.
- Use **Shift+Enter** for a new line.

### 3) Target a remote agent (optional)
When a server sends messages, the app captures the sender’s `remote_addr`.

- Click a remote agent in **My Network**.
- In the chat footer, set **Sending to**:
  - `none` → no `to` field
  - `null` → `to: null`
  - `key: <path>` → `to` becomes the selected value from the remote payload
    - Example path: `from`, `meta.user.id`, `items[0].name`

### 4) Send as an identity (optional)
Identities are JSON objects that become the `from` field in outgoing messages.

- Go to **Identities** and create or edit an identity.
- In chat, choose **Sending as** to set `from`.


## Message format

By default, messages are sent as plain text.

When **`to`** or **`from`** is set, outgoing payloads are wrapped as:

```json
{
  "payload": "Hello",
  "to": "Remy",
  "from": { "name": "Bot", "type": "agent" }
}
```

If you type a JSON object (e.g. `{"hello": 5}`), it will be sent as that object.  
If `to`/`from` are set, they are injected unless you already provided those keys.
