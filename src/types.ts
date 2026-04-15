export interface ContainerItem {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  ports: string;
}

export interface ImageItem {
  id: string;
  repoTags: string[];
  size: number;
  created: number;
}
