<p align="center">
  <img width="500px" src="assets/summoner-logo-mark-trns.png" />
</p>


# Summoner Desktop

A modular Electron desktop app designed for rapid prototyping and collaboration.

### Preview

<p align="center">
  <img src="assets/demo_desktop_github.gif" width="500"  style="border:1px solid #ddd;border-radius:8px;box-shadow:0 2px 6px rgba(0,0,0,0.1)">  
</p>

## Features

- Clean login screen with customizable logo  
- Modular landing page where each feature is its own folder  
- Automatically generated buttons based on **folder names** or **`button_*.js`** files  
- Coordinate-driven grid layout (e.g. `n_m_<feature-name>` for row *n*, column *m*)  
- Template folder (`1_3_template_button`) with built-in Back/landing logic  
- Elegant, minimal white UI with subtle gradients  


## Getting Started

This guide helps you set up and run the app locally, even if you are new to Node.js or Electron.


### 1. Prerequisites: Install Node.js + npm

You will need **Node.js (v18 or later)** and **npm** (Node package manager). You can check if they're already installed:

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


### 2. Clone the repository

```bash
git clone https://github.com/Summoner-Network/summoner-desktop.git
cd summoner-desktop
```


### 3. Install project dependencies

Install all project dependencies and dev-only tools:

```bash
npm install && npm install glob electron-builder --save-dev
```

> 💡 glob is used by `scripts/inject-alert.js` to automatically find and modify all `renderer/**/index.html` pages before launching or packaging the app.


### 4. Update your package.json scripts
A build-time injection step has been added to insert a custom alert modal into every page, along with a setup hook that prepares user folders on first launch. Make sure your `"scripts"` section in `package.json` includes the following:

<details>
<summary><b>(Click to expand)</b>JSON format:</summary>

```jsonc
{
    "name": "summoner-desktop",
    // ...
    "description": "Desktop GUI for Summoner",
    "main": "main.js",
    // ...
    "scripts": {
        "inject-alert": "node scripts/inject-alert.js",
        "start": "npm run build:dev",
        "build": "npm run dist",
        "build:dev": "npm run inject-alert && electron .",
        "pack": "npm run inject-alert && electron-builder --dir",
        "dist": "npm run inject-alert && electron-builder --publish never"
    },
    "build": {
        // ...
        "productName": "Summoner Desktop",
        "asar": true,
        "files": [
            "**/*",
            "!scripts/**"
        ],
        "extraResources": [
            {
                "from": "scripts",
                "to": "scripts",
                "filter": [
                    "**/*.sh"
                ]
            }
        ],
        "mac": {
            "icon": "assets/mage_gif/logo_mage.icns",
            "target": [
                "dmg",
                "zip"
            ]
        },
        "win": {
            "icon": "assets/mage_gif/logo_mage.ico",
            "target": [
                "nsis"
            ]
        },
        "linux": {
            "icon": "assets/mage_gif/logo_mage.png",
            "target": [
                "AppImage",
                "deb"
            ]
        }
    },
    "devDependencies": {
        "electron": "^35.1.5",
        "electron-builder": "^26.0.12",
        "glob": "^11.0.2"
    }
}
```
</details>

### 4. Run the app

**Dev mode (launches Electron):**

```bash
npm start
```

**Build installers (output in `dist/`):**

```bash
npm run build
```

Then install by opening the generated file for your platform:

* macOS: `dist/*.dmg` or `*.pkg`
* Windows: `dist/*.exe`
* Linux: `dist/*.AppImage` or `*.deb`/`*.rpm` (depending on config)

> [!TIP]
> `npm run pack` builds an unpacked app directory in `dist/` without creating an installer.

## Project Structure

<details>
<summary><b>(Click to expand)</b>Tree structure of the project:</summary>

```
renderer
├── common
│   ├── custom-alert.html
│   ├── form-builder.js
│   ├── overlay.js
│   └── scanner.js
├── features
│   ├── 1_1_import_agent
│   │   ├── 1_1_button_use_github.js        # JS-based button at row 1, col 1
│   │   ├── 1_2_button_add_locally.js
│   │   ├── 1_3_back                        # “Back” folder with empty index.html
│   │   │   └── index.html
│   │   ├── index.html                      # hosting landing page
│   │   └── landing.js
│   ├── 1_2_host_server
│   │   ├── 1_1_button_generate_and_run.js
│   │   ├── 1_2_NAT_setup
│   │   │   ├── 1_1_button_open_router.js
│   │   │   ├── 1_2_back
│   │   │   │   └── index.html
│   │   │   ├── index.html
│   │   │   └── landing.js
│   │   ├── 1_3_back
│   │   │   └── index.html
│   │   ├── index.html
│   │   ├── landing.js
│   │   └── setup.js
│   ├── 1_3_newsfeed
│   │   ├── 1_1_back
│   │   │   └── index.html
│   │   ├── index.html
│   │   └── landing.js
│   ├── 2_1_build_agent
│   │   ├── 1_1_button_generate.js
│   │   ├── 1_2_button_recombine.js
│   │   ├── 1_3_button_optimize.js
│   │   ├── 1_4_back
│   │   │   └── index.html
│   │   ├── index.html
│   │   ├── landing.js
│   │   └── list_agents.js
│   ├── 2_2_management
│   │   ├── 1_1_back
│   │   │   └── index.html
│   │   ├── index.html
│   │   └── landing.js
│   ├── 2_3_settings
│   │   ├── 1_1_button_reset_app.js
│   │   ├── 1_2_back
│   │   │   └── index.html
│   │   ├── index.html
│   │   └── landing.js
│   ├── 3_1_launch_agent
│   │   ├── 1_1_button_launch.js
│   │   ├── 1_2_back
│   │   │   └── index.html
│   │   ├── index.html
│   │   ├── landing.js
│   │   └── list_agents.js
│   ├── 3_2_performance
│   │   ├── 1_1_back
│   │   │   └── index.html
│   │   ├── index.html
│   │   └── landing.js
│   └── 3_3_quit                            # quit button
│       └── index.html
├── landing
│   ├── landing.html
│   └── landing.js
├── login
│   ├── 1_1_button_login.js
│   ├── index.html
│   ├── landing.js
│   └── login.html
└── style.css
main.js
package.json
```

</details>

## How It Works

1. **Folder → Button**  
   Any **directory** named  
   ```
   n_m_<feature-name>/
   ```  
   under `renderer/features/` produces a grid button at **row n**, **column m**, labeled `<feature-name>`.  
   Clicking it loads `n_m_<feature-name>/index.html`.

2. **JS File → Button**  
   Any **file** named  
   ```
   n_m_button_<action>.js
   ```  
   in a feature folder produces a button at **row n**, **column m**, labeled `<action>`.  
   Clicking it `require()`s and runs that script.

3. **Back Button**  
   To get a **Back** button, create a folder  
   ```
   n_m_back/
   ```  
   with an **empty** `index.html` inside. Clicking it returns to the main landing page.  
   The `1_3_template_button` folder shows this pattern in action.


## Contributing

### Add a Top-Level Feature

1. Create `renderer/features/n_m_<feature-name>/`  
2. Add an `index.html` (and `landing.js` if needed).  
3. Restart the app so that you can see your new button appear at (n,m).

### Add a JS-Triggered Button

1. Place `n_m_button_<action>.js` in any feature folder.  
2. On launch, a button labeled `<action>` appears at (n,m) and executes your code.


## Styling & Assets

- Shared styles in `renderer/style.css`  
- Assets (logo, demo.gif) in `assets/`  
- White + light-gray palette, soft shadows, and Inter or system-sans fonts  


## Notes

- Frontend only; no backend or database.  
- Navigation entirely via static HTML, JS, and Electron.  
- Designed to mock up UX before wiring in real logic.  


## Contact

Questions or suggestions? [Open an issue](https://github.com/Summoner-Network/summoner-desktop/issues) or ping the team on [Discord](https://discord.gg/9HMeXnMycE) or [Reddit](https://www.reddit.com/r/SummonerOfficial/).