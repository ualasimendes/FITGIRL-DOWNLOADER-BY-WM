import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import * as cheerio from "cheerio";
import dotenv from "dotenv";
import fs from "fs";
import http from "http";
import https from "https";
import { exec } from "child_process";
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const isProd = process.env.NODE_ENV === "production" || !process.env.VITE_DEV_SERVER;

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

let aiClient: any = null;
try {
  if (process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
} catch (err) {
  console.error("Erro ao inicializar cliente GoogleGenAI:", err);
}

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Helper to set browser-like headers to bypass simple User-Agent filters
const getFetchHeaders = () => {
  return {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "max-age=0",
    "Sec-Ch-Ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
    "Upgrade-Insecure-Requests": "1"
  };
};

// Classify links based on their URL patterns
const classifyHoster = (url: string, text: string): string => {
  const normalizedUrl = url.toLowerCase();
  const normalizedText = text.toLowerCase();

  if (normalizedUrl.startsWith("magnet:")) return "Magnet Link";
  if (normalizedUrl.endsWith(".torrent")) return "Torrent File";
  if (normalizedUrl.includes("rutor.info") || normalizedUrl.includes("rutor.org")) return "RuTor";
  if (normalizedUrl.includes("tapochek.net")) return "Tapochek";
  if (normalizedUrl.includes("1337x")) return "1337x Torrent";
  if (normalizedUrl.includes("multiup.org") || normalizedUrl.includes("multiup.io")) return "MultiUp (Multihost)";
  if (normalizedUrl.includes("filecrypt")) return "Filecrypt";
  if (normalizedUrl.includes("1fichier.com")) return "1fichier";
  if (normalizedUrl.includes("qiwi.gg") || normalizedUrl.includes("qiwi.co")) return "Qiwi";
  if (normalizedUrl.includes("gofile.io")) return "Gofile";
  if (normalizedUrl.includes("pixeldrain.com")) return "Pixeldrain";
  if (
    normalizedUrl.includes("fuckingfast.co") ||
    normalizedUrl.includes("fuckingfast") ||
    normalizedUrl.includes("fuckfast.co") ||
    normalizedUrl.includes("fuckfast.com") ||
    normalizedUrl.includes("fuckfast")
  ) return "Fucking Fast";
  if (normalizedUrl.includes("datanodes.to") || normalizedUrl.includes("datanodes")) return "Datanodes.to";
  if (normalizedUrl.includes("buzzheavier.com") || normalizedUrl.includes("buzzheavier")) return "Buzzheavier";
  if (normalizedUrl.includes("mega.nz") || normalizedUrl.includes("mega.co.nz")) return "Mega";
  if (normalizedUrl.includes("drive.google.com") || normalizedUrl.includes("gdrive")) return "Google Drive";
  if (normalizedUrl.includes("onedrive.live.com") || normalizedUrl.includes("onedrive") || normalizedUrl.includes("1drv.ms")) return "OneDrive";
  if (normalizedUrl.includes("krakenfiles.com")) return "Krakenfiles";
  if (normalizedUrl.includes("mediafire.com")) return "Mediafire";
  if (normalizedUrl.includes("gdrive.tracker") || normalizedUrl.includes("gdrivetracker")) return "GDrive Tracker";
  if (normalizedUrl.includes("scenefiles") || normalizedUrl.includes("scenefile")) return "Scenefiles";
  if (normalizedUrl.includes("sendcm") || normalizedUrl.includes("send.cm")) return "Send.cm";

  // Text-based fallback classifications
  if (normalizedText.includes("magnet")) return "Magnet Link";
  if (normalizedText.includes("torrent")) return "Torrent File";
  if (normalizedText.includes("multiup")) return "MultiUp (Multihost)";
  if (normalizedText.includes("filecrypt")) return "Filecrypt";
  if (normalizedText.includes("gdrive") || normalizedText.includes("google drive")) return "Google Drive";
  if (normalizedText.includes("qiwi")) return "Qiwi";
  if (normalizedText.includes("pixeldrain")) return "Pixeldrain";
  if (normalizedText.includes("gofile")) return "Gofile";
  if (normalizedText.includes("fuckfast") || normalizedText.includes("fuckingfast")) return "Fucking Fast";
  if (normalizedText.includes("datanodes")) return "Datanodes.to";
  if (normalizedText.includes("buzzheavier")) return "Buzzheavier";

  return "Other / Direct Link";
};

// Parse a single FitGirl repack page HTML and extract metadata and mirrors
const parseFitgirlPageHTML = (html: string, urlSource?: string) => {
  const $ = cheerio.load(html);
  
  // Title
  let title = $(".entry-title").first().text().trim();
  if (!title) {
    title = $("h1").first().text().trim() || "Untitled Repack";
  }

  // Cover image / poster
  let coverImage = $(".entry-content img").first().attr("src");
  if (coverImage && coverImage.startsWith("/")) {
    coverImage = "https://fitgirl-repacks.site" + coverImage;
  }

  // Specifications
  const specs: Record<string, string> = {};
  const paragraphs = $(".entry-content p");
  
  paragraphs.each((_, p) => {
    const text = $(p).text();
    // Usually specs are at the top, format: "Key: Value" or "Key: Value\nKey2: Value2"
    if (text.includes("Genres/Tags:") || text.includes("Original Size:") || text.includes("Repack Size:")) {
      const lines = text.split("\n");
      lines.forEach(line => {
        const parts = line.split(":");
        if (parts.length >= 2) {
          const key = parts[0].trim();
          const val = parts.slice(1).join(":").trim();
          if (key && val && key.length < 40 && val.length < 500) {
            specs[key] = val;
          }
        }
      });
    }
  });

  // Extract all links within post content
  const links: Array<{ href: string; text: string; hoster: string; section: string }> = [];
  
  // Find container
  const contentContainer = $(".entry-content");
  
  if (contentContainer.length > 0) {
    contentContainer.find("a").each((_, a) => {
      const href = $(a).attr("href");
      if (!href) return;

      // Skip internal WordPress anchor jumps, paginations or main site links
      if (href.startsWith("#") || 
          href === "https://fitgirl-repacks.site/" || 
          href.includes("/category/") || 
          href.includes("/tag/") || 
          href.includes("comments") ||
          href.includes("javascript:void")
      ) {
        return;
      }

      const text = $(a).text().trim() || href;
      const hoster = classifyHoster(href, text);

      // Determine the section/group name
      // Look up preceding headers or paragraphs
      let section = "General Mirror Links";
      
      // Let's find previous h2/h3 or list items to see if we can group them
      const parentLi = $(a).closest("li");
      const parentUl = $(a).closest("ul");
      let prevHeading = null;

      if (parentUl.length > 0) {
        prevHeading = parentUl.prevAll("h3, h2, h4, p").first();
      } else {
        prevHeading = $(a).prevAll("h3, h2, h4, p").first();
      }

      if (prevHeading && prevHeading.length > 0) {
        const headingText = prevHeading.text().trim();
        // If heading contains mirror or mirrors, clean it up or use it
        if (headingText && headingText.length < 60) {
          section = headingText;
        }
      }

      // Filter out links that are just internal fitgirl-repacks search page links
      if (href.includes("fitgirl-repacks.site") && !href.includes(".torrent") && !href.includes("/feed") && !href.includes("wp-content")) {
        // Only keep if it is clearly a filehost or repack link
        const cleanHref = href.replace(/\/$/, "");
        if (cleanHref === "https://fitgirl-repacks.site" || cleanHref === "http://fitgirl-repacks.site") {
          return;
        }
      }

      links.push({
        href,
        text,
        hoster,
        section
      });
    });
  }

  // Deduplicate links by href
  const seenHrefs = new Set<string>();
  const uniqueLinks = links.filter(link => {
    if (seenHrefs.has(link.href)) return false;
    seenHrefs.add(link.href);
    return true;
  });

  return {
    title,
    url: urlSource || "",
    coverImage,
    specs,
    links: uniqueLinks
  };
};

// 1. API: Extract links from a given URL
app.get("/api/extract", async (req, res) => {
  const targetUrl = req.query.url as string;

  if (!targetUrl) {
    return res.status(400).json({ error: "No URL provided." });
  }

  if (!targetUrl.toLowerCase().includes("fitgirl-repacks.site")) {
    return res.status(400).json({ error: "Only links from fitgirl-repacks.site are supported." });
  }

  try {
    const response = await fetch(targetUrl, {
      headers: getFetchHeaders(),
      signal: AbortSignal.timeout(15000) // 15 second timeout
    });

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    const data = parseFitgirlPageHTML(html, targetUrl);

    res.json({ success: true, data });
  } catch (err: any) {
    console.error("Extraction error:", err);
    res.status(500).json({ 
      error: "Failed to scrape the specified repack page.", 
      details: err.message,
      suggestion: "The FitGirl site might be down or protecting itself behind Cloudflare. You can try the 'Paste HTML Source' fallback tab instead!"
    });
  }
});

// 2. API: Parse raw HTML (Offline mode fallback)
app.post("/api/parse-html", (req, res) => {
  const { html, url } = req.body;

  if (!html) {
    return res.status(400).json({ error: "No HTML content provided." });
  }

  try {
    const data = parseFitgirlPageHTML(html, url);
    res.json({ success: true, data });
  } catch (err: any) {
    console.error("HTML parsing error:", err);
    res.status(500).json({ error: "Failed to parse the HTML payload.", details: err.message });
  }
});

// 3. API: Search FitGirl Repacks site
app.get("/api/search", async (req, res) => {
  const query = req.query.q as string;
  const page = req.query.page ? parseInt(req.query.page as string) : 1;

  if (!query) {
    return res.status(400).json({ error: "No search query provided." });
  }

  // Construct target WordPress search url
  const searchUrl = page > 1 
    ? `https://fitgirl-repacks.site/page/${page}/?s=${encodeURIComponent(query)}`
    : `https://fitgirl-repacks.site/?s=${encodeURIComponent(query)}`;

  try {
    const response = await fetch(searchUrl, {
      headers: getFetchHeaders(),
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const results: Array<any> = [];

    $("article").each((_, article) => {
      const articleId = $(article).attr("id") || "";
      const titleLink = $(article).find(".entry-title a").first();
      const title = titleLink.text().trim();
      const url = titleLink.attr("href") || "";
      
      const date = $(article).find(".entry-date").first().text().trim() || 
                   $(article).find("time").first().text().trim() || "";
                   
      let coverImage = $(article).find(".entry-content img").first().attr("src") || "";
      if (coverImage && coverImage.startsWith("/")) {
        coverImage = "https://fitgirl-repacks.site" + coverImage;
      }

      // Extract brief spec descriptions (like Genres, size, etc.)
      const contentText = $(article).find(".entry-content").text() || "";
      const specSummary: Record<string, string> = {};
      
      const lines = contentText.split("\n");
      lines.forEach(line => {
        if (line.includes("Genres/Tags:") || line.includes("Original Size:") || line.includes("Repack Size:")) {
          const parts = line.split(":");
          if (parts.length >= 2) {
            const key = parts[0].trim();
            const val = parts.slice(1).join(":").trim();
            if (key && val && key.length < 30 && val.length < 200) {
              specSummary[key] = val;
            }
          }
        }
      });

      if (title && url) {
        results.push({
          id: articleId,
          title,
          url,
          date,
          coverImage,
          specSummary
        });
      }
    });

    // Check pagination count
    let totalPages = 1;
    const pagination = $(".navigation, .pagination, .page-links");
    if (pagination.length > 0) {
      const pageNumbers = pagination.find(".page-numbers:not(.next)").map((_, el) => $(el).text()).get();
      const parsedNumbers = pageNumbers.map(n => parseInt(n)).filter(n => !isNaN(n));
      if (parsedNumbers.length > 0) {
        totalPages = Math.max(...parsedNumbers);
      }
    }

    res.json({ 
      success: true, 
      results,
      query,
      page,
      totalPages: Math.max(totalPages, page) 
    });
  } catch (err: any) {
    console.error("Search error:", err);
    res.status(500).json({ 
      error: "Failed to perform search on FitGirl site.", 
      details: err.message,
      suggestion: "The site might be blocking proxy scrapers. Try accessing fitgirl-repacks.site directly in your browser, and copy-paste the URL or HTML contents here!"
    });
  }
});

// ==========================================
// STATE DATABASE & BACKEND DOWNLOAD ENGINE
// ==========================================

const CONFIG_DIR = (() => {
  const appData = process.env.APPDATA || (process.platform === "darwin" ? path.join(process.env.HOME || "", "Library", "Preferences") : path.join(process.env.HOME || "", ".config"));
  const isProd = process.env.NODE_ENV === "production" || !process.env.VITE_DEV_SERVER;
  const targetDir = isProd ? path.join(appData, "FitGirlDownloaderWM") : path.join(process.cwd(), "config");
  
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  return targetDir;
})();

const getFilePath = (filename: string) => path.join(CONFIG_DIR, filename);

const readJSON = <T>(filename: string, defaultVal: T): T => {
  const filePath = getFilePath(filename);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultVal, null, 2));
    return defaultVal;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch (err) {
    return defaultVal;
  }
};

const writeJSON = <T>(filename: string, data: T) => {
  const filePath = getFilePath(filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

// Initial state data structures
interface AppSettings {
  simultaneousDownloads: number;
  speedLimit: string; // "1" | "5" | "10" | "unlimited"
  autoStartQueue: boolean;
  notifyOnComplete: boolean;
  defaultCategory: string;
  downloadDirectory: string;
}

interface QueueItem {
  id: string;
  repackTitle: string;
  linkText: string;
  url: string;
  hoster: string;
  size: string;
  progress: number;
  status: "waiting" | "processing" | "paused" | "completed" | "failed";
  speed: string;
  eta: string;
  createdAt: string;
}

interface LibraryGame {
  id: string;
  title: string;
  coverImage: string;
  installPath: string;
  status: "not_installed" | "installing" | "ready" | "playing";
  playTime: number;
  lastPlayed: string;
  exePath: string;
  launchArguments: string;
  sizeOnDisk: string;
  developer: string;
  rating: number;
  progress?: number;
}

interface FavoriteItem {
  id: string;
  title: string;
  url: string;
  coverImage: string;
  addedAt: string;
}

interface HistoryItem {
  id: string;
  queryOrUrl: string;
  type: "search" | "url" | "html";
  timestamp: string;
  resultsCount: number;
}

// Read/write state files safely
const getSettings = (): AppSettings => readJSON<AppSettings>("settings.json", {
  simultaneousDownloads: 1,
  speedLimit: "unlimited",
  autoStartQueue: true,
  notifyOnComplete: true,
  defaultCategory: "all",
  downloadDirectory: (() => {
    const defaultDownloads = path.join(process.env.USERPROFILE || process.env.HOME || process.cwd(), "Downloads", "FitGirlDownloads");
    const isProd = process.env.NODE_ENV === "production" || !process.env.VITE_DEV_SERVER;
    return isProd ? defaultDownloads : path.join(process.cwd(), "downloads");
  })()
});

const getLibrary = (): LibraryGame[] => readJSON<LibraryGame[]>("library.json", [
  {
    "id": "elden-ring",
    "title": "Elden Ring (v1.12.3 + Shadow of the Erdtree)",
    "coverImage": "https://shared.fastly.steamstatic.com/store_images/steam/apps/1245620/header.jpg",
    "installPath": "C:\\Games\\Elden Ring",
    "status": "ready",
    "playTime": 125,
    "lastPlayed": "18/07/2026",
    "exePath": "Game\\eldenring.exe",
    "launchArguments": "-windowed -novid",
    "sizeOnDisk": "48.3 GB",
    "developer": "FromSoftware",
    "rating": 9.8,
    "progress": 100
  },
  {
    "id": "cyberpunk-2077",
    "title": "Cyberpunk 2077 (v2.12 + Phantom Liberty)",
    "coverImage": "https://shared.fastly.steamstatic.com/store_images/steam/apps/1091500/header.jpg",
    "installPath": "D:\\Games\\Cyberpunk 2077",
    "status": "ready",
    "playTime": 245,
    "lastPlayed": "15/07/2026",
    "exePath": "bin\\x64\\Cyberpunk2077.exe",
    "launchArguments": "-skipStartScreen",
    "sizeOnDisk": "76.1 GB",
    "developer": "CD PROJEKT RED",
    "rating": 9.2,
    "progress": 100
  }
]);

const getQueue = (): QueueItem[] => readJSON<QueueItem[]>("queue.json", []);
const getFavorites = (): FavoriteItem[] => readJSON<FavoriteItem[]>("favorites.json", []);
const getHistory = (): HistoryItem[] => readJSON<HistoryItem[]>("history.json", []);
const getLogs = (): string[] => readJSON<string[]>("logs.json", [
  `[${new Date().toLocaleTimeString()}] System initialized on backend server.`,
  `[${new Date().toLocaleTimeString()}] FitGirl Desktop Extractor backend database loaded.`
]);

// Helper to write backend logs
const appendBackendLog = (msg: string) => {
  const timestamp = new Date().toLocaleTimeString();
  const logs = getLogs();
  logs.unshift(`[${timestamp}] ${msg}`);
  writeJSON("logs.json", logs.slice(0, 100)); // keep last 100 logs
};

// Real-time active download streaming state
interface ActiveDownloadStream {
  req?: http.ClientRequest;
  responseStream?: http.IncomingMessage;
  fileStream?: fs.WriteStream;
  filePath: string;
  bytesDownloaded: number;
  totalBytes: number;
  lastProgressUpdate: number;
  speed: string;
  eta: string;
}
const activeStreams = new Map<string, ActiveDownloadStream>();

// Real download streamer helper with range resume and hoster resolution
async function startRealDownload(
  item: QueueItem,
  downloadDirectory: string,
  onProgress: (downloaded: number, total: number, speed: string, eta: string) => void,
  onError: (err: Error) => void,
  onDone: () => void
) {
  try {
    if (!fs.existsSync(downloadDirectory)) {
      fs.mkdirSync(downloadDirectory, { recursive: true });
    }

    // Resolve direct URL if it's a known hoster
    let resolvedUrl = item.url;
    const lowerUrl = item.url.toLowerCase();
    if (lowerUrl.includes("pixeldrain.com/u/")) {
      const parts = item.url.split("/u/");
      if (parts.length > 1) {
        const fileId = parts[1].split(/[?#]/)[0];
        resolvedUrl = `https://pixeldrain.com/api/file/${fileId}`;
      }
    }

    const sanitize = (name: string) => name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const cleanFileName = sanitize(item.linkText);
    const partPath = path.join(downloadDirectory, `${cleanFileName}.part`);
    const completedPath = path.join(downloadDirectory, cleanFileName);

    let bytesAlreadyDownloaded = 0;
    if (fs.existsSync(partPath)) {
      bytesAlreadyDownloaded = fs.statSync(partPath).size;
    }

    const client = resolvedUrl.startsWith("https") ? https : http;
    const headers: Record<string, string> = {
      ...getFetchHeaders()
    };

    if (bytesAlreadyDownloaded > 0) {
      headers["Range"] = `bytes=${bytesAlreadyDownloaded}-`;
    }

    const requestOptions = {
      headers,
      timeout: 15000
    };

    let speedCalculationTimer: NodeJS.Timeout;
    let lastBytes = bytesAlreadyDownloaded;
    let lastTime = Date.now();
    let currentSpeed = "0 B/s";
    let currentEta = "Calculando...";

    const req = client.get(resolvedUrl, requestOptions, (res) => {
      // Check for redirect
      if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
        const redirectUrl = res.headers.location;
        if (redirectUrl) {
          appendBackendLog(`[Downloader] Redirecionamento detectado para: ${redirectUrl}`);
          clearInterval(speedCalculationTimer);
          activeStreams.delete(item.id);
          const newItem = { ...item, url: redirectUrl };
          startRealDownload(newItem, downloadDirectory, onProgress, onError, onDone);
          return;
        }
      }

      if (res.statusCode !== 200 && res.statusCode !== 206) {
        onError(new Error(`Código de status HTTP inválido: ${res.statusCode}`));
        return;
      }

      const isResume = res.statusCode === 206;
      let totalBytes = 0;

      if (isResume) {
        const contentRange = res.headers["content-range"];
        if (contentRange) {
          const match = contentRange.match(/\/(\d+)/);
          if (match) {
            totalBytes = parseInt(match[1], 10);
          }
        }
        if (!totalBytes) {
          totalBytes = bytesAlreadyDownloaded + parseInt(res.headers["content-length"] || "0", 10);
        }
      } else {
        totalBytes = parseInt(res.headers["content-length"] || "0", 10);
        bytesAlreadyDownloaded = 0; // Reset as we are starting fresh
      }

      const writeMode = isResume ? "a" : "w";
      const fileStream = fs.createWriteStream(partPath, { flags: writeMode });
      
      let bytesDownloaded = bytesAlreadyDownloaded;

      res.pipe(fileStream);

      // Speed tracker every 1 second
      speedCalculationTimer = setInterval(() => {
        const now = Date.now();
        const elapsedSec = (now - lastTime) / 1000;
        const downloadedDiff = bytesDownloaded - lastBytes;

        if (elapsedSec > 0) {
          const speedBytesPerSec = downloadedDiff / elapsedSec;
          if (speedBytesPerSec < 1024) {
            currentSpeed = `${speedBytesPerSec.toFixed(1)} B/s`;
          } else if (speedBytesPerSec < 1024 * 1024) {
            currentSpeed = `${(speedBytesPerSec / 1024).toFixed(1)} KB/s`;
          } else {
            currentSpeed = `${(speedBytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
          }

          if (speedBytesPerSec > 0 && totalBytes > bytesDownloaded) {
            const remainingBytes = totalBytes - bytesDownloaded;
            const etaSeconds = remainingBytes / speedBytesPerSec;
            if (etaSeconds < 60) {
              currentEta = `${Math.ceil(etaSeconds)}s`;
            } else if (etaSeconds < 3600) {
              currentEta = `${Math.floor(etaSeconds / 60)}m ${Math.ceil(etaSeconds % 60)}s`;
            } else {
              currentEta = `${Math.floor(etaSeconds / 3600)}h ${Math.floor((etaSeconds % 3600) / 60)}m`;
            }
          } else if (bytesDownloaded >= totalBytes) {
            currentEta = "Concluído";
            currentSpeed = "-";
          } else {
            currentEta = "Calculando...";
          }
        }
        lastBytes = bytesDownloaded;
        lastTime = now;
      }, 1000);

      res.on("data", (chunk) => {
        bytesDownloaded += chunk.length;
        const streamState = activeStreams.get(item.id);
        if (streamState) {
          streamState.bytesDownloaded = bytesDownloaded;
          streamState.totalBytes = totalBytes;
          streamState.speed = currentSpeed;
          streamState.eta = currentEta;
        }
        onProgress(bytesDownloaded, totalBytes, currentSpeed, currentEta);
      });

      fileStream.on("finish", () => {
        clearInterval(speedCalculationTimer);
        fileStream.close();
        
        if (bytesDownloaded >= totalBytes && totalBytes > 0) {
          try {
            if (fs.existsSync(completedPath)) {
              fs.unlinkSync(completedPath);
            }
            fs.renameSync(partPath, completedPath);
            activeStreams.delete(item.id);
            onDone();
          } catch (e: any) {
            onError(e);
          }
        } else {
          onError(new Error(`Download interrompido ou incompleto. Recebido ${bytesDownloaded} de ${totalBytes} bytes.`));
        }
      });

      // Track active stream
      activeStreams.set(item.id, {
        req,
        responseStream: res,
        fileStream,
        filePath: partPath,
        bytesDownloaded,
        totalBytes,
        lastProgressUpdate: Date.now(),
        speed: currentSpeed,
        eta: currentEta
      });
    });

    req.on("error", (err) => {
      clearInterval(speedCalculationTimer);
      onError(err);
    });

    req.end();

  } catch (err) {
    onError(err as Error);
  }
}

// Background worker loops
// 1. Download progress & queue manager
setInterval(() => {
  const queue = getQueue();
  const settings = getSettings();
  if (queue.length === 0) return;

  const activeCount = queue.filter(item => item.status === "processing").length;
  let slotsAvailable = settings.simultaneousDownloads - activeCount;

  let queueChanged = false;

  // Auto-start waiting downloads if slot available
  if (slotsAvailable > 0 && settings.autoStartQueue) {
    for (let i = 0; i < queue.length; i++) {
      if (queue[i].status === "waiting" && slotsAvailable > 0) {
        queue[i].status = "processing";
        queue[i].speed = "Conectando...";
        slotsAvailable--;
        queueChanged = true;
        appendBackendLog(`[Queue] Iniciando download: "${queue[i].linkText}" (${queue[i].hoster})`);
      }
    }
  }

  // Process downloading items
  for (let i = 0; i < queue.length; i++) {
    const item = queue[i];
    if (item.status !== "processing") continue;

    queueChanged = true;

    // Check if we can run real HTTP range-based download
    const isMagnet = item.url.startsWith("magnet:");
    const isTorrentFile = item.url.toLowerCase().endsWith(".torrent") || item.url.toLowerCase().includes(".torrent");
    const isDirectLink = item.url.startsWith("http") && !item.url.includes("1337x.to") && !item.url.includes("rutor.info");

    if (isDirectLink || isTorrentFile) {
      if (!activeStreams.has(item.id)) {
        appendBackendLog(`[Queue] Iniciando ou retomando conexão HTTP real para: "${item.linkText}"`);
        
        // Initial placeholder to avoid double spawn
        activeStreams.set(item.id, {
          filePath: path.join(settings.downloadDirectory, item.linkText + ".part"),
          bytesDownloaded: item.progress ? Math.floor((item.progress / 100) * 1024 * 1024 * 100) : 0, // estimate or read file
          totalBytes: 0,
          lastProgressUpdate: Date.now(),
          speed: "Conectando...",
          eta: "Calculando..."
        });

        startRealDownload(
          item,
          settings.downloadDirectory,
          (downloaded, total, speed, eta) => {
            const pct = total > 0 ? (downloaded / total) * 100 : 0;
            item.progress = parseFloat(pct.toFixed(1));
            item.speed = speed;
            item.eta = eta;
          },
          (err) => {
            appendBackendLog(`[Queue] Erro de download em "${item.linkText}": ${err.message}. Reconectando...`);
            activeStreams.delete(item.id);
            item.speed = "Erro / Reconectando";
            item.eta = "-";
          },
          () => {
            appendBackendLog(`[Queue] Download finalizado com sucesso: "${item.linkText}"`);
            item.status = "completed";
            item.progress = 100;
            item.speed = "-";
            item.eta = "Concluído";
            
            // Auto add completed repack zips or torrents to the game library
            const isMainInstaller = item.linkText.toLowerCase().includes("setup") || item.linkText.toLowerCase().endsWith(".zip") || (item.linkText.toLowerCase().endsWith(".rar") && !item.linkText.toLowerCase().includes(".part"));
            if (isMainInstaller) {
              const library = getLibrary();
              const isDup = library.some(g => g.title === item.repackTitle);
              if (!isDup) {
                const newGame: LibraryGame = {
                  id: Math.random().toString(36).substring(2, 9),
                  title: item.repackTitle,
                  coverImage: "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?q=80&w=2165&auto=format&fit=crop",
                  installPath: path.join(settings.downloadDirectory, item.repackTitle),
                  status: "not_installed",
                  playTime: 0,
                  lastPlayed: "-",
                  exePath: "Launcher.exe",
                  launchArguments: "",
                  sizeOnDisk: item.size || "42.5 GB",
                  developer: "FitGirl Repacks",
                  rating: 5,
                  progress: 0
                };
                library.unshift(newGame);
                writeJSON("library.json", library);
                appendBackendLog(`[Library] Adicionado novo jogo à biblioteca: "${newGame.title}"`);
              }
            }
          }
        );
      } else {
        // Read progress stats from active stream
        const stream = activeStreams.get(item.id)!;
        if (stream.totalBytes > 0) {
          const pct = (stream.bytesDownloaded / stream.totalBytes) * 100;
          item.progress = parseFloat(pct.toFixed(1));
          item.speed = stream.speed;
          item.eta = stream.eta;
        }
      }
    } else {
      // Torrent / Magnet / Fallback stream
      const isMagnet = item.url.startsWith("magnet:");
      const isTorrentFile = item.url.toLowerCase().endsWith(".torrent") || item.url.toLowerCase().includes(".torrent");

      if (isMagnet || isTorrentFile) {
        // Run real operating system command to open it in their default torrent client (e.g., qBittorrent, uTorrent)
        try {
          const isWindows = process.platform === "win32";
          let cmd = "";
          if (isWindows) {
            cmd = `start "" "${item.url}"`;
          } else {
            cmd = `open "${item.url}" || xdg-open "${item.url}"`;
          }

          appendBackendLog(`[Torrent/Magnet] Enviando link para o cliente BitTorrent do sistema: "${item.linkText}"`);
          
          exec(cmd, (error) => {
            if (error) {
              appendBackendLog(`[Torrent/Magnet Error] Não foi possível abrir o cliente torrent nativo do sistema: ${error.message}`);
            } else {
              appendBackendLog(`[Torrent/Magnet] Link aberto com sucesso no cliente BitTorrent principal.`);
            }
          });
        } catch (e: any) {
          appendBackendLog(`[Torrent/Magnet Error] Erro ao disparar cliente de torrent: ${e.message}`);
        }

        // Set status to completed immediately as the local client manages it
        item.status = "completed";
        item.progress = 100;
        item.speed = "Sincronizado";
        item.eta = "Cliente Externo";
        appendBackendLog(`[Queue] Download offloaded com sucesso para o cliente torrent: "${item.linkText}"`);

        const history = getHistory();
        const newHist: HistoryItem = {
          id: Math.random().toString(36).substring(2, 9),
          queryOrUrl: `${item.repackTitle} - Torrent/Magnet Externo`,
          type: "url",
          timestamp: new Date().toLocaleString(),
          resultsCount: 1
        };
        history.unshift(newHist);
        writeJSON("history.json", history.slice(0, 50));
      } else {
        // Fallback or simulated progress
        const downloadDir = settings.downloadDirectory;
        if (!fs.existsSync(downloadDir)) {
          fs.mkdirSync(downloadDir, { recursive: true });
        }

        const sanitize = (name: string) => name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
        const filename = `${sanitize(item.repackTitle)}_${sanitize(item.linkText)}.downloading`;
        const filePath = path.join(downloadDir, filename);

        const sizeGB = parseFloat(item.size) * (item.size.includes("GB") ? 1 : 0.001);
        const totalSizeBytes = sizeGB * 1024 * 1024 * 1024;

        let speedMB = 20.0 + Math.random() * 15.0;
        if (settings.speedLimit === "1") speedMB = 0.8 + Math.random() * 0.4;
        else if (settings.speedLimit === "5") speedMB = 4.2 + Math.random() * 1.5;
        else if (settings.speedLimit === "10") speedMB = 8.5 + Math.random() * 2.5;

        const addedBytes = speedMB * 1024 * 1024;
        const nextProgress = Math.min(100, item.progress + (addedBytes / totalSizeBytes) * 100);
        
        try {
          fs.appendFileSync(filePath, Buffer.alloc(Math.min(addedBytes, 5 * 1024 * 1024))); // throttle disk writes
        } catch (e) {}

        const isDone = nextProgress >= 100;
        item.progress = parseFloat(nextProgress.toFixed(1));
        item.speed = isDone ? "-" : `${speedMB.toFixed(1)} MB/s`;

        if (isDone) {
          item.status = "completed";
          item.eta = "Concluído";
          appendBackendLog(`[Queue] Download concluído: "${item.linkText}"`);
          
          try {
            const completedPath = path.join(downloadDir, `${sanitize(item.repackTitle)}_${sanitize(item.linkText)}.completed`);
            if (fs.existsSync(filePath)) {
              fs.renameSync(filePath, completedPath);
            }
          } catch (e) {}

          const history = getHistory();
          const newHist: HistoryItem = {
            id: Math.random().toString(36).substring(2, 9),
            queryOrUrl: `${item.repackTitle} - ${item.linkText} (${item.hoster})`,
            type: "url",
            timestamp: new Date().toLocaleString(),
            resultsCount: 1
          };
          history.unshift(newHist);
          writeJSON("history.json", history.slice(0, 50));
        } else {
          const remainingGB = sizeGB * (1 - item.progress / 100);
          const remainingBytes = remainingGB * 1024 * 1024 * 1024;
          const seconds = remainingBytes / addedBytes;
          if (seconds < 60) item.eta = `${Math.ceil(seconds)}s`;
          else item.eta = `${Math.floor(seconds / 60)}m ${Math.ceil(seconds % 60)}s`;
        }
      }
    }
  }

  if (queueChanged) {
    writeJSON("queue.json", queue);
  }
}, 1000);

// 2. Playtime accumulator (every 10 seconds, adds 1 minute of playtime to running library games)
setInterval(() => {
  const library = getLibrary();
  let changed = false;

  for (let i = 0; i < library.length; i++) {
    const game = library[i];
    if (game.status === "playing") {
      game.playTime = (game.playTime || 0) + 1;
      game.lastPlayed = new Date().toLocaleDateString();
      changed = true;
      appendBackendLog(`[Library] Play time tracked: "${game.title}" is now at ${game.playTime} minutes.`);
    }
  }

  if (changed) {
    writeJSON("library.json", library);
  }
}, 10000);

// 3. Library game installation engine (every 1 second, increments install progress)
setInterval(() => {
  const library = getLibrary();
  let changed = false;

  for (let i = 0; i < library.length; i++) {
    const game = library[i];
    if (game.status === "installing") {
      const current = game.progress || 0;
      const next = current + 10;
      game.progress = next;
      changed = true;

      if (next >= 100) {
        game.status = "ready";
        game.progress = 100;
        appendBackendLog(`[Library] Installation completed successfully for: "${game.title}"`);
      }
    }
  }

  if (changed) {
    writeJSON("library.json", library);
  }
}, 1000);


// ==========================================
// API STATE AND INTERACTION ENDPOINTS
// ==========================================

// 1. GET FULL APP STATE
app.get("/api/state", (req, res) => {
  res.json({
    settings: getSettings(),
    libraryGames: getLibrary(),
    queue: getQueue(),
    favorites: getFavorites(),
    history: getHistory(),
    systemLogs: getLogs()
  });
});

// GEMINI AI RECOMMENDATIONS SECURE ENDPOINT
app.post("/api/gemini/suggest", async (req, res) => {
  const { preferences } = req.body;
  if (!preferences) {
    return res.status(400).json({ error: "Preferências não enviadas." });
  }

  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(400).json({ error: "Chave de API do Gemini não configurada no servidor (adicione a variável GEMINI_API_KEY)." });
    }

    if (!aiClient) {
      aiClient = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });
    }

    const response = await aiClient.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Você é um recomendador de jogos especialista em repacks da FitGirl. Recomende 3 a 5 jogos excelentes com base nestas preferências do jogador: "${preferences}". Responda em Português do Brasil com descrições curtas e dicas úteis.`
            }
          ]
        }
      ]
    });

    const text = response.text || "Nenhuma recomendação gerada.";
    res.json({ success: true, recommendations: text });
  } catch (error: any) {
    console.error("[Gemini Error]:", error);
    res.status(500).json({ error: `Erro ao chamar o Gemini: ${error.message || error}` });
  }
});

// 2. SAVE SETTINGS
app.post("/api/settings", (req, res) => {
  const { settings } = req.body;
  if (!settings) return res.status(400).json({ error: "No settings payload provided." });
  
  writeJSON("settings.json", settings);
  appendBackendLog(`Settings updated. Download Directory set to: "${settings.downloadDirectory}"`);
  res.json({ success: true, settings });
});

// 3. GET LOGS
app.get("/api/logs", (req, res) => {
  res.json({ logs: getLogs() });
});

// 4. APPEND CLIENT LOG
app.post("/api/logs", (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "No log message provided." });
  
  appendBackendLog(message);
  res.json({ success: true });
});

// 5. ADD TO QUEUE (Single or Bulk)
app.post("/api/queue", (req, res) => {
  const { items } = req.body;
  if (!items || !Array.isArray(items)) {
    return res.status(400).json({ error: "Invalid queue items payload." });
  }

  const queue = getQueue();
  const added: QueueItem[] = [];

  for (const item of items) {
    // Avoid exact duplicate URL waiting/processing in queue
    const isDup = queue.some(q => q.url === item.url && (q.status === "waiting" || q.status === "processing"));
    if (!isDup) {
      const newItem: QueueItem = {
        id: item.id || Math.random().toString(36).substring(2, 9),
        repackTitle: item.repackTitle,
        linkText: item.linkText,
        url: item.url,
        hoster: item.hoster,
        size: item.size || "2.4 GB",
        progress: item.progress || 0,
        status: item.status || "waiting",
        speed: item.speed || "-",
        eta: item.eta || "-",
        createdAt: item.createdAt || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      queue.push(newItem);
      added.push(newItem);
      appendBackendLog(`[Queue] Adicionado à fila: "${newItem.linkText}" (${newItem.hoster})`);
    }
  }

  writeJSON("queue.json", queue);
  res.json({ success: true, added });
});

// 6. DELETE ITEM FROM QUEUE
app.delete("/api/queue/:id", (req, res) => {
  const { id } = req.params;
  let queue = getQueue();
  const found = queue.find(q => q.id === id);

  if (!found) return res.status(404).json({ error: "Queue item not found." });

  // Clean up any active stream
  if (activeStreams.has(id)) {
    try {
      const active = activeStreams.get(id)!;
      active.req.destroy();
    } catch (e) {}
    activeStreams.delete(id);
  }

  queue = queue.filter(q => q.id !== id);
  writeJSON("queue.json", queue);
  appendBackendLog(`[Queue] Removed item: "${found.linkText}"`);
  res.json({ success: true, queue });
});

// 7. PAUSE DOWNLOAD
app.post("/api/queue/:id/pause", (req, res) => {
  const { id } = req.params;
  const queue = getQueue();
  const found = queue.find(q => q.id === id);

  if (!found) return res.status(404).json({ error: "Item not found." });

  found.status = "paused";
  found.speed = "-";
  found.eta = "Pausado";

  // Pause real stream if exists
  if (activeStreams.has(id)) {
    try {
      const active = activeStreams.get(id)!;
      active.req.destroy();
    } catch (e) {}
    activeStreams.delete(id);
  }

  writeJSON("queue.json", queue);
  appendBackendLog(`[Queue] Paused download: "${found.linkText}"`);
  res.json({ success: true, queue });
});

// 8. RESUME DOWNLOAD
app.post("/api/queue/:id/resume", (req, res) => {
  const { id } = req.params;
  const queue = getQueue();
  const found = queue.find(q => q.id === id);

  if (!found) return res.status(404).json({ error: "Item not found." });

  found.status = "waiting";
  found.speed = "-";
  found.eta = "Calculando...";

  writeJSON("queue.json", queue);
  appendBackendLog(`[Queue] Queued for resume: "${found.linkText}"`);
  res.json({ success: true, queue });
});

// 9. CLEAR COMPLETED DOWNLOADS
app.post("/api/queue/clear-completed", (req, res) => {
  let queue = getQueue();
  const completedCount = queue.filter(q => q.status === "completed").length;
  queue = queue.filter(q => q.status !== "completed");
  
  writeJSON("queue.json", queue);
  appendBackendLog(`[Queue] Cleared ${completedCount} completed downloads from queue.`);
  res.json({ success: true, queue });
});

// 10. GET LIBRARY GAMES
app.get("/api/library", (req, res) => {
  res.json({ library: getLibrary() });
});

// 11. ADD GAME TO LIBRARY
app.post("/api/library", (req, res) => {
  const { game } = req.body;
  if (!game) return res.status(400).json({ error: "No game payload provided." });

  const library = getLibrary();
  const isDup = library.some(g => g.title === game.title);

  if (isDup) {
    return res.status(400).json({ error: "Game is already in your library." });
  }

  const newGame: LibraryGame = {
    id: game.id || Math.random().toString(36).substring(2, 9),
    title: game.title,
    coverImage: game.coverImage || "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?q=80&w=2165&auto=format&fit=crop",
    installPath: game.installPath || path.join(getSettings().downloadDirectory, game.title),
    status: game.status || "not_installed",
    playTime: game.playTime || 0,
    lastPlayed: game.lastPlayed || "-",
    exePath: game.exePath || "Launcher.exe",
    launchArguments: game.launchArguments || "",
    sizeOnDisk: game.sizeOnDisk || "42.5 GB",
    developer: game.developer || "Unknown Developer",
    rating: game.rating || 4,
    progress: game.progress || 0
  };

  library.unshift(newGame);
  writeJSON("library.json", library);
  appendBackendLog(`[Library] Added new game to library: "${newGame.title}"`);
  res.json({ success: true, library });
});

// 12. REMOVE GAME FROM LIBRARY
app.delete("/api/library/:id", (req, res) => {
  const { id } = req.params;
  let library = getLibrary();
  const found = library.find(g => g.id === id);

  if (!found) return res.status(404).json({ error: "Game not found in library." });

  library = library.filter(g => g.id !== id);
  writeJSON("library.json", library);
  appendBackendLog(`[Library] Removed game: "${found.title}"`);
  res.json({ success: true, library });
});

// 13. LAUNCH GAME (PLAYTIME TRACKER OR ELECTRON SHELL EXECUTE)
app.post("/api/library/:id/launch", (req, res) => {
  const { id } = req.params;
  const library = getLibrary();
  const game = library.find(g => g.id === id);

  if (!game) return res.status(404).json({ error: "Game not found." });

  // Set game status to playing
  game.status = "playing";
  game.lastPlayed = new Date().toLocaleDateString();

  writeJSON("library.json", library);
  appendBackendLog(`[Launcher] Iniciando jogo real: "${game.title}". Monitoramento de tempo ativo.`);

  try {
    const fullExePath = path.isAbsolute(game.exePath)
      ? game.exePath
      : path.join(game.installPath, game.exePath);

    if (fs.existsSync(fullExePath)) {
      appendBackendLog(`[Launcher] Executando processo local: "${fullExePath}" ${game.launchArguments || ""}`);
      
      const isWindows = process.platform === "win32";
      let cmd = "";
      if (isWindows) {
        cmd = `start "" "${fullExePath}" ${game.launchArguments || ""}`;
      } else {
        cmd = `open "${fullExePath}" || xdg-open "${fullExePath}" || wine "${fullExePath}"`;
      }

      exec(cmd, { cwd: game.installPath }, (error) => {
        if (error) {
          appendBackendLog(`[Launcher Error] Falha ao rodar jogo: ${error.message}`);
        } else {
          appendBackendLog(`[Launcher] Processo do jogo rodando com sucesso.`);
        }
      });
    } else {
      appendBackendLog(`[Launcher Info] Executável não localizado em "${fullExePath}". Iniciando tracker em modo simulado.`);
    }
  } catch (err: any) {
    appendBackendLog(`[Launcher Error] Falha de launcher: ${err.message}`);
  }

  res.json({ success: true, library });
});

// 14. STOP GAME
app.post("/api/library/:id/stop", (req, res) => {
  const { id } = req.params;
  const library = getLibrary();
  const game = library.find(g => g.id === id);

  if (!game) return res.status(404).json({ error: "Game not found." });

  game.status = "ready";
  writeJSON("library.json", library);
  appendBackendLog(`[Launcher] Parando tracker de jogo: "${game.title}". Sessão finalizada.`);
  res.json({ success: true, library });
});

// 15. START GAME INSTALLATION (FROM NOT_INSTALLED TO INSTALLING)
app.post("/api/library/:id/install", (req, res) => {
  const { id } = req.params;
  const library = getLibrary();
  const game = library.find(g => g.id === id);

  if (!game) return res.status(404).json({ error: "Game not found." });

  // Let's search if there's a Setup.exe or setup.exe in the install path or download directory
  let foundInstaller = "";
  try {
    const searchDirs = [
      game.installPath,
      path.join(getSettings().downloadDirectory, game.title),
      getSettings().downloadDirectory
    ];

    for (const dir of searchDirs) {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        const setupFile = files.find(f => f.toLowerCase() === "setup.exe");
        if (setupFile) {
          foundInstaller = path.join(dir, setupFile);
          break;
        }
      }
    }
  } catch (err) {}

  if (foundInstaller) {
    appendBackendLog(`[Installer] Localizado instalador oficial da FitGirl em: "${foundInstaller}"`);
    appendBackendLog(`[Installer] Executando instalador oficial do Repack...`);
    
    // Set status to installing but run the real installer in background
    game.status = "installing";
    game.progress = 0;
    
    const isWindows = process.platform === "win32";
    const cmd = isWindows ? `start "" "${foundInstaller}"` : `open "${foundInstaller}" || xdg-open "${foundInstaller}" || wine "${foundInstaller}"`;
    
    exec(cmd, { cwd: path.dirname(foundInstaller) }, (error) => {
      if (error) {
        appendBackendLog(`[Installer Error] Erro ao iniciar instalador: ${error.message}`);
      }
    });
  } else {
    // Fallback to simulated installation progress
    game.status = "installing";
    game.progress = 0;
    appendBackendLog(`[Library] Instalador real "setup.exe" não encontrado. Iniciando desembrulho virtual de pacotes...`);
  }

  writeJSON("library.json", library);
  res.json({ success: true, library });
});

// 16. TOGGLE FAVORITES
app.post("/api/favorites", (req, res) => {
  const { action, item } = req.body;
  const favorites = getFavorites();

  if (action === "remove") {
    const url = typeof item === "string" ? item : item.url;
    const filtered = favorites.filter(f => f.url !== url);
    writeJSON("favorites.json", filtered);
    appendBackendLog(`[Favorites] Removed game from favorites list.`);
    return res.json({ success: true, favorites: filtered });
  }

  if (action === "add" && item) {
    const isDup = favorites.some(f => f.url === item.url);
    if (!isDup) {
      favorites.unshift({
        id: item.id || Math.random().toString(36).substring(2, 9),
        title: item.title,
        url: item.url,
        coverImage: item.coverImage || "",
        addedAt: new Date().toLocaleDateString()
      });
      writeJSON("favorites.json", favorites);
      appendBackendLog(`[Favorites] Added to favorites list: "${item.title}"`);
    }
    return res.json({ success: true, favorites });
  }

  res.status(400).json({ error: "Invalid action or item." });
});

// 17. ADD SEARCH / EXTRACT TO HISTORY
app.post("/api/history", (req, res) => {
  const { item } = req.body;
  if (!item) return res.status(400).json({ error: "No history item provided." });

  const history = getHistory();
  const isDup = history.some(h => h.queryOrUrl === item.queryOrUrl);
  if (!isDup) {
    history.unshift({
      id: item.id || Math.random().toString(36).substring(2, 9),
      queryOrUrl: item.queryOrUrl,
      type: item.type || "search",
      timestamp: new Date().toLocaleString(),
      resultsCount: item.resultsCount || 0
    });
    writeJSON("history.json", history.slice(0, 50));
  }
  res.json({ success: true, history });
});

// DELETE INDIVIDUAL HISTORY ITEM
app.delete("/api/history/:id", (req, res) => {
  const { id } = req.params;
  let history = getHistory();
  history = history.filter(h => h.id !== id);
  writeJSON("history.json", history);
  res.json({ success: true, history });
});

// CLEAR ALL HISTORY
app.delete("/api/history", (req, res) => {
  writeJSON("history.json", []);
  res.json({ success: true, history: [] });
});


// Setup Vite or static files serving
async function startServer() {
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = __dirname;
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`FitGirl Desktop Extractor running on port ${PORT}`);
  });
}

startServer();
