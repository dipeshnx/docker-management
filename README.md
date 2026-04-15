# Docker Management — VS Code Extension

A lightweight VS Code extension to manage Docker containers and images from the sidebar.

## Features

- **Container list** with friendly names and status indicators
- **Toggle switches** to start/stop containers
- **View logs** in VS Code's Output panel
- **Remove containers and images** with confirmation dialogs
- **Auto-refresh** every 5 seconds (pauses when panel is hidden)
- **Custom Activity Bar icon** for quick access

## Requirements

- Docker Desktop or Docker Engine running
- VS Code 1.85.0+

## Install

### From Source

```bash
git clone git@github.com:dipeshnx/docker-management.git
cd docker-management
npm install
npm run build
```

Then press `F5` in VS Code to launch the Extension Development Host.

## Usage

1. Click the container icon in the **Activity Bar** (left sidebar)
2. **Containers** — each card shows name, image, status, and ports
   - Flip the **toggle switch** to start or stop
   - Hover to reveal **View Logs** and **Remove** buttons
3. **Images** — each card shows name, tag, and size
   - Hover to reveal the **Remove** button
4. The panel **auto-refreshes** every 5 seconds (green pulsing dot)
5. Click **↻** to refresh manually
