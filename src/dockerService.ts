import Docker from 'dockerode';
import { ContainerItem, ImageItem } from './types';

export class DockerService {
  private docker: Docker;

  constructor() {
    this.docker = new Docker({ socketPath: '/var/run/docker.sock' });
  }

  async getContainers(): Promise<ContainerItem[]> {
    try {
      const containers = await this.docker.listContainers({ all: true });
      return containers.map((c) => ({
        id: c.Id,
        name: c.Names[0]?.replace(/^\//, '') ?? c.Id.substring(0, 12),
        image: c.Image,
        state: c.State,
        status: c.Status,
        ports: this.formatPorts(c.Ports),
      }));
    } catch (err: any) {
      throw new Error(this.friendlyError(err));
    }
  }

  async getImages(): Promise<ImageItem[]> {
    try {
      const images = await this.docker.listImages();
      return images.map((img) => ({
        id: img.Id.replace('sha256:', '').substring(0, 12),
        repoTags: img.RepoTags ?? ['<none>:<none>'],
        size: img.Size,
        created: img.Created,
      }));
    } catch (err: any) {
      throw new Error(this.friendlyError(err));
    }
  }

  async startContainer(id: string): Promise<void> {
    try {
      const container = this.docker.getContainer(id);
      await container.start();
    } catch (err: any) {
      if (err.statusCode === 304) return; // already started
      throw new Error(this.friendlyError(err));
    }
  }

  async stopContainer(id: string): Promise<void> {
    try {
      const container = this.docker.getContainer(id);
      await container.stop();
    } catch (err: any) {
      if (err.statusCode === 304) return; // already stopped
      throw new Error(this.friendlyError(err));
    }
  }

  private formatPorts(ports: Docker.Port[]): string {
    if (!ports || ports.length === 0) return '';
    return ports
      .map((p) => {
        if (p.PublicPort) {
          return `${p.IP ?? '0.0.0.0'}:${p.PublicPort}->${p.PrivatePort}/${p.Type}`;
        }
        return `${p.PrivatePort}/${p.Type}`;
      })
      .join(', ');
  }

  private friendlyError(err: any): string {
    const msg = err.message ?? String(err);
    if (msg.includes('ENOENT') || msg.includes('ECONNREFUSED')) {
      return 'Docker daemon is not running. Please start Docker Desktop.';
    }
    if (msg.includes('EACCES') || msg.includes('permission denied')) {
      return 'Permission denied. Make sure your user has access to the Docker socket.';
    }
    return msg;
  }
}
