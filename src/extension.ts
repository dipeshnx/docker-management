import * as vscode from 'vscode';
import { DockerService } from './dockerService';
import { DockerWebviewProvider } from './webviewProvider';

export function activate(context: vscode.ExtensionContext) {
  try {
    const dockerService = new DockerService();
    const provider = new DockerWebviewProvider(context.extensionUri, dockerService);

    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(DockerWebviewProvider.viewType, provider),
      vscode.commands.registerCommand('dockerManagement.refresh', () => {
        provider.refresh();
      })
    );
  } catch (err: any) {
    vscode.window.showErrorMessage(`Docker Management failed to activate: ${err.message}`);
  }
}

export function deactivate() {}
