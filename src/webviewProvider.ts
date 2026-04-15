import * as vscode from 'vscode';
import { DockerService } from './dockerService';
import { ContainerItem, ImageItem } from './types';

const AUTO_REFRESH_INTERVAL = 5000;

export class DockerWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'dockerManagement.panel';
  private _view?: vscode.WebviewView;
  private _refreshTimer?: ReturnType<typeof setInterval>;
  private _outputChannel: vscode.OutputChannel;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly dockerService: DockerService
  ) {
    this._outputChannel = vscode.window.createOutputChannel('Docker Logs');
  }

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
    };

    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'toggle': {
          try {
            if (message.running) {
              await this.dockerService.stopContainer(message.id);
            } else {
              await this.dockerService.startContainer(message.id);
            }
          } catch (err: any) {
            vscode.window.showErrorMessage(err.message);
          }
          await this.refresh();
          break;
        }
        case 'refresh': {
          await this.refresh();
          break;
        }
        case 'logs': {
          try {
            const logs = await this.dockerService.getContainerLogs(message.id);
            this._outputChannel.clear();
            this._outputChannel.appendLine(`--- Logs: ${message.name} ---`);
            this._outputChannel.append(logs);
            this._outputChannel.show(true);
          } catch (err: any) {
            vscode.window.showErrorMessage(`Failed to get logs: ${err.message}`);
          }
          break;
        }
        case 'removeContainer': {
          const answer = await vscode.window.showWarningMessage(
            `Remove container "${message.name}"?`, { modal: true }, 'Remove'
          );
          if (answer === 'Remove') {
            try {
              await this.dockerService.removeContainer(message.id);
            } catch (err: any) {
              vscode.window.showErrorMessage(err.message);
            }
            await this.refresh();
          }
          break;
        }
        case 'removeImage': {
          const answer = await vscode.window.showWarningMessage(
            `Remove image "${message.name}"?`, { modal: true }, 'Remove'
          );
          if (answer === 'Remove') {
            try {
              await this.dockerService.removeImage(message.id);
            } catch (err: any) {
              vscode.window.showErrorMessage(err.message);
            }
            await this.refresh();
          }
          break;
        }
      }
    });

    // Start auto-refresh when visible, stop when hidden
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        this.startAutoRefresh();
        this.refresh();
      } else {
        this.stopAutoRefresh();
      }
    });

    webviewView.onDidDispose(() => {
      this.stopAutoRefresh();
    });

    // Set HTML immediately so VS Code clears the loading bar
    webviewView.webview.html = this.getLoadingHtml();
    this.refresh();
    this.startAutoRefresh();
  }

  private getLoadingHtml(): string {
    return /*html*/ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-disabledForeground);
      background: var(--vscode-sideBar-background);
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      font-size: 12px;
    }
  </style>
</head>
<body>Loading containers...</body>
</html>`;
  }

  private startAutoRefresh() {
    this.stopAutoRefresh();
    this._refreshTimer = setInterval(() => this.refresh(), AUTO_REFRESH_INTERVAL);
  }

  private stopAutoRefresh() {
    if (this._refreshTimer) {
      clearInterval(this._refreshTimer);
      this._refreshTimer = undefined;
    }
  }

  async refresh() {
    if (!this._view) return;

    let containers: ContainerItem[] = [];
    let images: ImageItem[] = [];
    let error = '';

    try {
      containers = await this.dockerService.getContainers();
      images = await this.dockerService.getImages();
    } catch (err: any) {
      error = err.message;
    }

    this._view.webview.html = this.getHtml(containers, images, error);
  }

  private getHtml(containers: ContainerItem[], images: ImageItem[], error: string): string {
    return /*html*/ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background);
      padding: 0 8px 16px;
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 0 8px;
      position: sticky;
      top: 0;
      background: var(--vscode-sideBar-background);
      z-index: 10;
    }

    .header h2 {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--vscode-sideBarSectionHeader-foreground);
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 2px;
    }

    .icon-btn {
      background: none;
      border: none;
      color: var(--vscode-icon-foreground);
      cursor: pointer;
      padding: 2px 4px;
      border-radius: 4px;
      font-size: 14px;
      display: flex;
      align-items: center;
      opacity: 0.7;
    }
    .icon-btn:hover {
      background: var(--vscode-toolbar-hoverBackground);
      opacity: 1;
    }

    .error {
      background: var(--vscode-inputValidation-errorBackground, #5a1d1d);
      border: 1px solid var(--vscode-inputValidation-errorBorder, #be1100);
      border-radius: 6px;
      padding: 10px 12px;
      margin: 8px 0;
      font-size: 12px;
      line-height: 1.4;
    }

    .empty {
      text-align: center;
      padding: 20px 12px;
      color: var(--vscode-disabledForeground);
      font-size: 12px;
    }

    .card {
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-widget-border, transparent);
      border-radius: 6px;
      padding: 10px 12px;
      margin-bottom: 6px;
      transition: background 0.1s;
    }
    .card:hover {
      background: var(--vscode-list-hoverBackground);
    }
    .card:hover .card-actions {
      opacity: 1;
    }

    .card-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .card-info {
      flex: 1;
      min-width: 0;
    }

    .card-name {
      font-size: 13px;
      font-weight: 500;
      color: var(--vscode-foreground);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .card-meta {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      margin-top: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .card-actions {
      display: flex;
      align-items: center;
      gap: 2px;
      opacity: 0;
      transition: opacity 0.15s;
    }

    .action-btn {
      background: none;
      border: none;
      color: var(--vscode-descriptionForeground);
      cursor: pointer;
      padding: 3px 5px;
      border-radius: 4px;
      font-size: 12px;
      display: flex;
      align-items: center;
    }
    .action-btn:hover {
      background: var(--vscode-toolbar-hoverBackground);
      color: var(--vscode-foreground);
    }
    .action-btn.danger:hover {
      color: #f85149;
    }

    .status-dot {
      display: inline-block;
      width: 7px;
      height: 7px;
      border-radius: 50%;
      margin-right: 5px;
      vertical-align: middle;
      position: relative;
      top: -0.5px;
    }
    .status-dot.running {
      background: #3fb950;
      box-shadow: 0 0 6px rgba(63, 185, 80, 0.4);
    }
    .status-dot.stopped {
      background: #6e7681;
    }

    /* Toggle Switch */
    .toggle {
      position: relative;
      width: 36px;
      height: 20px;
      flex-shrink: 0;
    }
    .toggle input {
      opacity: 0;
      width: 0;
      height: 0;
    }
    .toggle-slider {
      position: absolute;
      cursor: pointer;
      inset: 0;
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border, #444);
      border-radius: 20px;
      transition: all 0.2s ease;
    }
    .toggle-slider:before {
      content: "";
      position: absolute;
      height: 14px;
      width: 14px;
      left: 2px;
      bottom: 2px;
      background: var(--vscode-descriptionForeground);
      border-radius: 50%;
      transition: all 0.2s ease;
    }
    .toggle input:checked + .toggle-slider {
      background: #2ea04370;
      border-color: #3fb950;
    }
    .toggle input:checked + .toggle-slider:before {
      transform: translateX(16px);
      background: #3fb950;
    }
    .toggle input:disabled + .toggle-slider {
      opacity: 0.5;
      cursor: wait;
    }

    /* Image cards */
    .image-card {
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-widget-border, transparent);
      border-radius: 6px;
      padding: 8px 12px;
      margin-bottom: 4px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .image-card:hover {
      background: var(--vscode-list-hoverBackground);
    }
    .image-card:hover .card-actions {
      opacity: 1;
    }
    .image-info {
      flex: 1;
      min-width: 0;
    }
    .image-name {
      font-size: 12px;
      font-weight: 500;
      color: var(--vscode-foreground);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .image-meta {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      margin-top: 1px;
    }

    .section-divider {
      height: 1px;
      background: var(--vscode-widget-border, var(--vscode-sideBarSectionHeader-border, #333));
      margin: 4px 0;
    }

    .auto-refresh-indicator {
      font-size: 10px;
      color: var(--vscode-disabledForeground);
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .pulse {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: #3fb950;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 0.3; }
      50% { opacity: 1; }
    }
  </style>
</head>
<body>

  ${error ? `<div class="error">${escapeHtml(error)}</div>` : ''}

  <div class="header">
    <h2>Containers</h2>
    <div class="header-actions">
      <span class="auto-refresh-indicator" title="Auto-refreshing every 5s"><span class="pulse"></span></span>
      <button class="icon-btn" onclick="refresh()" title="Refresh now">&#x21bb;</button>
    </div>
  </div>

  ${containers.length === 0 && !error
    ? '<div class="empty">No containers found</div>'
    : containers.map((c) => {
        const isRunning = c.state === 'running';
        const friendlyName = this.friendlyName(c.name);
        const escapedName = escapeHtml(friendlyName).replace(/'/g, "\\'");
        return /*html*/ `
          <div class="card">
            <div class="card-top">
              <div class="card-info">
                <div class="card-name">
                  <span class="status-dot ${isRunning ? 'running' : 'stopped'}"></span>
                  ${escapeHtml(friendlyName)}
                </div>
                <div class="card-meta">${escapeHtml(c.image)} &middot; ${escapeHtml(c.status)}${c.ports ? ` &middot; ${escapeHtml(c.ports)}` : ''}</div>
              </div>
              <div class="card-actions">
                <button class="action-btn" onclick="viewLogs('${c.id}', '${escapedName}')" title="View Logs">&#x1f4cb;</button>
                <button class="action-btn danger" onclick="removeContainer('${c.id}', '${escapedName}')" title="Remove">&#x2715;</button>
              </div>
              <label class="toggle" title="${isRunning ? 'Stop' : 'Start'} container">
                <input type="checkbox" ${isRunning ? 'checked' : ''}
                  onchange="toggle('${c.id}', ${isRunning})">
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>`;
      }).join('')
  }

  <div class="section-divider"></div>

  <div class="header">
    <h2>Images</h2>
  </div>

  ${images.length === 0 && !error
    ? '<div class="empty">No images found</div>'
    : images.map((img) => {
        const tag = img.repoTags[0] ?? '<none>';
        const friendlyTag = this.friendlyImageName(tag);
        const escapedTag = escapeHtml(tag).replace(/'/g, "\\'");
        return /*html*/ `
          <div class="image-card">
            <div class="image-info">
              <div class="image-name">${escapeHtml(friendlyTag.name)}</div>
              <div class="image-meta">${escapeHtml(friendlyTag.tag)} &middot; ${formatSize(img.size)}</div>
            </div>
            <div class="card-actions">
              <button class="action-btn danger" onclick="removeImage('${img.id}', '${escapedTag}')" title="Remove image">&#x2715;</button>
            </div>
          </div>`;
      }).join('')
  }

  <script>
    const vscode = acquireVsCodeApi();

    function toggle(id, running) {
      document.querySelectorAll('.toggle input').forEach(el => el.disabled = true);
      vscode.postMessage({ command: 'toggle', id, running });
    }

    function refresh() {
      vscode.postMessage({ command: 'refresh' });
    }

    function viewLogs(id, name) {
      vscode.postMessage({ command: 'logs', id, name });
    }

    function removeContainer(id, name) {
      vscode.postMessage({ command: 'removeContainer', id, name });
    }

    function removeImage(id, name) {
      vscode.postMessage({ command: 'removeImage', id, name });
    }
  </script>
</body>
</html>`;
  }

  private friendlyName(name: string): string {
    return name
      .replace(/^\//, '')
      .replace(/_/g, ' ')
      .replace(/-(\d+)$/, ' ($1)')
      .replace(/-/g, ' ')
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  private friendlyImageName(tag: string): { name: string; tag: string } {
    if (tag === '<none>:<none>' || tag === '<none>') {
      return { name: 'Untagged Image', tag: '' };
    }
    const [repo, version] = tag.split(':');
    const parts = repo.split('/');
    const shortName = parts[parts.length - 1]
      .replace(/_/g, ' ')
      .replace(/-/g, ' ')
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

    const prefix = parts.length > 1 ? parts.slice(0, -1).join('/') + '/' : '';
    return {
      name: shortName,
      tag: `${prefix}${parts[parts.length - 1]}:${version ?? 'latest'}`,
    };
  }

  dispose() {
    this.stopAutoRefresh();
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
