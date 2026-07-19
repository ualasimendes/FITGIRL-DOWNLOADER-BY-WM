export interface RepackGame {
  id: string;
  title: string;
  url: string;
  date: string;
  coverImage: string;
  specSummary: Record<string, string>;
}

export interface ExtractedLink {
  href: string;
  text: string;
  hoster: string;
  section: string;
}

export interface RepackDetails {
  title: string;
  url: string;
  coverImage: string;
  specs: Record<string, string>;
  links: ExtractedLink[];
}

export interface QueueItem {
  id: string;
  repackTitle: string;
  linkText: string;
  url: string;
  hoster: string;
  status: "waiting" | "processing" | "completed" | "paused" | "failed";
  progress: number;
  speed: string; // e.g., "4.5 MB/s"
  eta: string; // e.g., "12s"
  size: string; // simulated size like "4.2 GB"
  createdAt: string;
}

export interface HistoryItem {
  id: string;
  queryOrUrl: string;
  type: "search" | "url" | "html";
  timestamp: string;
  resultsCount: number;
}

export interface FavoriteItem {
  id: string;
  title: string;
  url: string;
  coverImage: string;
  addedAt: string;
}

export interface AppSettings {
  simultaneousDownloads: number;
  speedLimit: "unlimited" | "10" | "5" | "1" | string; // in MB/s
  autoStartQueue: boolean;
  notifyOnComplete: boolean;
  defaultCategory: "all" | "direct" | "torrent";
  downloadDirectory?: string;
}

export interface LibraryGame {
  id: string;
  title: string;
  coverImage: string;
  installPath: string;
  status: "not_installed" | "installing" | "ready" | "playing";
  progress?: number; // installation / validation progress %
  playTime?: number; // total simulated play time in minutes
  lastPlayed?: string; // last played timestamp string
  exePath?: string; // custom executable path relative to installPath
  launchArguments?: string; // custom configurations or flags like -windowed
  sizeOnDisk?: string; // space occupied
  developer?: string; // e.g. "FromSoftware"
  rating?: number; // out of 10
}

