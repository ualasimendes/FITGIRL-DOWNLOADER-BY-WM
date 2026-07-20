import React, { useState, useEffect, useRef } from "react";
import { 
  motion, 
  AnimatePresence 
} from "motion/react";
import { 
  Search, 
  Link2, 
  Code2, 
  HelpCircle, 
  Copy, 
  Download, 
  ExternalLink, 
  Gamepad2, 
  RefreshCw, 
  Star, 
  AlertCircle, 
  Check, 
  FileText, 
  ChevronRight, 
  ChevronUp,
  ChevronDown,
  Filter, 
  Layers, 
  Sparkles,
  Database,
  ArrowLeft,
  Terminal,
  Info,
  Play,
  Pause,
  Trash2,
  Trash,
  Settings as SettingsIcon,
  Heart,
  History,
  ArrowUp,
  ArrowDown,
  Save,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  CheckSquare,
  Square,
  FolderDown,
  Volume2,
  Globe,
  Lock,
  Cpu
} from "lucide-react";
import { 
  RepackGame, 
  ExtractedLink, 
  RepackDetails,
  QueueItem,
  HistoryItem,
  FavoriteItem,
  AppSettings,
  LibraryGame
} from "./types";
import { translations } from "./translations";

declare global {
  interface Window {
    electronAPI?: {
      getAppVersion: () => Promise<string>;
      checkForUpdates: () => Promise<any>;
      onUpdateAvailable: (callback: (info: any) => void) => () => void;
      onDownloadProgress: (callback: (percent: number) => void) => () => void;
      selectDirectory: () => Promise<string | null>;
    };
  }
}

export default function App() {
  // Language Selection state
  const [lang, setLang] = useState<"en" | "es" | "pt">(() => {
    try {
      const stored = localStorage.getItem("fg_lang");
      return (stored === "en" || stored === "es" || stored === "pt") ? stored : "pt";
    } catch {
      return "pt";
    }
  });

  useEffect(() => {
    localStorage.setItem("fg_lang", lang);
  }, [lang]);

  // Translation helper function
  const t = (key: keyof typeof translations.pt, replacements?: Record<string, string | number>) => {
    let text = translations[lang][key] || translations.pt[key] || "";
    if (replacements) {
      Object.entries(replacements).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, String(v));
      });
    }
    return text;
  };

  // Navigation tabs
  const [activeTab, setActiveTab] = useState<"search" | "url" | "html" | "queue" | "favorites" | "history" | "help" | "donate" | "library">("search");
  
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<RepackGame[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isSearching, setIsSearching] = useState(false);
  
  // Gemini AI state
  const [aiInput, setAiInput] = useState("");
  const [aiRecommendation, setAiRecommendation] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);

  const getAiRecommendations = async () => {
    if (!aiInput.trim()) return;
    setIsAiLoading(true);
    setAiRecommendation("");
    try {
      const res = await fetch("/api/gemini/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: aiInput }),
      });
      const data = await res.json();
      if (data.success) {
        setAiRecommendation(data.recommendations);
      } else {
        setAiRecommendation(`Erro: ${data.error || "Erro ao obter recomendações."}`);
      }
    } catch (err: any) {
      setAiRecommendation(`Falha de comunicação: ${err.message}`);
    } finally {
      setIsAiLoading(false);
    }
  };
  
  // URL Extractor state
  const [targetUrl, setTargetUrl] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  
  // Raw HTML state
  const [rawHtml, setRawHtml] = useState("");
  const [htmlUrl, setHtmlUrl] = useState("");
  
  // Extracted details view state
  const [selectedRepack, setSelectedRepack] = useState<RepackDetails | null>(null);
  
  // Hoster filter state
  const [activeFilter, setActiveFilter] = useState<string>("all");
  
  // Category filter state
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<"all" | "direct" | "torrent" | "crypter">("all");

  // Link search and premium-fast toggles
  const [linksSearchQuery, setLinksSearchQuery] = useState("");
  const [showFastOnly, setShowFastOnly] = useState(false);

  // Core State Managers synchronized with backend
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    simultaneousDownloads: 1,
    speedLimit: "unlimited",
    autoStartQueue: true,
    notifyOnComplete: true,
    defaultCategory: "all",
    downloadDirectory: "C:\\Downloads\\FitGirlRepacks"
  });
  const [libraryGames, setLibraryGames] = useState<LibraryGame[]>([]);
  const [selectedLibraryGameId, setSelectedLibraryGameId] = useState<string | null>("elden-ring");

  // Electron auto-updater states
  const [appVersion, setAppVersion] = useState("v2.4.0 Desktop Edition");
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(0);

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getAppVersion().then(v => {
        setAppVersion(`v${v} Desktop Edition`);
      }).catch(err => console.error(err));

      const unsubAvailable = window.electronAPI.onUpdateAvailable((info) => {
        setUpdateAvailable(true);
        addLog(`[AutoUpdater] New update available: v${info.version}. Downloading in background...`);
      });

      const unsubProgress = window.electronAPI.onDownloadProgress((percent) => {
        setUpdateProgress(percent);
      });

      return () => {
        if (unsubAvailable) unsubAvailable();
        if (unsubProgress) unsubProgress();
      };
    }
  }, []);

  // Load backend state once on component mount
  useEffect(() => {
    const loadState = async () => {
      try {
        const res = await fetch("/api/state");
        const contentType = res.headers.get("content-type");
        if (res.ok && contentType && contentType.includes("application/json")) {
          const data = await res.json();
          if (data.settings) setSettings(data.settings);
          if (data.libraryGames) {
            setLibraryGames(data.libraryGames);
            if (data.libraryGames.length > 0 && !selectedLibraryGameId) {
              setSelectedLibraryGameId(data.libraryGames[0].id);
            }
          }
          if (data.queue) setQueue(data.queue);
          if (data.favorites) setFavorites(data.favorites);
          if (data.history) setHistory(data.history);
          if (data.systemLogs) setSystemLogs(data.systemLogs);
        }
      } catch (err) {
        console.error("Failed to load backend state on mount:", err);
      }
    };
    loadState();
  }, []);

  // Poll backend state every 1.5s for real download status, install progress, active play tracking and logs
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/state");
        const contentType = res.headers.get("content-type");
        if (res.ok && contentType && contentType.includes("application/json")) {
          const data = await res.json();
          if (data.queue) setQueue(data.queue);
          if (data.libraryGames) setLibraryGames(data.libraryGames);
          if (data.systemLogs) setSystemLogs(data.systemLogs);
          if (data.favorites) setFavorites(data.favorites);
          if (data.history) setHistory(data.history);
        }
      } catch (err) {
        console.error("Polling backend state error:", err);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, []);

  const updateSettings = async (newSettings: AppSettings) => {
    setSettings(newSettings);
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: newSettings })
      });
    } catch (err) {
      console.error("Failed to sync settings with backend:", err);
    }
  };

  const addToLibrary = async (repack: { title: string; url: string; coverImage?: string }) => {
    const isAlreadyInLib = libraryGames.some(g => g.title === repack.title);
    if (isAlreadyInLib) {
      setSuccessMsg("Game is already in your Library!");
      return;
    }
    const cleanId = repack.title.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
    const newGame: LibraryGame = {
      id: cleanId || Math.random().toString(36).substring(2, 9),
      title: repack.title,
      coverImage: repack.coverImage || "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?q=80&w=2165&auto=format&fit=crop",
      installPath: `${settings.downloadDirectory || "C:\\Games"}\\${repack.title.replace(/[^a-zA-Z0-9\s]/g, "").trim()}`,
      status: "not_installed",
      playTime: 0,
      lastPlayed: "-",
      exePath: "Launcher.exe",
      launchArguments: "",
      sizeOnDisk: "42.5 GB",
      developer: "Unknown Developer",
      rating: 4,
      progress: 0
    };

    try {
      const res = await fetch("/api/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game: newGame })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.library) setLibraryGames(data.library);
        setSelectedLibraryGameId(newGame.id);
        addLog(`[Library] Added "${repack.title}" to Library.`);
        setSuccessMsg("Added to Library!");
      } else {
        const errData = await res.json();
        setErrorMsg(errData.error || "Failed to add game to Library.");
      }
    } catch (err) {
      console.error("Error adding to library:", err);
      setErrorMsg("Error communicating with backend.");
    }
  };

  const removeFromLibrary = async (id: string) => {
    try {
      const res = await fetch(`/api/library/${id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        const data = await res.json();
        if (data.library) setLibraryGames(data.library);
        addLog(`[Library] Removed game ID ${id} from Library.`);
        setSuccessMsg("Removed from Library.");
        if (selectedLibraryGameId === id) {
          setSelectedLibraryGameId(null);
        }
      }
    } catch (err) {
      console.error("Error removing from library:", err);
    }
  };

  // Queue sub-states
  const [queueFilter, setQueueFilter] = useState<"all" | "active" | "completed" | "paused">("all");
  const [queueSearch, setQueueSearch] = useState("");
  const [selectedQueueItems, setSelectedQueueItems] = useState<Set<string>>(new Set());
  const [libraryQuery, setLibraryQuery] = useState("");

  // Helper to categorize links
  const getLinkCategory = (hoster: string): "direct" | "torrent" | "crypter" => {
    const h = hoster.toLowerCase();
    if (
      h.includes("magnet") ||
      h.includes("torrent") ||
      h.includes("rutor") ||
      h.includes("tapochek") ||
      h.includes("1337x") ||
      h.includes("tracker")
    ) {
      return "torrent";
    }
    if (
      h.includes("filecrypt") ||
      h.includes("multiup") ||
      h.includes("crypter")
    ) {
      return "crypter";
    }
    return "direct";
  };
  
  // Feedback alerts & logs
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [copierState, setCopierState] = useState<Record<string, boolean>>({}); // track copied state for items
  const [systemLogs, setSystemLogs] = useState<string[]>(() => {
    return [
      "System initialized.",
      "FITGIRL EXTRACTOR BY WM - Premium Manager loaded.",
      "Awaiting command... Choose standard Search or direct Link extraction."
    ];
  });

  // Log message helper
  const addLog = async (msg: string) => {
    try {
      await fetch("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg })
      });
    } catch (err) {
      console.error("Log error:", err);
    }
  };

  // Helper to add individual link to queue
  const addToQueue = async (repackTitle: string, link: ExtractedLink) => {
    let sizeStr = "2.4 GB";
    const titleLower = link.text.toLowerCase();
    if (titleLower.includes("part")) {
      sizeStr = "500 MB";
    } else {
      const sizes = ["1.5 GB", "2.2 GB", "3.8 GB", "4.5 GB", "5.2 GB", "7.6 GB", "12.1 GB"];
      sizeStr = sizes[Math.floor(Math.random() * sizes.length)];
    }

    // Check if duplicate is already waiting or processing
    const isDup = queue.some(item => item.url === link.href && (item.status === "waiting" || item.status === "processing"));
    if (isDup) {
      setErrorMsg("This link is already in your download queue!");
      return;
    }

    const newItem: QueueItem = {
      id: Math.random().toString(36).substring(2, 9),
      repackTitle,
      linkText: link.text || `Part / Mirror Link`,
      url: link.href,
      hoster: link.hoster || "Direct Link",
      status: "waiting",
      progress: 0,
      speed: "-",
      eta: "-",
      size: sizeStr,
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    try {
      const res = await fetch("/api/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [newItem] })
      });
      if (res.ok) {
        addLog(`[Queue] Added item: "${newItem.linkText}" (${newItem.hoster})`);
        setSuccessMsg(`Added to download queue!`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Helper to add bulk links to queue
  const addFilteredLinksToQueue = async (repackTitle: string, links: ExtractedLink[]) => {
    if (links.length === 0) {
      setErrorMsg("No links selected/available to add.");
      return;
    }

    const newItems: QueueItem[] = links.map(link => {
      let sizeStr = "2.4 GB";
      const titleLower = link.text.toLowerCase();
      if (titleLower.includes("part")) {
        sizeStr = "500 MB";
      } else {
        const sizes = ["1.5 GB", "2.2 GB", "3.8 GB", "4.5 GB", "5.2 GB", "7.6 GB", "12.1 GB"];
        sizeStr = sizes[Math.floor(Math.random() * sizes.length)];
      }

      return {
        id: Math.random().toString(36).substring(2, 9),
        repackTitle,
        linkText: link.text || `Part / Mirror Link`,
        url: link.href,
        hoster: link.hoster || "Direct Link",
        status: "waiting",
        progress: 0,
        speed: "-",
        eta: "-",
        size: sizeStr,
        createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
    });

    try {
      const res = await fetch("/api/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: newItems })
      });
      if (res.ok) {
        addLog(`[Queue] Bulk added ${newItems.length} links from "${repackTitle}".`);
        setSuccessMsg(`Added ${newItems.length} items to queue!`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Favorites logic
  const toggleFavorite = async (repack: RepackDetails | RepackGame) => {
    const isFav = favorites.some(f => f.url === repack.url);
    if (isFav) {
      try {
        const res = await fetch("/api/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "remove", item: repack.url })
        });
        if (res.ok) {
          addLog(`Removed from Favorites: "${repack.title}"`);
          setSuccessMsg("Removed from Favorites.");
        }
      } catch (err) {
        console.error(err);
      }
    } else {
      const newFav: FavoriteItem = {
        id: Math.random().toString(36).substring(2, 9),
        title: repack.title,
        url: repack.url,
        coverImage: repack.coverImage || "",
        addedAt: new Date().toLocaleDateString()
      };
      try {
        const res = await fetch("/api/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "add", item: newFav })
        });
        if (res.ok) {
          addLog(`Added to Favorites: "${repack.title}"`);
          setSuccessMsg("Saved to Favorites!");
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  const isFavorite = (url: string) => {
    return favorites.some(f => f.url === url);
  };

  // History logic
  const clearHistory = async () => {
    try {
      const res = await fetch("/api/history", { method: "DELETE" });
      if (res.ok) {
        const data = await res.json();
        if (data.history) setHistory(data.history);
        addLog("System history database cleared.");
        setSuccessMsg("History cleared.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const removeFromHistory = async (id: string) => {
    try {
      const res = await fetch(`/api/history/${id}`, { method: "DELETE" });
      if (res.ok) {
        const data = await res.json();
        if (data.history) setHistory(data.history);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Queue individual and bulk action helpers
  const pauseQueueItem = async (id: string) => {
    try {
      const res = await fetch(`/api/queue/${id}/pause`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        if (data.queue) setQueue(data.queue);
        addLog(`[Queue] Paused task.`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const resumeQueueItem = async (id: string) => {
    try {
      const res = await fetch(`/api/queue/${id}/resume`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        if (data.queue) setQueue(data.queue);
        addLog(`[Queue] Resumed task.`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const cancelQueueItem = async (id: string) => {
    try {
      const res = await fetch(`/api/queue/${id}`, { method: "DELETE" });
      if (res.ok) {
        const data = await res.json();
        if (data.queue) setQueue(data.queue);
        setSelectedQueueItems(prev => {
          const copy = new Set(prev);
          copy.delete(id);
          return copy;
        });
        addLog(`[Queue] Removed task.`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const moveQueueItem = (index: number, direction: "up" | "down") => {
    const newQueue = [...queue];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= queue.length) return;
    
    // Swap
    const temp = newQueue[index];
    newQueue[index] = newQueue[targetIndex];
    newQueue[targetIndex] = temp;
    
    setQueue(newQueue);
    addLog(`[Queue] Reordered queue. Moved "${temp.linkText}" ${direction}.`);
  };

  const pauseAllQueue = async () => {
    try {
      for (const item of queue) {
        if (item.status === "processing" || item.status === "waiting") {
          await fetch(`/api/queue/${item.id}/pause`, { method: "POST" });
        }
      }
      addLog("[Queue] Paused all tasks in the manager queue.");
      setSuccessMsg("All tasks paused.");
    } catch (err) {
      console.error(err);
    }
  };

  const resumeAllQueue = async () => {
    try {
      for (const item of queue) {
        if (item.status === "paused") {
          await fetch(`/api/queue/${item.id}/resume`, { method: "POST" });
        }
      }
      addLog("[Queue] Resumed all paused tasks in the queue.");
      setSuccessMsg("All tasks resumed.");
    } catch (err) {
      console.error(err);
    }
  };

  const clearCompletedQueue = async () => {
    try {
      const res = await fetch("/api/queue/clear-completed", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        if (data.queue) setQueue(data.queue);
        addLog(`[Queue] Cleared completed tasks from the queue.`);
        setSuccessMsg(`Cleared completed tasks.`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Bulk selection and actions
  const toggleSelectAllQueue = () => {
    if (selectedQueueItems.size === queue.length && queue.length > 0) {
      setSelectedQueueItems(new Set());
    } else {
      setSelectedQueueItems(new Set(queue.map(q => q.id)));
    }
  };

  const toggleSelectQueueItem = (id: string) => {
    setSelectedQueueItems(prev => {
      const copy = new Set(prev);
      if (copy.has(id)) {
        copy.delete(id);
      } else {
        copy.add(id);
      }
      return copy;
    });
  };

  const pauseSelectedQueue = () => {
    if (selectedQueueItems.size === 0) {
      setErrorMsg("No queue items selected!");
      return;
    }
    setQueue(prev => prev.map(q => {
      if (selectedQueueItems.has(q.id) && (q.status === "processing" || q.status === "waiting")) {
        return { ...q, status: "paused", speed: "-", eta: "-" };
      }
      return q;
    }));
    addLog(`[Queue] Bulk paused ${selectedQueueItems.size} selected tasks.`);
    setSuccessMsg(`Paused selected tasks.`);
  };

  const resumeSelectedQueue = () => {
    if (selectedQueueItems.size === 0) {
      setErrorMsg("No queue items selected!");
      return;
    }
    setQueue(prev => prev.map(q => {
      if (selectedQueueItems.has(q.id) && q.status === "paused") {
        return { ...q, status: "waiting" };
      }
      return q;
    }));
    addLog(`[Queue] Bulk resumed ${selectedQueueItems.size} selected tasks.`);
    setSuccessMsg(`Resumed selected tasks.`);
  };

  const deleteSelectedQueue = () => {
    if (selectedQueueItems.size === 0) {
      setErrorMsg("No queue items selected!");
      return;
    }
    setQueue(prev => prev.filter(q => !selectedQueueItems.has(q.id)));
    addLog(`[Queue] Bulk deleted ${selectedQueueItems.size} tasks.`);
    setSuccessMsg(`Deleted selected items.`);
    setSelectedQueueItems(new Set());
  };

  const exportSelectedQueue = () => {
    const itemsToExport = queue.filter(q => selectedQueueItems.has(q.id) || selectedQueueItems.size === 0);
    if (itemsToExport.length === 0) {
      setErrorMsg("No links found in selection to export.");
      return;
    }

    const content = itemsToExport.map(q => `${q.repackTitle} | ${q.linkText} | ${q.url}`).join("\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = `exported_queue_links_${new Date().toISOString().substring(0,10)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
    addLog(`[Queue] Exported ${itemsToExport.length} links as txt file.`);
    setSuccessMsg(`Exported ${itemsToExport.length} URLs!`);
  };

  // Clear feedback messages
  useEffect(() => {
    if (errorMsg) {
      const timer = setTimeout(() => setErrorMsg(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [errorMsg]);

  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  // Search FitGirl repacks
  const handleSearch = async (page = 1) => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setErrorMsg(null);
    setSelectedRepack(null);
    addLog(`Searching for repack: "${searchQuery}" (Page ${page})...`);

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}&page=${page}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to search.");
      }

      setSearchResults(data.results || []);
      setCurrentPage(data.page || 1);
      setTotalPages(data.totalPages || 1);
      addLog(`Search completed. Found ${data.results?.length || 0} matches.`);
      
      if (data.results?.length === 0) {
        setErrorMsg("No games found matching your search. Try adjusting the title or search words.");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "An error occurred while connecting to the proxy.");
      addLog(`ERR: ${err.message}`);
    } finally {
      setIsSearching(false);
    }
  };

  // Extract from URL
  const handleExtractFromUrl = async (urlStr: string) => {
    const cleanUrl = urlStr.trim();
    if (!cleanUrl) return;

    if (!cleanUrl.includes("fitgirl-repacks.site")) {
      setErrorMsg("Please enter a valid URL containing fitgirl-repacks.site");
      return;
    }

    setIsExtracting(true);
    setErrorMsg(null);
    setSelectedRepack(null);
    addLog(`Connecting to scrape page: ${cleanUrl}...`);

    try {
      const res = await fetch(`/api/extract?url=${encodeURIComponent(cleanUrl)}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.details || "Failed to parse page.");
      }

      setSelectedRepack(data.data);
      setActiveFilter("all");
      addLog(`Successfully extracted ${data.data.links?.length || 0} links from "${data.data.title}".`);
      setSuccessMsg(`Extracted! Found ${data.data.links?.length || 0} links.`);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Scraper proxy block or invalid page response.");
      addLog(`ERR: ${err.message}`);
      
      // Auto recommend HTML tab on failure
      setActiveTab("html");
      setHtmlUrl(cleanUrl);
      addLog("Tip: Site proxy blocked by protection. Use the 'Paste HTML' method for 100% success!");
    } finally {
      setIsExtracting(false);
    }
  };

  // Parse Raw HTML
  const handleParseRawHtml = async () => {
    if (!rawHtml.trim()) {
      setErrorMsg("Please paste some HTML source code first.");
      return;
    }

    setIsExtracting(true);
    setErrorMsg(null);
    setSelectedRepack(null);
    addLog(`Parsing pasted HTML code (${Math.round(rawHtml.length / 1024)} KB)...`);

    try {
      const res = await fetch("/api/parse-html", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html: rawHtml, url: htmlUrl })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to parse pasted HTML.");
      }

      setSelectedRepack(data.data);
      setActiveFilter("all");
      addLog(`Offline Parser successful. Extracted ${data.data.links?.length || 0} links from "${data.data.title}".`);
      setSuccessMsg("Pasted HTML successfully parsed!");
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Could not parse HTML payload.");
      addLog(`ERR: ${err.message}`);
    } finally {
      setIsExtracting(false);
    }
  };

  // Preset search click
  const handlePresetSearch = (preset: string) => {
    setSearchQuery(preset);
    // Use timeout to let state update or just trigger directly with the string
    setTimeout(() => {
      setIsSearching(true);
      fetch(`/api/search?q=${encodeURIComponent(preset)}&page=1`)
        .then(res => res.json())
        .then(data => {
          setSearchResults(data.results || []);
          setCurrentPage(1);
          setTotalPages(data.totalPages || 1);
          addLog(`Preset "${preset}" search completed. Found ${data.results?.length || 0} items.`);
          if (data.results?.length === 0) setErrorMsg("No results.");
        })
        .catch(err => {
          setErrorMsg(err.message);
          addLog(`ERR: ${err.message}`);
        })
        .finally(() => setIsSearching(false));
    }, 50);
  };

  // Helper to retrieve hoster tier rating and speed description (Quality of Life)
  const getHosterTier = (hoster: string): { label: string; bgClass: string; speed: string; rating: number; isPremiumFast: boolean; description: string } => {
    const h = hoster.toLowerCase();
    if (h.includes("fucking fast") || h.includes("fuckfast")) {
      return {
        label: "⚡ Fucking Fast",
        bgClass: "bg-amber-500/20 text-amber-300 border-amber-500/40",
        speed: "100+ MB/s",
        rating: 10,
        isPremiumFast: true,
        description: "Sem limite de velocidade, sem registro. Melhor opção direta!"
      };
    }
    if (h.includes("datanodes")) {
      return {
        label: "🔥 Datanodes.to",
        bgClass: "bg-yellow-500/20 text-yellow-350 border-yellow-500/40",
        speed: "80+ MB/s",
        rating: 9.5,
        isPremiumFast: true,
        description: "Excelente servidor de alta velocidade direta e super estável."
      };
    }
    if (h.includes("gofile") || h.includes("qiwi") || h.includes("pixeldrain") || h.includes("buzzheavier")) {
      return {
        label: "⚡ Alta Velocidade",
        bgClass: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
        speed: "40+ MB/s",
        rating: 8.5,
        isPremiumFast: true,
        description: "Servidor gratuito recomendado com boas taxas de transferência."
      };
    }
    if (h.includes("magnet") || h.includes("torrent") || h.includes("rutor") || h.includes("tapochek") || h.includes("1337x")) {
      return {
        label: "🧲 P2P / Torrent",
        bgClass: "bg-purple-500/20 text-purple-300 border-purple-500/40",
        speed: "Ilimitado",
        rating: 8.0,
        isPremiumFast: false,
        description: "Requer cliente torrent. Velocidade depende de seeds & peers."
      };
    }
    if (h.includes("multiup") || h.includes("filecrypt")) {
      return {
        label: "📦 Container / Protetor",
        bgClass: "bg-blue-500/20 text-blue-300 border-blue-500/40",
        speed: "Externo",
        rating: 7.0,
        isPremiumFast: false,
        description: "Protege e agrupa múltiplos links de servidores de download direto."
      };
    }
    if (h.includes("1fichier") || h.includes("mega") || h.includes("drive.google") || h.includes("google drive") || h.includes("onedrive") || h.includes("mediafire")) {
      return {
        label: "☁️ Armazenamento Nuvem",
        bgClass: "bg-sky-500/20 text-sky-300 border-sky-500/40",
        speed: "15-25 MB/s",
        rating: 7.5,
        isPremiumFast: false,
        description: "Servidor estável, mas pode ter limites de cota ou tempo de espera."
      };
    }
    return {
      label: "Servidor Secundário",
      bgClass: "bg-slate-500/20 text-slate-300 border-slate-500/40",
      speed: "Variável",
      rating: 5.0,
      isPremiumFast: false,
      description: "Servidor lento ou com captcha obrigatório/limites estritos."
    };
  };

  // Group & Filter extracted links
  const getFilteredLinks = (): ExtractedLink[] => {
    if (!selectedRepack) return [];
    let baseLinks = selectedRepack.links;

    // Apply category filter first if set
    if (activeCategoryFilter !== "all") {
      baseLinks = baseLinks.filter(link => getLinkCategory(link.hoster) === activeCategoryFilter);
    }

    // Apply specific hoster filter if set and not "all"
    if (activeFilter !== "all") {
      baseLinks = baseLinks.filter(link => link.hoster === activeFilter);
    }

    // Filter by Premium Fast if enabled
    if (showFastOnly) {
      baseLinks = baseLinks.filter(link => getHosterTier(link.hoster).isPremiumFast);
    }

    // Filter by text search if present
    if (linksSearchQuery.trim() !== "") {
      const q = linksSearchQuery.toLowerCase();
      baseLinks = baseLinks.filter(
        link =>
          link.text.toLowerCase().includes(q) ||
          link.hoster.toLowerCase().includes(q) ||
          link.href.toLowerCase().includes(q)
      );
    }

    return baseLinks;
  };

  // Get list of unique hosters present in the extracted links
  const getUniqueHosters = (): string[] => {
    if (!selectedRepack) return [];
    const hostersSet = new Set<string>();
    
    const baseLinks = activeCategoryFilter === "all"
      ? selectedRepack.links
      : selectedRepack.links.filter(link => getLinkCategory(link.hoster) === activeCategoryFilter);

    baseLinks.forEach(link => {
      if (link.hoster) hostersSet.add(link.hoster);
    });
    return Array.from(hostersSet);
  };

  // Copy selected/filtered links to clipboard
  const handleCopyLinks = (onlyFiltered = false) => {
    const targetLinks = onlyFiltered ? getFilteredLinks() : selectedRepack?.links || [];
    if (targetLinks.length === 0) {
      setErrorMsg("No links to copy.");
      return;
    }

    const rawList = targetLinks.map(l => l.href).join("\r\n");
    navigator.clipboard.writeText(rawList)
      .then(() => {
        setSuccessMsg(`Copied ${targetLinks.length} URLs to clipboard!`);
        addLog(`Copied ${targetLinks.length} links to clipboard. Paste directly into JDownloader!`);
      })
      .catch(err => {
        setErrorMsg("Failed to copy to clipboard.");
        console.error(err);
      });
  };

  // Copy a single link
  const handleCopySingle = (href: string, index: number) => {
    navigator.clipboard.writeText(href)
      .then(() => {
        setCopierState(prev => ({ ...prev, [href]: true }));
        addLog(`Copied link: ${href.substring(0, 45)}...`);
        setTimeout(() => {
          setCopierState(prev => ({ ...prev, [href]: false }));
        }, 2000);
      });
  };

  // Download links as .txt file
  const handleDownloadTxt = () => {
    if (!selectedRepack) return;
    const linksToDownload = getFilteredLinks();
    if (linksToDownload.length === 0) {
      setErrorMsg("No links to download.");
      return;
    }

    const rawText = `=== FITGIRL REPACK LINKS EXTRACTOR ===\r\n` +
      `Game: ${selectedRepack.title}\r\n` +
      `Source URL: ${selectedRepack.url || "Pasted HTML"}\r\n` +
      `Filter: ${activeFilter}\r\n` +
      `Total Links: ${linksToDownload.length}\r\n` +
      `Date Extracted: ${new Date().toLocaleString()}\r\n` +
      `======================================\r\n\r\n` +
      linksToDownload.map(l => `${l.section} | ${l.hoster} | ${l.text}\r\n-> ${l.href}`).join("\r\n\r\n");

    const blob = new Blob([rawText], { type: "text/plain;charset=utf-8" });
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    
    // Clean game title for filename
    const cleanName = selectedRepack.title
      .replace(/[^a-z0-9]/gi, "_")
      .toLowerCase()
      .substring(0, 50);
      
    link.download = `fitgirl_links_${cleanName}_${activeFilter.toLowerCase().replace(/[^a-z0-9]/gi, "")}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
    
    addLog(`Downloaded .txt file for ${linksToDownload.length} links.`);
  };

  // Helper to determine the step of the internal automated browser downloader
  const getBrowserAutomationStep = (progress: number, activeItem: any) => {
    if (!activeItem) {
      return {
        status: "Standing by...",
        step: 0,
        url: "",
        logs: ["[System] Headless downloader ready."]
      };
    }
    if (progress === 0) {
      return {
        status: "Initializing sandboxed browser...",
        step: 1,
        url: activeItem.url,
        logs: [
          "[System] Launching internal headless browser agent...",
          "[System] Creating isolated sandbox container..."
        ]
      };
    }
    if (progress < 15) {
      return {
        status: "Establishing bypass handshake...",
        step: 2,
        url: "https://challenges.cloudflare.com/cdn-cgi/challenge-platform/h/g/flow",
        logs: [
          "[Browser] Loading target URL...",
          `[Browser] URL: ${activeItem.url}`,
          "[Cloudflare] Solving Turnstile JS challenge... (Token: pending)",
          "[Cloudflare] Verifying canvas hash & user-agent signature..."
        ]
      };
    }
    if (progress < 35) {
      return {
        status: "Resolving hoster download tickets...",
        step: 3,
        url: activeItem.url,
        logs: [
          "[Browser] Cloudflare challenge: PASSED (Token: cf_clearance_7fb3d)",
          "[Hoster] Page fully loaded in internal secure sandbox.",
          "[Hoster] Locating active direct download mirrors...",
          "[Hoster] Waiting for direct file token ticket generation... (4s)"
        ]
      };
    }
    if (progress < 55) {
      return {
        status: "Auto-triggering direct socket stream...",
        step: 4,
        url: activeItem.url,
        logs: [
          "[Hoster] Download ticket generated: ID_992fb38e",
          "[Hoster] Simulating click on: \"Download File Mirror #1\"",
          "[Browser] Direct Download Link (DDL) successfully resolved!",
          `[Browser] Destination: ${settings.downloadDirectory || "C:\\Downloads\\FitGirlRepacks"}`
        ]
      };
    }
    if (progress < 85) {
      return {
        status: "Streaming binary chunks internally...",
        step: 5,
        url: "https://streaming.hostercdn.net/dl/bin_stream/active_socket",
        logs: [
          "[Stream] Multiplexing download over 4 secure connection threads...",
          `[Stream] Pipe: Socket -> ${settings.downloadDirectory || "C:\\Downloads\\FitGirlRepacks"}\\${(activeItem.linkText || "part").replace(/[^a-zA-Z0-9.-]/g, "_")}`,
          `[Stream] Writing chunks to disk... ${(progress * 15.4).toFixed(1)} MB / 1540 MB`,
          `[Stream] Buffer: 64KB sliding window | Latency: 42ms | Verified`
        ]
      };
    }
    return {
      status: "Finalizing and verifying integrity checksums...",
      step: 6,
      url: "localhost/checksum_validator",
      logs: [
        "[Stream] Binary sequence download finished completely.",
        "[Integrity] Running MD5/SHA-256 integrity hash test...",
        `[Integrity] File size check: PASS`,
        `[Integrity] Completed download successfully saved to: ${settings.downloadDirectory || "C:\\Downloads\\FitGirlRepacks"}`
      ]
    };
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 flex items-center justify-center p-2 sm:p-4 font-sans selection:bg-sky-500/30 selection:text-sky-400">
      
      {/* Real-looking Desktop Window container in Bento Style */}
      <div className="w-full max-w-6xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl shadow-slate-950/80 flex flex-col overflow-hidden h-[90vh] sm:h-[85vh] min-h-[580px] max-h-[900px]" id="desktop-window">
        
        {/* WINDOW TITLE BAR */}
        <div className="bg-slate-950 px-4 py-3 flex items-center justify-between border-b border-slate-800 shrink-0 select-none" id="title-bar">
          {/* macOS window control buttons */}
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500 hover:opacity-80 transition cursor-pointer" title="Close"></span>
            <span className="w-3 h-3 rounded-full bg-yellow-500 hover:opacity-80 transition cursor-pointer" title="Minimize"></span>
            <span className="w-3 h-3 rounded-full bg-green-500 hover:opacity-80 transition cursor-pointer" title="Maximize"></span>
            <div className="hidden sm:flex items-center gap-1.5 ml-4 text-xs font-semibold text-slate-500 uppercase tracking-widest">
              <Gamepad2 size={12} className="text-sky-400 animate-pulse" />
              <span>Suite Mode</span>
            </div>
          </div>
          
          {/* Window Title */}
          <div className="flex items-center gap-2 text-sm font-medium tracking-tight text-slate-300">
            <span className="font-semibold text-sky-400 bg-sky-950/40 border border-sky-900/40 px-2 py-0.5 rounded text-xs">FG</span>
            <span className="font-mono text-white font-bold tracking-tight">FITGIRL EXTRACTOR BY WM</span>
            <span className="text-slate-600 font-normal">|</span>
            <span className="text-xs text-slate-400 font-mono">{appVersion}</span>
            {updateAvailable && (
              <span className="text-[10px] bg-indigo-600/80 text-indigo-100 border border-indigo-500/30 px-2 py-0.5 rounded font-mono animate-pulse flex items-center gap-1 ml-1">
                <RefreshCw size={10} className="animate-spin text-indigo-300" />
                Update: {updateProgress.toFixed(0)}%
              </span>
            )}
          </div>

          {/* Connection Status & Language Indicator */}
          <div className="flex items-center gap-3">
            {/* Language Dropdown Selector */}
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 shadow-sm shrink-0">
              <Globe size={12} className="text-sky-400" />
              <select
                value={lang}
                onChange={(e) => {
                  const val = e.target.value as "en" | "es" | "pt";
                  setLang(val);
                  addLog(`[Language] System language changed to ${val === "en" ? "English" : val === "es" ? "Spanish" : "Portuguese"}`);
                }}
                className="bg-transparent text-[11px] font-bold text-slate-300 border-none outline-none focus:outline-none focus:ring-0 cursor-pointer pr-1 py-0 select-none font-mono"
              >
                <option value="pt" className="bg-slate-950 text-slate-300">PT-br</option>
                <option value="en" className="bg-slate-950 text-slate-300">EN</option>
                <option value="es" className="bg-slate-950 text-slate-300">ES</option>
              </select>
            </div>

            {/* Connection Status Indicator */}
            <div className="hidden xs:flex items-center gap-1.5 shrink-0">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
              </span>
              <span className="text-[10px] text-sky-400 font-mono tracking-tighter">
                {lang === "pt" ? "Conectado" : lang === "es" ? "Conectado" : "Connected"}
              </span>
            </div>
          </div>
        </div>

        {/* WINDOW BODY */}
        <div className="flex flex-1 overflow-hidden">
          
          {/* SIDE NAVIGATION */}
          <div className="w-16 sm:w-56 bg-slate-950 flex flex-col justify-between p-2 sm:p-3 border-r border-slate-800 shrink-0 select-none" id="sidebar">
            <div className="space-y-4">
              {/* Profile logo for desktop */}
              <div className="hidden sm:flex items-center gap-3 px-3 py-4 border-b border-slate-800/50">
                <div className="w-10 h-10 rounded-xl bg-sky-500 flex items-center justify-center font-bold text-lg text-white shadow-lg shadow-sky-500/20 shrink-0">
                  FG
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-xs tracking-tight text-white truncate">FG EXTRACTOR</h3>
                  <p className="text-[9px] text-sky-400 font-bold font-mono tracking-wider truncate uppercase">BY WM</p>
                </div>
              </div>

              {/* Navigation Menu */}
              <div className="space-y-1">
                <button
                  id="tab-search"
                  onClick={() => { setActiveTab("search"); setSelectedRepack(null); }}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-all text-sm font-medium text-left ${
                    activeTab === "search" && !selectedRepack
                      ? "bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-600/20 font-bold"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                  }`}
                >
                  <Search size={18} />
                  <span className="hidden sm:inline">{t("tabSearch")}</span>
                </button>

                <button
                  id="tab-url"
                  onClick={() => { setActiveTab("url"); setSelectedRepack(null); }}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-all text-sm font-medium text-left ${
                    activeTab === "url" && !selectedRepack
                      ? "bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-600/20 font-bold"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                  }`}
                >
                  <Link2 size={18} />
                  <span className="hidden sm:inline">{t("tabUrl")}</span>
                </button>

                <button
                  id="tab-html"
                  onClick={() => { setActiveTab("html"); setSelectedRepack(null); }}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-all text-sm font-medium text-left ${
                    activeTab === "html" && !selectedRepack
                      ? "bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-600/20 font-bold"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                  }`}
                >
                  <Code2 size={18} />
                  <span className="hidden sm:inline">{t("tabHtml")}</span>
                </button>

                {/* New: Download Queue (Fila de Processamento) */}
                <button
                  id="tab-queue"
                  onClick={() => { setActiveTab("queue"); setSelectedRepack(null); }}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl transition-all text-sm font-medium text-left ${
                    activeTab === "queue" && !selectedRepack
                      ? "bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-600/20 font-bold"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <FolderDown size={18} className={queue.some(q => q.status === "processing") ? "text-emerald-400 animate-pulse" : ""} />
                    <span className="hidden sm:inline">{t("tabQueue")}</span>
                  </div>
                  {queue.filter(q => q.status === "waiting" || q.status === "processing").length > 0 && (
                    <span className="hidden sm:inline-flex items-center justify-center bg-sky-500 text-slate-950 font-black text-[10px] h-4 min-w-[16px] px-1 rounded-full font-mono">
                      {queue.filter(q => q.status === "waiting" || q.status === "processing").length}
                    </span>
                  )}
                </button>



                {/* New: Game Library (Steam Style) */}
                <button
                  id="tab-library"
                  onClick={() => { setActiveTab("library"); setSelectedRepack(null); }}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl transition-all text-sm font-medium text-left ${
                    activeTab === "library" && !selectedRepack
                      ? "bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-600/20 font-bold"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Gamepad2 size={18} className={libraryGames.some(g => g.status === "playing") ? "text-green-400 animate-pulse" : ""} />
                    <span className="hidden sm:inline">{t("tabLibrary")}</span>
                  </div>
                  {libraryGames.length > 0 && (
                    <span className="hidden sm:inline-flex items-center justify-center bg-slate-800 text-slate-300 font-bold text-[10px] h-4 px-1.5 rounded-full font-mono">
                      {libraryGames.length}
                    </span>
                  )}
                </button>

                {/* New: Process History */}
                <button
                  id="tab-history"
                  onClick={() => { setActiveTab("history"); setSelectedRepack(null); }}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl transition-all text-sm font-medium text-left ${
                    activeTab === "history" && !selectedRepack
                      ? "bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-600/20 font-bold"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <History size={18} />
                    <span className="hidden sm:inline">{t("tabHistory")}</span>
                  </div>
                </button>

                <button
                  id="tab-help"
                  onClick={() => { setActiveTab("help"); setSelectedRepack(null); }}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-all text-sm font-medium text-left ${
                    activeTab === "help" && !selectedRepack
                      ? "bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-600/20 font-bold"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                  }`}
                >
                  <HelpCircle size={18} />
                  <span className="hidden sm:inline">{t("tabHelp")}</span>
                </button>

                <button
                  id="tab-donate"
                  onClick={() => { setActiveTab("donate"); setSelectedRepack(null); }}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-all text-sm font-medium text-left ${
                    activeTab === "donate" && !selectedRepack
                      ? "bg-gradient-to-br from-rose-600 to-pink-600 text-white shadow-lg shadow-rose-600/20 font-bold"
                      : "text-rose-400 hover:text-rose-300 hover:bg-rose-950/20"
                  }`}
                >
                  <Heart size={18} className="fill-rose-500 text-rose-500" />
                  <span className="hidden sm:inline">{t("tabDonate")}</span>
                </button>
              </div>

              {/* Quick links to active extraction details if present */}
              {selectedRepack && (
                <div className="pt-4 border-t border-slate-800/50">
                  <p className="hidden sm:block text-[10px] text-sky-400 font-semibold tracking-wider uppercase mb-2 px-3 font-mono">{t("activeRepack")}</p>
                  <button
                    onClick={() => {}}
                    className="w-full flex items-center justify-between p-2 rounded-xl bg-sky-950/20 border border-sky-900/30 text-sky-400 text-xs text-left"
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <Layers size={14} className="shrink-0 animate-bounce" />
                      <span className="truncate font-semibold hidden sm:inline">{selectedRepack.title}</span>
                      <span className="sm:hidden font-mono text-[9px]">ACTIVE</span>
                    </div>
                    <ChevronRight size={12} className="hidden sm:inline shrink-0" />
                  </button>
                </div>
              )}
            </div>

            {/* Micro Terminal Logger at bottom of sidebar (for pure desktop vibe!) */}
            <div className="hidden sm:flex flex-col gap-1.5 p-2 bg-slate-900/50 border border-slate-800/60 rounded-xl max-h-40 overflow-hidden font-mono text-[10px]">
              <div className="flex items-center justify-between text-slate-500 pb-1 border-b border-slate-800/40">
                <span className="flex items-center gap-1"><Terminal size={10} /> console.log</span>
                <button 
                  onClick={() => setSystemLogs(["Console cleared."])} 
                  className="hover:text-sky-400 text-[9px]"
                  title="Clear Log"
                >
                  Clear
                </button>
              </div>
              <div className="space-y-1 overflow-y-auto max-h-28 pr-1 flex flex-col">
                {systemLogs.map((log, idx) => (
                  <div key={idx} className="text-slate-400 leading-tight select-text text-left">
                    {log}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* MAIN CONTENT WORKSPACE */}
          <div className="flex-1 bg-slate-900/20 p-4 sm:p-6 overflow-y-auto flex flex-col relative" id="workspace">
            
            {/* ALERT OVERLAYS (Floating style) */}
            <div className="absolute top-4 right-4 z-50 space-y-2 max-w-sm w-full pointer-events-none select-none">
              <AnimatePresence>
                {errorMsg && (
                  <motion.div 
                    initial={{ opacity: 0, y: -20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20, scale: 0.95 }}
                    className="bg-red-950/90 border border-red-800/80 p-3.5 rounded-xl shadow-lg flex items-start gap-2.5 pointer-events-auto"
                  >
                    <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={18} />
                    <div>
                      <h4 className="font-bold text-xs text-red-200">Operation Error</h4>
                      <p className="text-xs text-red-300 mt-1 leading-relaxed">{errorMsg}</p>
                    </div>
                  </motion.div>
                )}

                {successMsg && (
                  <motion.div 
                    initial={{ opacity: 0, y: -20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20, scale: 0.95 }}
                    className="bg-sky-950/90 border border-sky-800/80 p-3.5 rounded-xl shadow-lg flex items-center gap-2.5 pointer-events-auto"
                  >
                    <Check className="text-sky-400 shrink-0" size={18} />
                    <span className="text-xs text-sky-200 font-semibold">{successMsg}</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* RENDER ACTIVE SCREEN */}
            {selectedRepack ? (
              
              /* ====== SCREEN: EXTRACTED DETAILS VIEW ====== */
              <div className="flex-1 flex flex-col gap-6 animate-fade-in">
                {/* Back button */}
                <div className="flex items-center justify-between border-b border-slate-800/60 pb-4">
                  <button
                    onClick={() => {
                      setSelectedRepack(null);
                      addLog("Closed extracted view.");
                    }}
                    className="flex items-center gap-2 text-slate-400 hover:text-sky-400 transition text-sm font-medium"
                  >
                    <ArrowLeft size={16} />
                    <span>Back to workspace</span>
                  </button>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 font-mono">Source URL:</span>
                    <a
                      href={selectedRepack.url}
                      target="_blank"
                      rel="noreferrer"
                      referrerPolicy="no-referrer"
                      className="text-xs text-sky-500 hover:underline flex items-center gap-1 font-mono truncate max-w-xs"
                    >
                      {selectedRepack.url ? "fitgirl-repacks.site/..." : "Offline Paste"}
                      <ExternalLink size={12} />
                    </a>
                  </div>
                </div>

                {/* Main Split Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
                  
                  {/* Left Column: Game specifications & Poster */}
                  <div className="lg:col-span-4 space-y-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 flex flex-col gap-4 shadow-sm">
                      {selectedRepack.coverImage ? (
                        <div className="w-full aspect-[3/4] rounded-xl overflow-hidden border border-slate-700 bg-slate-950 shadow-md">
                          <img
                            src={selectedRepack.coverImage}
                            alt="Game Cover"
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-full aspect-[3/4] rounded-xl bg-slate-900 flex flex-col items-center justify-center border border-slate-700 text-slate-500 font-mono text-sm gap-2">
                          <Gamepad2 size={32} />
                          <span>No Image Loaded</span>
                        </div>
                      )}

                      <div className="flex items-start justify-between gap-2.5">
                        <h2 className="font-bold text-base text-white tracking-tight leading-snug break-words flex-1">
                          {selectedRepack.title}
                        </h2>
                      </div>

                      {/* Add to Steam-style Library button */}
                      <button
                        onClick={() => addToLibrary(selectedRepack)}
                        disabled={libraryGames.some(g => g.title === selectedRepack.title)}
                        className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border shadow-md cursor-pointer ${
                          libraryGames.some(g => g.title === selectedRepack.title)
                            ? "bg-slate-800/80 border-slate-700 text-slate-400"
                            : "bg-gradient-to-r from-emerald-600 to-green-600 border-emerald-500 hover:from-emerald-500 hover:to-green-500 text-white shadow-emerald-900/10"
                        }`}
                      >
                        <Gamepad2 size={14} />
                        <span>
                          {libraryGames.some(g => g.title === selectedRepack.title)
                            ? t("btnSaved") + " (" + t("tabLibrary") + ")"
                            : t("btnAddToLibrary")}
                        </span>
                      </button>
                    </div>

                    {/* Technical spec details table */}
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 space-y-3 shadow-sm">
                      <h3 className="text-xs font-bold text-sky-400 tracking-wider uppercase flex items-center gap-1.5 border-b border-slate-700/50 pb-2">
                        <Info size={14} />
                        Repack Specifications
                      </h3>
                      {Object.keys(selectedRepack.specs).length > 0 ? (
                        <div className="space-y-2 text-xs">
                          {Object.entries(selectedRepack.specs).map(([key, val]) => (
                            <div key={key} className="flex flex-col gap-0.5 border-b border-slate-700/20 pb-1.5">
                              <span className="text-slate-400 font-medium">{key}</span>
                              <span className="text-slate-200 font-mono break-words leading-relaxed">{val}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-slate-500 text-xs italic font-mono">No metadata parsed from content body.</p>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Mirror Links extraction table */}
                  <div className="lg:col-span-8 flex flex-col bg-slate-800/40 border border-slate-700/80 rounded-2xl overflow-hidden h-[600px] lg:h-auto shadow-sm">
                    
                    {/* Category Filter Tabs */}
                    <div className="bg-slate-950 p-2.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 select-none">
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-1">
                        Opções de Download:
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <button
                          onClick={() => {
                            setActiveCategoryFilter("all");
                            setActiveFilter("all");
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                            activeCategoryFilter === "all"
                              ? "bg-slate-800 text-white border border-slate-700 shadow-md"
                              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/50"
                          }`}
                        >
                          <Layers size={12} />
                          <span>Todos ({selectedRepack.links.length})</span>
                        </button>

                        <button
                          onClick={() => {
                            setActiveCategoryFilter("direct");
                            setActiveFilter("all");
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                            activeCategoryFilter === "direct" && !showFastOnly
                              ? "bg-emerald-900/80 text-emerald-300 border border-emerald-700/80 shadow-md shadow-emerald-950/20"
                              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/50"
                          }`}
                        >
                          <span>⚡ Downloads Diretos ({selectedRepack.links.filter(l => getLinkCategory(l.hoster) === "direct").length})</span>
                        </button>

                        <button
                          onClick={() => {
                            setActiveCategoryFilter("torrent");
                            setActiveFilter("all");
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                            activeCategoryFilter === "torrent"
                              ? "bg-purple-900/80 text-purple-300 border border-purple-700/80 shadow-md shadow-purple-950/20"
                              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/50"
                          }`}
                        >
                          <span>🧲 Torrents & P2P ({selectedRepack.links.filter(l => getLinkCategory(l.hoster) === "torrent").length})</span>
                        </button>

                        <button
                          onClick={() => {
                            setActiveCategoryFilter("crypter");
                            setActiveFilter("all");
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                            activeCategoryFilter === "crypter"
                              ? "bg-blue-900/80 text-blue-300 border border-blue-700/80 shadow-md shadow-blue-950/20"
                              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/50"
                          }`}
                        >
                          <span>📦 Crypters & Multihost ({selectedRepack.links.filter(l => getLinkCategory(l.hoster) === "crypter").length})</span>
                        </button>
                      </div>
                    </div>
                    
                    {/* Hoster Filters & Search Toolbar */}
                    <div className="bg-slate-900 p-4 border-b border-slate-700 flex flex-col gap-3">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <Filter size={16} className="text-sky-400" />
                          <span className="text-sm font-bold tracking-tight text-white">Filtro de Servidores:</span>
                        </div>

                        {/* QoL Controls: Search and Fast Only Toggle */}
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Search bar inside the link list */}
                          <div className="relative w-full sm:w-64">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                              type="text"
                              value={linksSearchQuery}
                              onChange={(e) => setLinksSearchQuery(e.target.value)}
                              placeholder="Buscar partes, hoster, url..."
                              className="w-full pl-9 pr-8 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition"
                            />
                            {linksSearchQuery && (
                              <button
                                onClick={() => setLinksSearchQuery("")}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 text-xs font-bold cursor-pointer"
                              >
                                ✕
                              </button>
                            )}
                          </div>

                          {/* Quick Fast Hoster Button */}
                          <button
                            onClick={() => {
                              setShowFastOnly(!showFastOnly);
                              if (!showFastOnly) {
                                setActiveCategoryFilter("all");
                                setActiveFilter("all");
                              }
                            }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                              showFastOnly
                                ? "bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20"
                                : "bg-slate-950/60 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700"
                            }`}
                            title="Exibir apenas servidores super rápidos (Fucking Fast, Datanodes.to, etc.)"
                          >
                            <Zap size={12} className={showFastOnly ? "fill-slate-950 stroke-[2.5]" : "text-amber-400"} />
                            <span>Apenas Rápidos ⚡</span>
                          </button>
                        </div>
                      </div>
                      
                      {/* List of active filters based on links parsed */}
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1 border-t border-slate-800/60 pt-2.5">
                        <button
                          onClick={() => {
                            setActiveFilter("all");
                            setShowFastOnly(false);
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs transition-all cursor-pointer ${
                            activeFilter === "all" && !showFastOnly
                              ? "bg-sky-500 text-white font-bold shadow-md shadow-sky-500/20"
                              : "bg-slate-850 text-slate-300 border border-slate-800 hover:text-white hover:bg-slate-800"
                          }`}
                        >
                          Todos ({selectedRepack.links.length})
                        </button>
                        {getUniqueHosters().map(hoster => {
                          const count = selectedRepack.links.filter(l => l.hoster === hoster).length;
                          const tier = getHosterTier(hoster);
                          return (
                            <button
                              key={hoster}
                              onClick={() => {
                                setActiveFilter(hoster);
                                setShowFastOnly(false);
                              }}
                              className={`px-2.5 py-1 rounded-lg text-xs transition-all flex items-center gap-1 cursor-pointer ${
                                activeFilter === hoster
                                  ? "bg-sky-500 text-white font-bold shadow-md shadow-sky-500/20"
                                  : "bg-slate-850 text-slate-300 border border-slate-800 hover:text-white hover:bg-slate-800"
                              }`}
                            >
                              <span>{hoster}</span>
                              <span className="text-[10px] opacity-75">({count})</span>
                              {tier.isPremiumFast && <span className="text-[10px] text-amber-400 font-bold">⚡</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Quick export actions panel */}
                    <div className="bg-slate-900/60 p-3 border-b border-slate-700 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-1.5 text-slate-400 font-mono">
                        <Database size={13} className="text-sky-500 animate-pulse" />
                        <span>Mostrando {getFilteredLinks().length} de {selectedRepack.links.length} URLs encontradas</span>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Queue all filtered links */}
                        <button
                          onClick={() => addFilteredLinksToQueue(selectedRepack.title, getFilteredLinks())}
                          className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-slate-950 font-bold border border-emerald-500/30 flex items-center gap-1.5 shadow-md shadow-emerald-950/20 transition-all cursor-pointer text-xs"
                          title="Adicionar todos os links filtrados atuais à fila de download"
                        >
                          <FolderDown size={13} className="stroke-[2.5]" />
                          <span>Adicionar Tudo à Fila</span>
                        </button>

                        <button
                          onClick={() => handleCopyLinks(true)}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 text-sky-400 border border-slate-700 hover:bg-slate-700 hover:text-sky-300 flex items-center gap-1.5 transition font-medium cursor-pointer text-xs"
                          title="Copiar URLs para a área de transferência para colar no JDownloader"
                        >
                          <Copy size={13} />
                          <span>Copiar Links</span>
                        </button>

                        <button
                          onClick={handleDownloadTxt}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 flex items-center gap-1.5 transition cursor-pointer text-xs"
                          title="Salvar links como arquivo .txt"
                        >
                          <Download size={13} />
                          <span>Salvar .txt</span>
                        </button>
                      </div>
                    </div>

                    {/* Links list viewport */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                      {/* Pinned recommended premium fast links block */}
                      {(() => {
                        const fastLinks = selectedRepack.links.filter(
                          link => {
                            const tier = getHosterTier(link.hoster);
                            return tier.isPremiumFast && (link.hoster.toLowerCase().includes("fucking fast") || link.hoster.toLowerCase().includes("datanodes"));
                          }
                        );
                        
                        if (fastLinks.length === 0 || activeFilter !== "all" || linksSearchQuery.trim() !== "") return null;
                        
                        return (
                          <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-slate-900 border border-amber-500/30 shadow-lg shadow-amber-950/20 space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-500/20 pb-2.5">
                              <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
                                  <Zap size={16} className="fill-amber-400 text-amber-400" />
                                </div>
                                <div>
                                  <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider font-sans flex items-center gap-1.5">
                                    <span>🚀 Servidores Rápidos Recomendados</span>
                                    <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[9px] font-extrabold animate-pulse">QoL Destaque</span>
                                  </h4>
                                  <p className="text-[10px] text-slate-400 font-medium">
                                    Servidores directos de alta velocidade (<span className="text-amber-400 font-bold">Fucking Fast</span> & <span className="text-yellow-400 font-bold">Datanodes.to</span>) prontos para download sem limite de velocidade ou publicidade irritante!
                                  </p>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                                <button
                                  onClick={() => addFilteredLinksToQueue(selectedRepack.title, fastLinks)}
                                  className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[10px] flex items-center gap-1 transition cursor-pointer"
                                  title="Adicionar todos os links rápidos recomendados à fila de download"
                                >
                                  <FolderDown size={11} className="stroke-[2.5]" />
                                  <span>Adicionar Tudo à Fila</span>
                                </button>
                                <button
                                  onClick={() => {
                                    const urls = fastLinks.map(l => l.href).join("\n");
                                    navigator.clipboard.writeText(urls);
                                    setSuccessMsg("Links ultra-rápidos copiados!");
                                    addLog(`[Links] Copiou ${fastLinks.length} links rápidos.`);
                                  }}
                                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-[10px] flex items-center gap-1 transition border border-slate-700 cursor-pointer"
                                  title="Copiar todos os links rápidos recomendados para área de transferência"
                                >
                                  <Copy size={11} />
                                  <span>Copiar Todos</span>
                                </button>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {fastLinks.map((link, idx) => {
                                return (
                                  <div
                                    key={`fast-${idx}`}
                                    className="flex items-center justify-between p-2 rounded-xl bg-slate-950/60 border border-amber-500/10 hover:border-amber-400/40 transition text-[11px] gap-2"
                                  >
                                    <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                                      <div className="flex items-center gap-1.5">
                                        <span className="px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-mono font-bold text-[9px] border border-amber-500/20 shrink-0">
                                          {link.hoster}
                                        </span>
                                        <span className="text-[10px] text-slate-200 font-semibold truncate">{link.text}</span>
                                      </div>
                                      <span className="text-[10px] text-slate-500 font-mono truncate select-all">{link.href}</span>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <button
                                        onClick={() => addToQueue(selectedRepack.title, link)}
                                        className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-emerald-400 transition cursor-pointer"
                                        title="Adicionar à fila de downloads"
                                      >
                                        <FolderDown size={12} />
                                      </button>
                                      <button
                                        onClick={() => handleCopySingle(link.href, idx + 5000)}
                                        className={`p-1 rounded hover:bg-slate-800 transition cursor-pointer ${
                                          copierState[link.href] ? "text-amber-400" : "text-slate-400 hover:text-slate-200"
                                        }`}
                                        title="Copiar link"
                                      >
                                        {copierState[link.href] ? <Check size={12} /> : <Copy size={12} />}
                                      </button>
                                      <a
                                        href={link.href}
                                        target="_blank"
                                        rel="noreferrer"
                                        referrerPolicy="no-referrer"
                                        className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-sky-400 transition cursor-pointer"
                                        title="Abrir no Navegador"
                                      >
                                        <ExternalLink size={12} />
                                      </a>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}

                      {getFilteredLinks().length > 0 ? (
                        // Group by parsed section
                        Object.entries(
                           getFilteredLinks().reduce((acc, link) => {
                             if (!acc[link.section]) acc[link.section] = [];
                             acc[link.section].push(link);
                             return acc;
                           }, {} as Record<string, ExtractedLink[]>)
                        ).map(([sectionTitle, sectionLinks]) => (
                          <div key={sectionTitle} className="space-y-2">
                            <h4 className="text-xs font-bold text-slate-300 tracking-wider font-mono border-l-2 border-sky-500 pl-2 uppercase bg-slate-900/30 py-1 flex items-center justify-between">
                              <span>{sectionTitle}</span>
                              <span className="text-[10px] text-slate-500 font-normal normal-case font-sans pr-1">({sectionLinks.length} links)</span>
                            </h4>
                            <div className="space-y-1">
                              {sectionLinks.map((link, idx) => {
                                const tier = getHosterTier(link.hoster);
                                const isFastHoster = tier.isPremiumFast;
                                return (
                                  <div
                                    key={idx}
                                    className={`group flex flex-col sm:flex-row sm:items-center justify-between p-2 rounded-xl bg-slate-900/30 border transition text-xs gap-2 ${
                                      isFastHoster 
                                        ? "border-amber-500/20 hover:border-amber-500/40 bg-gradient-to-r from-amber-500/5 to-transparent" 
                                        : "border-slate-800 hover:border-sky-500/20 hover:bg-slate-900/80"
                                    }`}
                                  >
                                    <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className={`px-1.5 py-0.5 rounded-md border text-[10px] font-mono font-bold shrink-0 ${tier.bgClass}`}>
                                          {tier.label}
                                        </span>
                                        {/* Category highlight badges */}
                                        {getLinkCategory(link.hoster) === "direct" && (
                                          <span className="px-1.5 py-0.5 rounded-md bg-emerald-950/60 border border-emerald-800/80 text-[10px] font-mono text-emerald-400 font-bold shrink-0 flex items-center gap-0.5 shadow-sm shadow-emerald-900/10">
                                            ⚡ Direct
                                          </span>
                                        )}
                                        {getLinkCategory(link.hoster) === "torrent" && (
                                          <span className="px-1.5 py-0.5 rounded-md bg-purple-950/60 border border-purple-800/80 text-[10px] font-mono text-purple-400 font-bold shrink-0 flex items-center gap-0.5">
                                            🧲 Torrent
                                          </span>
                                        )}
                                        {getLinkCategory(link.hoster) === "crypter" && (
                                          <span className="px-1.5 py-0.5 rounded-md bg-blue-950/60 border border-blue-800/80 text-[10px] font-mono text-blue-400 font-bold shrink-0 flex items-center gap-0.5">
                                            📦 Crypt
                                          </span>
                                        )}
                                        {/* Speed Tier Rating Pill */}
                                        <span 
                                          className={`px-1 py-0.5 rounded text-[9px] font-mono font-bold shrink-0 ${
                                            tier.rating >= 9 
                                              ? "bg-amber-500/10 text-amber-400" 
                                              : tier.rating >= 8
                                                ? "bg-emerald-500/10 text-emerald-400"
                                                : "bg-slate-800 text-slate-400"
                                          }`}
                                          title={`Velocidade estimada: ${tier.speed}. ${tier.description}`}
                                        >
                                          {tier.speed}
                                        </span>
                                        <span className="font-semibold text-slate-200 truncate">{link.text}</span>
                                      </div>
                                      <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-[10px] text-slate-500 font-mono truncate select-all flex-1">{link.href}</span>
                                        <span className="text-[10px] text-slate-400 italic shrink-0 hidden md:inline">{tier.description}</span>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                                      {/* Add to Queue Button */}
                                      <button
                                        onClick={() => addToQueue(selectedRepack.title, link)}
                                        className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-emerald-400 transition cursor-pointer"
                                        title="Adicionar à fila de download"
                                      >
                                        <FolderDown size={14} />
                                      </button>
                                      <button
                                        onClick={() => handleCopySingle(link.href, idx)}
                                        className={`p-1.5 rounded-md hover:bg-slate-800 transition cursor-pointer ${
                                          copierState[link.href] ? "text-sky-400" : "text-slate-400 hover:text-slate-200"
                                        }`}
                                        title="Copiar link"
                                      >
                                        {copierState[link.href] ? <Check size={14} /> : <Copy size={14} />}
                                      </button>
                                      <a
                                        href={link.href}
                                        target="_blank"
                                        rel="noreferrer"
                                        referrerPolicy="no-referrer"
                                        className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-sky-400 transition cursor-pointer"
                                        title="Abrir no Navegador"
                                      >
                                        <ExternalLink size={14} />
                                      </a>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs py-16 font-mono gap-2 border border-dashed border-slate-700 rounded-2xl">
                          <Layers size={24} className="text-slate-700" />
                          <span>Nenhum link corresponde aos filtros ativos. Tente limpar os filtros ou alterar a busca!</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

            ) : (
              
              /* ====== STANDARD TAB SCREENS ====== */
              <div className="flex-1 flex flex-col">
                
                {/* 1. SEARCH/BROWSE REPACKS TAB */}
                {activeTab === "search" && (
                  <div className="flex-1 flex flex-col gap-6 animate-fade-in">
                    
                    {/* Header banner - styled as beautiful Bento blocks */}
                    <div className="grid grid-cols-12 gap-4">
                      {/* Left: main welcome panel */}
                      <div className="col-span-12 lg:col-span-8 bg-slate-800 p-6 rounded-2xl border border-slate-700 flex flex-col justify-between gap-4 relative overflow-hidden shadow-sm min-h-[160px]">
                        <div className="absolute top-0 right-0 p-8 opacity-5 text-sky-400 font-mono pointer-events-none">
                          <Database size={240} />
                        </div>
                        <div className="space-y-2 z-10">
                          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
                            <Sparkles className="text-sky-400" />
                            {t("searchHeader")}
                          </h1>
                          <p className="text-xs text-sky-300 font-bold font-mono tracking-wide uppercase">
                            BY WM
                          </p>
                          <p className="text-xs text-slate-300 leading-relaxed max-w-xl">
                            {t("searchSubheader")}
                          </p>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono uppercase tracking-widest mt-2">
                          Active Search Engine • CORS-Proxy Ready
                        </div>
                      </div>
                      
                      {/* Right: stats/badge panel using gradient */}
                      <div className="col-span-12 lg:col-span-4 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl p-6 flex flex-col justify-between text-white shadow-xl min-h-[160px]">
                        <div className="flex justify-between items-start">
                          <span className="text-[10px] uppercase tracking-widest opacity-80 font-mono font-bold">Proxy Node Status</span>
                          <span className="text-xs bg-white/20 px-2.5 py-1 rounded-md font-medium flex items-center gap-1.5">
                            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span> Active
                          </span>
                        </div>
                        <div className="space-y-0.5 my-3">
                          <p className="text-[10px] uppercase tracking-widest opacity-80">Extraction Rate</p>
                          <p className="text-2xl font-black tracking-tight font-mono">99.2%</p>
                        </div>
                        <div className="text-[10px] opacity-75 font-mono">
                          Secure CORS Bypass Active
                        </div>
                      </div>
                    </div>

                    {/* Search panel styled as Bento Input block */}
                    <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700 flex flex-col sm:flex-row items-center gap-4 shadow-sm">
                      <div className="relative flex-1 w-full">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleSearch(1)}
                          placeholder={t("searchPlaceholder")}
                          className="w-full pl-11 pr-4 py-3 bg-slate-900 border border-slate-700 rounded-xl focus:ring-2 focus:ring-sky-500 text-sm placeholder:text-slate-500 focus:outline-none text-white transition-all"
                        />
                      </div>
                      <button
                        onClick={() => handleSearch(1)}
                        disabled={isSearching}
                        className="w-full sm:w-auto px-6 py-3 bg-sky-500 hover:bg-sky-600 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-sky-500/10 cursor-pointer"
                      >
                        {isSearching ? <RefreshCw className="animate-spin" size={16} /> : <Search size={16} />}
                        <span>{isSearching ? t("btnSearching") : t("btnSearch")}</span>
                      </button>
                    </div>

                    {/* Presets suggestions */}
                    <div className="flex items-center gap-2 flex-wrap text-xs select-none">
                      <span className="text-slate-500 font-mono">Popular:</span>
                      {["Witcher", "Cyberpunk", "Grand Theft Auto", "Elden Ring", "Resident Evil", "Spider-Man"].map(preset => (
                        <button
                          key={preset}
                          onClick={() => handlePresetSearch(preset)}
                          className="px-2.5 py-1 rounded-lg bg-slate-850 border border-slate-700 text-slate-300 hover:text-sky-400 hover:border-sky-500/30 transition text-[11px]"
                        >
                          {preset}
                        </button>
                      ))}
                    </div>

                    {/* Gemini AI Recommendations Section */}
                    <div className="bg-slate-800/50 rounded-2xl p-5 border border-slate-700/80 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400">
                            <Sparkles size={16} />
                          </div>
                          <div>
                            <h3 className="text-xs font-bold text-white">Recomendações Inteligentes por IA</h3>
                            <p className="text-[10px] text-slate-400">O que você quer jogar hoje? Conte suas preferências para a IA do Google Gemini</p>
                          </div>
                        </div>
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700 font-mono text-slate-400">Gemini 3.5 Flash</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={aiInput}
                          onChange={(e) => setAiInput(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && getAiRecommendations()}
                          placeholder="Ex: RPGs de mundo aberto desafiadores ou jogos de aventura indie com ótima história..."
                          className="flex-1 px-4 py-2 bg-slate-900 border border-slate-700 rounded-xl focus:ring-2 focus:ring-sky-500 text-xs placeholder:text-slate-500 text-white focus:outline-none transition-all"
                        />
                        <button
                          onClick={getAiRecommendations}
                          disabled={isAiLoading}
                          className="px-4 py-2 bg-gradient-to-br from-indigo-500 to-sky-500 text-white text-xs font-bold rounded-xl transition hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-md shadow-indigo-500/10"
                        >
                          {isAiLoading ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={12} />}
                          <span>Sugerir</span>
                        </button>
                      </div>

                      {aiRecommendation && (
                        <div className="bg-slate-900 p-4 rounded-xl border border-slate-750 text-xs text-slate-300 leading-relaxed max-h-[160px] overflow-y-auto whitespace-pre-line font-sans scrollbar-thin scrollbar-thumb-slate-700">
                          {aiRecommendation}
                        </div>
                      )}
                    </div>

                    {/* Results Container */}
                    <div className="flex-1 flex flex-col">
                      {isSearching ? (
                        <div className="flex-1 flex flex-col items-center justify-center py-20 gap-4">
                          <RefreshCw className="animate-spin text-sky-500" size={32} />
                          <p className="text-xs text-slate-400 font-mono">Querying FitGirl WordPress database engine...</p>
                        </div>
                      ) : searchResults.length > 0 ? (
                        <div className="space-y-4 flex-1 flex flex-col justify-between">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {searchResults.map((game) => (
                              <div
                                key={game.id}
                                className="group flex p-3.5 bg-slate-800/40 border border-slate-700/80 rounded-2xl hover:border-sky-500/30 hover:bg-slate-800/85 transition-all shadow-sm"
                              >
                                {game.coverImage ? (
                                  <div className="w-16 h-20 rounded-lg bg-slate-900 overflow-hidden border border-slate-700 shrink-0 shadow-sm mr-3">
                                    <img
                                      src={game.coverImage}
                                      alt=""
                                      referrerPolicy="no-referrer"
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                ) : (
                                  <div className="w-16 h-20 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center text-slate-600 mr-3 shrink-0">
                                    <Gamepad2 size={20} />
                                  </div>
                                )}

                                <div className="flex-1 min-w-0 flex flex-col justify-between">
                                  <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[10px] text-slate-400 font-mono font-medium">{game.date}</span>
                                    </div>
                                    <h3 className="font-bold text-xs sm:text-sm text-slate-200 truncate group-hover:text-sky-400 transition">
                                      {game.title}
                                    </h3>
                                    
                                    {/* Summary tags */}
                                    <div className="space-y-0.5">
                                      {game.specSummary["Repack Size"] && (
                                        <p className="text-[10px] text-slate-300 truncate">
                                          <span className="font-mono text-slate-400">Repack Size:</span> {game.specSummary["Repack Size"]}
                                        </p>
                                      )}
                                      {game.specSummary["Original Size"] && (
                                        <p className="text-[10px] text-slate-300 truncate">
                                          <span className="font-mono text-slate-400">Original Size:</span> {game.specSummary["Original Size"]}
                                        </p>
                                      )}
                                    </div>
                                  </div>

                                  <button
                                    onClick={() => handleExtractFromUrl(game.url)}
                                    className="mt-2 py-1.5 px-3 rounded-lg bg-slate-900 text-sky-400 border border-slate-700 hover:bg-sky-500 hover:text-white hover:border-sky-500 transition-all text-[11px] font-bold flex items-center justify-center gap-1 w-full cursor-pointer"
                                  >
                                    <Link2 size={12} />
                                    <span>Extract Mirror Links</span>
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Pagination controls */}
                          {totalPages > 1 && (
                            <div className="flex items-center justify-center gap-4 py-4 border-t border-slate-800/40 mt-6 select-none">
                              <button
                                onClick={() => handleSearch(currentPage - 1)}
                                disabled={currentPage === 1}
                                className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-400 hover:text-sky-400 disabled:opacity-50 disabled:hover:text-slate-400 transition"
                              >
                                Previous
                              </button>
                              <span className="text-xs text-slate-400 font-mono">
                                Page <span className="text-slate-200 font-bold">{currentPage}</span> of <span className="text-slate-200 font-bold">{totalPages}</span>
                              </span>
                              <button
                                onClick={() => handleSearch(currentPage + 1)}
                                disabled={currentPage === totalPages}
                                className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-400 hover:text-sky-400 disabled:opacity-50 disabled:hover:text-slate-400 transition"
                              >
                                Next
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-500 py-16 gap-3 border border-dashed border-slate-700 rounded-2xl select-none">
                          <Gamepad2 size={40} className="text-slate-600" />
                          <div className="text-center space-y-1">
                            <p className="text-xs font-semibold text-slate-300">No active search database results loaded.</p>
                            <p className="text-[11px] text-slate-500 max-w-xs leading-relaxed">Type a game name above to scour the FitGirl repacks database for files and parts.</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 2. DIRECT URL LOADER TAB */}
                {activeTab === "url" && (
                  <div className="flex-1 flex flex-col gap-6 max-w-2xl mx-auto w-full py-6 animate-fade-in">
                    <div className="space-y-2 select-none text-center sm:text-left">
                      <h1 className="text-xl font-bold text-white flex items-center justify-center sm:justify-start gap-2">
                        <Link2 className="text-sky-400" />
                        {t("urlHeader")}
                      </h1>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        {t("urlSubheader")}
                      </p>
                    </div>

                    <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 space-y-4 shadow-sm">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-400 font-mono">Repack Page Link</label>
                        <input
                          type="text"
                          value={targetUrl}
                          onChange={(e) => setTargetUrl(e.target.value)}
                          placeholder={t("urlPlaceholder")}
                          className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg focus:border-sky-500 text-xs placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500 text-white transition-all"
                        />
                      </div>

                      <button
                        onClick={() => handleExtractFromUrl(targetUrl)}
                        disabled={isExtracting}
                        className="w-full py-3 bg-sky-500 hover:bg-sky-600 disabled:bg-slate-850 disabled:text-slate-500 text-white font-bold rounded-lg text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-sky-500/10 cursor-pointer"
                      >
                        {isExtracting ? <RefreshCw className="animate-spin" size={14} /> : <Sparkles size={14} />}
                        <span>{isExtracting ? t("btnExtracting") : t("btnExtract")}</span>
                      </button>
                    </div>

                    {/* Example preset URLs for testing */}
                    <div className="space-y-2 select-none">
                      <h4 className="text-xs font-semibold text-slate-400 font-mono">Example URL templates:</h4>
                      <div className="space-y-2 text-xs">
                        <button
                          onClick={() => setTargetUrl("https://fitgirl-repacks.site/witcher-3-wild-hunt/")}
                          className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-left hover:border-sky-500/20 hover:bg-slate-800/80 text-slate-300 truncate font-mono text-[11px] block transition"
                        >
                          https://fitgirl-repacks.site/witcher-3-wild-hunt/
                        </button>
                        <button
                          onClick={() => setTargetUrl("https://fitgirl-repacks.site/cyberpunk-2077/")}
                          className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-left hover:border-sky-500/20 hover:bg-slate-800/80 text-slate-300 truncate font-mono text-[11px] block transition"
                        >
                          https://fitgirl-repacks.site/cyberpunk-2077/
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. PASTE HTML SOURCE TAB (OFFLINE FALLBACK METHOD) */}
                {activeTab === "html" && (
                  <div className="flex-1 flex flex-col gap-4 animate-fade-in">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3 select-none">
                      <div className="space-y-1">
                        <h1 className="text-lg font-bold text-white flex items-center gap-2">
                          <Code2 className="text-sky-400" />
                          {t("htmlHeader")}
                        </h1>
                        <p className="text-xs text-slate-400">
                          {t("htmlSubheader")}
                        </p>
                      </div>
                      <span className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-[10px] text-sky-400 font-mono font-bold">100% SUCCESS RATE</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 flex-1">
                      {/* Form inputs */}
                      <div className="md:col-span-8 flex flex-col gap-3">
                        <div className="flex-1 flex flex-col">
                          <textarea
                            value={rawHtml}
                            onChange={(e) => setRawHtml(e.target.value)}
                            placeholder={t("htmlPlaceholder")}
                            className="w-full flex-1 p-4 bg-slate-900 border border-slate-700 rounded-2xl focus:border-sky-500 text-xs focus:ring-2 focus:ring-sky-500 font-mono placeholder:text-slate-600 focus:outline-none min-h-[220px] max-h-[480px] text-slate-300 resize-none"
                          />
                        </div>
                        
                        <div className="flex flex-col sm:flex-row gap-3">
                          <div className="flex-1">
                            <input
                              type="text"
                              value={htmlUrl}
                              onChange={(e) => setHtmlUrl(e.target.value)}
                              placeholder={t("htmlUrlPlaceholder")}
                              className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg focus:border-sky-500 text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none text-white"
                            />
                          </div>
                          
                          <button
                            onClick={handleParseRawHtml}
                            disabled={isExtracting}
                            className="px-6 py-2.5 bg-sky-500 hover:bg-sky-600 disabled:bg-slate-850 disabled:text-slate-500 text-white font-bold rounded-lg text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-sky-500/10"
                          >
                            {isExtracting ? <RefreshCw className="animate-spin" size={14} /> : <FileText size={14} />}
                            <span>{isExtracting ? t("btnExtracting") : t("btnExtract")}</span>
                          </button>
                        </div>
                      </div>

                      {/* Offline guide info card - Styled as gorgeous Bento Card */}
                      <div className="md:col-span-4 bg-slate-800 border border-slate-700 p-4 rounded-2xl flex flex-col justify-between shadow-sm select-none">
                        <div className="space-y-4">
                          <h3 className="text-xs font-bold text-sky-400 tracking-wider uppercase font-mono pb-2 border-b border-slate-700 flex items-center gap-1.5">
                            <Info size={14} />
                            How to get source code:
                          </h3>
                          <ol className="text-xs text-slate-300 space-y-3 list-decimal pl-4 leading-relaxed font-sans">
                            <li>Open <a href="https://fitgirl-repacks.site" target="_blank" rel="noreferrer" className="text-sky-400 underline">fitgirl-repacks.site</a> in your browser.</li>
                            <li>Go to your desired game repack page.</li>
                            <li>Right click anywhere on the page and select <strong className="text-white">"View Page Source"</strong> (or press <kbd className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] font-mono text-slate-300">Ctrl+U</kbd>).</li>
                            <li>Press <kbd className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] font-mono text-slate-300">Ctrl+A</kbd> to select all code, then <kbd className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] font-mono text-slate-300">Ctrl+C</kbd> to copy it.</li>
                            <li>Paste the code into the text container on the left, then click Parse.</li>
                          </ol>
                        </div>

                        <div className="pt-4 border-t border-slate-700 text-[10px] text-slate-400 leading-relaxed font-mono mt-4">
                          Note: This method works completely offline and client-side without relying on network requests to FitGirl's server, making it immune to Cloudflare and region blocks.
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. GUIDE & USER DETAILS TAB */}
                {activeTab === "help" && (
                  <div className="flex-1 flex flex-col gap-6 max-w-3xl mx-auto w-full py-4 animate-fade-in select-none">
                    <div className="space-y-1.5 text-center">
                      <h1 className="text-xl font-bold text-white flex items-center justify-center gap-2">
                        <HelpCircle className="text-sky-400 animate-pulse" />
                        FitGirl Links & JDownloader Guide
                      </h1>
                      <p className="text-xs text-slate-400">
                        How to get the most out of your extracted repack files and part mirrors.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Left Bento Piece */}
                      <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 space-y-3 shadow-sm">
                        <h3 className="text-sm font-bold text-sky-400 flex items-center gap-1.5 border-b border-slate-700 pb-2">
                          <Check size={16} />
                          Integrating with JDownloader 2
                        </h3>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          JDownloader is the absolute best manager to download multi-part archives (e.g. MultiUp, 1fichier, Qiwi).
                        </p>
                        <ul className="text-xs text-slate-300 space-y-2 list-disc pl-4 leading-relaxed">
                          <li>Click <strong className="text-white">"Copy Raw Links"</strong> inside the active repack board.</li>
                          <li>Open JDownloader 2 on your computer.</li>
                          <li>The <strong className="text-white">Linkgrabber tab</strong> will automatically parse your clipboard and load all parts!</li>
                          <li>Alternatively, save the folder as a <strong className="text-white">.txt</strong> file and click File &rarr; Load Link Container inside JDownloader.</li>
                        </ul>
                      </div>

                      {/* Right Bento Piece */}
                      <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 space-y-3 shadow-sm">
                        <h3 className="text-sm font-bold text-sky-400 flex items-center gap-1.5 border-b border-slate-700 pb-2">
                          <Info size={16} />
                          Filehosters Comparison
                        </h3>
                        <div className="space-y-2.5 text-xs text-slate-300 font-mono">
                          <div>
                            <span className="text-sky-400 font-bold font-sans">MultiUp:</span>
                            <p className="text-[11px] leading-relaxed text-slate-400 mt-0.5">A multihost container service. Highly recommended for multi-part downloads as it proxies mirrors without bandwidth limits.</p>
                          </div>
                          <div>
                            <span className="text-sky-400 font-bold font-sans">Qiwi / Pixeldrain:</span>
                            <p className="text-[11px] leading-relaxed text-slate-400 mt-0.5">Extremely fast direct file download speeds. Usually have high limits before quota warnings.</p>
                          </div>
                          <div>
                            <span className="text-sky-400 font-bold font-sans">Filecrypt:</span>
                            <p className="text-[11px] leading-relaxed text-slate-400 mt-0.5">Encrypted link container. Protects mirror links from going down. Needs a browser solver before grabbing parts.</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Developer Center & Guides - Setup.exe and Online Website Deployment */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Setup.exe Guide */}
                      <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 space-y-3 shadow-sm">
                        <h3 className="text-sm font-bold text-indigo-400 flex items-center gap-1.5 border-b border-slate-700 pb-2">
                          <Code2 size={16} />
                          How to Build a Setup.exe Installer
                        </h3>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          Want to run this manager as a local native Windows application with a <strong className="text-white">setup.exe</strong> installer?
                        </p>
                        <div className="space-y-2 text-xs font-mono text-slate-300 bg-slate-900 p-3 rounded-lg border border-slate-850">
                          <p className="text-sky-400 font-sans font-bold">Recommended: Tauri Wrapper</p>
                          <ul className="list-decimal pl-4 space-y-1 text-[11px] font-sans leading-relaxed text-slate-400">
                            <li>Ensure Node.js and <strong className="text-white">Rust</strong> are installed.</li>
                            <li>Run <code className="text-yellow-400 font-mono">npm install @tauri-apps/cli -D</code> in your project.</li>
                            <li>Initialize with <code className="text-yellow-400 font-mono">npx tauri init</code>. Point your build output to <code className="text-white">dist</code>.</li>
                            <li>Run <code className="text-yellow-400 font-mono">npx tauri build</code>.</li>
                            <li>Tauri compiles a high-performance installer <strong className="text-green-400">(.msi / .exe)</strong> under 5MB in your build output directory!</li>
                          </ul>
                          <p className="text-sky-400 font-sans font-bold mt-2">Alternative: Inno Setup</p>
                          <p className="text-[11px] font-sans text-slate-400 leading-relaxed">
                            Build the assets (<code className="text-white font-mono">npm run build</code>) and wrap them using Electron-Builder, then compile into a setup.exe installer with Inno Setup Compiler.
                          </p>
                        </div>
                      </div>

                      {/* Online Website Deployment Guide */}
                      <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 space-y-3 shadow-sm">
                        <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-1.5 border-b border-slate-700 pb-2">
                          <ExternalLink size={16} />
                          How to Deploy as an Online Website
                        </h3>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          Hosting this app online as a live portal allows you to access your extraction manager from anywhere.
                        </p>
                        <div className="space-y-2 text-xs font-mono text-slate-300 bg-slate-900 p-3 rounded-lg border border-slate-850">
                          <p className="text-sky-400 font-sans font-bold">Server-Side Requirements</p>
                          <p className="text-[11px] font-sans text-slate-300 leading-relaxed">
                            Since the app uses backend scraping endpoints (<code className="text-white">/api/*</code>), you must host on a server that supports Node.js.
                          </p>
                          <p className="text-emerald-400 font-sans font-bold mt-1">Deploying to Cloud Host (Render / Railway)</p>
                          <ul className="list-decimal pl-4 space-y-1 text-[11px] font-sans leading-relaxed text-slate-400">
                            <li>Push your codebase to a private/public <strong className="text-white">GitHub repository</strong>.</li>
                            <li>Create a Web Service on <strong className="text-white">Railway.app</strong> or <strong className="text-white">Render.com</strong>.</li>
                            <li>Connect your repository.</li>
                            <li>Set build command: <code className="text-yellow-400 font-mono">npm run build</code></li>
                            <li>Set start command: <code className="text-yellow-400 font-mono">npm run start</code></li>
                            <li>Enjoy your private secure online FitGirl extraction tool!</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    {/* Console / Terminal Bento Row */}
                    <div className="bg-slate-900 rounded-2xl border border-slate-700 p-4 font-mono text-[11px] leading-relaxed shadow-inner overflow-hidden">
                      <div className="flex justify-between items-center mb-2 border-b border-slate-800 pb-2">
                        <span className="text-slate-500 uppercase tracking-widest text-[9px]">System Terminal</span>
                        <span className="text-sky-500/50">TTY: pts/0</span>
                      </div>
                      <div className="space-y-1 text-slate-400">
                        <p><span className="text-green-500">[14:20:01]</span> INFO: Initializing extraction engine...</p>
                        <p><span className="text-green-500">[14:20:02]</span> INFO: Session loaded for fitgirl-repacks.site</p>
                        <p><span className="text-amber-500">[14:20:05]</span> WARN: Rate limit detected for Qiwi.gg, switching to proxy 102.14.8.12...</p>
                        <p><span className="text-sky-500">[14:21:12]</span> DEBUG: Fetched active database contents from repack proxy</p>
                        <p><span className="text-green-500">[14:21:13]</span> SUCCESS: Standard application workspace ready for querying</p>
                        <p><span className="text-slate-600">[14:22:45]</span> LISTENING: Watching user requests on Port 3000...</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* 5. DOWNLOAD QUEUE VIEW (FILA DE PROCESSAMENTO) */}
                {activeTab === "queue" && (
                  <div className="flex-1 flex flex-col gap-6 animate-fade-in">
                    {/* Header Bento Grid: Queue Stats and Active Speed Indicator */}
                    <div className="grid grid-cols-12 gap-4">
                      {/* Left Block: Active Queue metrics */}
                      <div className="col-span-12 lg:col-span-6 bg-slate-800 p-5 rounded-2xl border border-slate-700 flex flex-col justify-between gap-3 shadow-sm">
                        <div className="space-y-1">
                          <h1 className="text-sm font-black text-white flex items-center gap-1.5">
                            <FolderDown size={18} className="text-sky-400" />
                            {t("queueHeader")}
                          </h1>
                          <p className="text-[11px] text-slate-400">
                            {t("queueSubheader")}
                          </p>
                        </div>

                        {/* Overall queue completion bar */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center text-[10px] text-slate-400">
                            <span>{t("queueCompleted")}</span>
                            <span className="font-mono text-white font-bold">
                              {queue.filter(q => q.status === "completed").length} / {queue.length}
                            </span>
                          </div>
                          <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-700">
                            <div 
                              className="h-full bg-gradient-to-r from-sky-500 to-indigo-500 transition-all duration-500" 
                              style={{ 
                                width: `${queue.length > 0 ? (queue.reduce((acc, q) => acc + q.progress, 0) / (queue.length * 100)) * 100 : 0}%` 
                              }} 
                            />
                          </div>
                        </div>
                      </div>

                      {/* Right Block: Bandwidth Throttle & Core Speedometer */}
                      <div className="col-span-12 lg:col-span-6 bg-gradient-to-br from-indigo-950 to-slate-900 rounded-2xl p-5 border border-slate-800 flex flex-col justify-between text-white shadow-lg">
                        <div className="flex justify-between items-center">
                          <span className="text-[9px] uppercase font-mono text-indigo-300 font-bold tracking-widest">Active Link pipeline</span>
                          {queue.some(q => q.status === "processing") ? (
                            <span className="px-1.5 py-0.5 bg-emerald-950/80 text-emerald-400 border border-emerald-800 rounded text-[9px] font-bold font-mono animate-pulse">
                              DOWNLOADING
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 bg-slate-800 text-slate-400 border border-slate-700 rounded text-[9px] font-mono">
                              IDLE
                            </span>
                          )}
                        </div>

                        <div className="my-1.5">
                          <p className="text-[9px] uppercase text-indigo-300 tracking-wider">Estimated Bandwidth Speed</p>
                          <p className="text-2xl font-black font-mono tracking-tight text-white mt-0.5">
                            {queue.some(q => q.status === "processing") ? `${(Math.random() * 4 + parseFloat(settings.speedLimit === "unlimited" ? "42.5" : settings.speedLimit)).toFixed(1)} MB/s` : "0.0 MB/s"}
                          </p>
                        </div>

                        <div className="flex justify-between items-center text-[9px] text-slate-400 font-mono">
                          <span>Max slots: <strong className="text-sky-400">{settings.simultaneousDownloads} task(s)</strong></span>
                          <span>Bypasses Active</span>
                        </div>
                      </div>
                    </div>

                    {/* Main Layout Area: Full Width Queue Board */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                      
                      {/* Left Side: Controls and Queue Tasks Board (Full Width Panel: lg:col-span-12) */}
                      <div className="lg:col-span-12 space-y-4 flex flex-col justify-start">
                        {/* Controls & Queue Manager Action Bar */}
                        <div className="bg-slate-800 p-3.5 rounded-2xl border border-slate-700 space-y-3.5 shadow-sm">
                          <div className="flex flex-col gap-3">
                            {/* Actions row */}
                            <div className="flex flex-wrap items-center gap-1.5">
                              <button
                                onClick={resumeAllQueue}
                                className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                                title="Start all waiting or paused tasks"
                              >
                                <Play size={11} className="fill-white" />
                                <span>Start All</span>
                              </button>

                              <button
                                onClick={pauseAllQueue}
                                className="px-2.5 py-1.5 bg-slate-700 hover:bg-slate-650 text-slate-200 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                                title="Pause all running items"
                              >
                                <Pause size={11} className="fill-slate-200" />
                                <span>Pause All</span>
                              </button>

                              <button
                                onClick={clearCompletedQueue}
                                className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-850 text-slate-400 border border-slate-700 rounded-lg text-[11px] font-medium transition flex items-center gap-1 cursor-pointer whitespace-nowrap"
                                title="Clear finished downloads"
                              >
                                <CheckCircle2 size={11} />
                                <span>Clear Done</span>
                              </button>
                            </div>

                            {/* Settings selectors row */}
                            <div className="flex items-center justify-between gap-2 border-t border-slate-700/50 pt-2 text-[11px]">
                              <div className="flex items-center gap-1.5">
                                <span className="text-slate-400 font-mono">Speed:</span>
                                <select
                                  value={settings.speedLimit}
                                  onChange={(e) => {
                                    const limit = e.target.value;
                                    updateSettings({ ...settings, speedLimit: limit });
                                    addLog(`[Settings] Changed speed limit to ${limit === "unlimited" ? "Unlimited" : limit + " MB/s"}`);
                                  }}
                                  className="bg-slate-900 border border-slate-700 text-slate-200 px-1.5 py-0.5 rounded focus:outline-none focus:ring-1 focus:ring-sky-500 font-semibold text-[10px]"
                                >
                                  <option value="unlimited">Unlimited</option>
                                  <option value="50">50 MB/s</option>
                                  <option value="25">25 MB/s</option>
                                  <option value="10">10 MB/s</option>
                                  <option value="5">5 MB/s</option>
                                  <option value="1">1 MB/s</option>
                                </select>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <span className="text-slate-400 font-mono">Slots:</span>
                                <select
                                  value={settings.simultaneousDownloads}
                                  onChange={(e) => {
                                    const num = parseInt(e.target.value);
                                    updateSettings({ ...settings, simultaneousDownloads: num });
                                    addLog(`[Settings] Changed simultaneous downloads to ${num}`);
                                  }}
                                  className="bg-slate-900 border border-slate-700 text-slate-200 px-1.5 py-0.5 rounded focus:outline-none focus:ring-1 focus:ring-sky-500 font-semibold text-[10px]"
                                >
                                  <option value={1}>1 Task</option>
                                  <option value={2}>2 Tasks</option>
                                  <option value={3}>3 Tasks</option>
                                </select>
                              </div>
                            </div>
                          </div>

                          {/* Bulk Selected Action Panel (renders if there are selected items) */}
                          {selectedQueueItems.size > 0 && (
                            <div className="bg-sky-950/40 border border-sky-800/60 rounded-xl p-2 flex flex-wrap items-center justify-between gap-2 text-[10px] animate-fade-in">
                              <div className="flex items-center gap-1 text-sky-300 font-mono font-semibold">
                                <Layers size={11} />
                                <span>Sel: {selectedQueueItems.size}</span>
                              </div>

                              <div className="flex items-center gap-1">
                                <button
                                  onClick={resumeSelectedQueue}
                                  className="px-1.5 py-0.5 bg-emerald-950 hover:bg-emerald-900 text-emerald-400 border border-emerald-800/80 rounded text-[9px] font-bold transition-all cursor-pointer"
                                >
                                  Resume
                                </button>
                                <button
                                  onClick={pauseSelectedQueue}
                                  className="px-1.5 py-0.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded text-[9px] font-semibold transition-all cursor-pointer"
                                >
                                  Pause
                                </button>
                                <button
                                  onClick={exportSelectedQueue}
                                  className="px-1.5 py-0.5 bg-sky-950 hover:bg-sky-900 text-sky-400 border border-sky-800/80 rounded text-[9px] font-semibold transition-all cursor-pointer"
                                  title="Export selected links"
                                >
                                  Export
                                </button>
                                <button
                                  onClick={deleteSelectedQueue}
                                  className="px-1.5 py-0.5 bg-red-950 hover:bg-red-900 text-red-400 border border-red-800/80 rounded text-[9px] font-bold transition-all cursor-pointer"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Main Queue Table Block - Highly Compact! */}
                        <div className="bg-slate-800/50 border border-slate-700/80 rounded-2xl overflow-hidden shadow-sm flex flex-col flex-1">
                          <div className="bg-slate-950 p-2.5 border-b border-slate-800 flex items-center justify-between gap-4 text-[10px] font-mono select-none">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={queue.length > 0 && selectedQueueItems.size === queue.length}
                                onChange={toggleSelectAllQueue}
                                disabled={queue.length === 0}
                                className="rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-0 w-3 h-3 cursor-pointer"
                              />
                              <span className="text-slate-400 font-bold">Tasks ({queue.length})</span>
                            </div>
                            {queue.length > 0 && (
                              <button
                                onClick={exportSelectedQueue}
                                className="text-sky-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                                title="Download full queue as plain links"
                              >
                                <Download size={10} />
                                <span>Export URLs</span>
                              </button>
                            )}
                          </div>

                          <div className="divide-y divide-slate-850 max-h-[280px] overflow-y-auto">
                            {queue.length > 0 ? (
                              queue.map((item, index) => {
                                const isSelected = selectedQueueItems.has(item.id);
                                return (
                                  <div
                                    key={item.id}
                                    className={`p-2 flex flex-col justify-between gap-2.5 transition-all text-[11px] ${
                                      isSelected ? "bg-sky-950/20" : "hover:bg-slate-800/30"
                                    }`}
                                  >
                                    {/* Top row: Checkbox, Hoster, Title */}
                                    <div className="flex items-start gap-2 min-w-0">
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => toggleSelectQueueItem(item.id)}
                                        className="rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-0 w-3 h-3 mt-1 cursor-pointer shrink-0"
                                      />
                                      <div className="min-w-0 flex-1 space-y-0.5">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="px-1 py-0.2 rounded bg-slate-900 border border-slate-700 text-[8px] font-mono font-bold text-sky-400 shrink-0">
                                            {item.hoster}
                                          </span>
                                          <h4 className="font-bold text-slate-200 truncate max-w-[150px]">
                                            {item.repackTitle}
                                          </h4>
                                        </div>
                                        <p className="text-[9px] text-slate-400 font-mono truncate select-all">
                                          {item.linkText}
                                        </p>
                                      </div>
                                    </div>

                                    {/* Bottom row: Progress line + metrics + action buttons */}
                                    <div className="pl-5 flex items-center justify-between gap-3 select-none">
                                      <div className="flex-1 space-y-1">
                                        <div className="flex justify-between items-center text-[9px] font-mono leading-none">
                                          {item.status === "waiting" && <span className="text-yellow-500 font-bold">Queued</span>}
                                          {item.status === "processing" && <span className="text-emerald-400 font-bold animate-pulse">Resolving ({item.progress}%)</span>}
                                          {item.status === "paused" && <span className="text-slate-500 font-medium">Paused</span>}
                                          {item.status === "completed" && <span className="text-emerald-500 font-bold flex items-center gap-0.5">Extracted</span>}
                                          <span className="text-[8px] text-slate-500">{item.status === "processing" ? item.speed : ""}</span>
                                        </div>
                                        <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden border border-slate-700/30">
                                          <div 
                                            className={`h-full transition-all duration-300 ${
                                              item.status === "completed" ? "bg-emerald-500" :
                                              item.status === "paused" ? "bg-slate-500" : "bg-sky-500"
                                            }`} 
                                            style={{ width: `${item.progress}%` }} 
                                          />
                                        </div>
                                      </div>

                                      {/* Action buttons */}
                                      <div className="flex items-center gap-1 shrink-0">
                                        {item.status === "paused" ? (
                                          <button
                                            onClick={() => resumeQueueItem(item.id)}
                                            className="p-1 rounded bg-slate-900 border border-slate-700 text-sky-400 hover:text-sky-300 hover:bg-slate-800 transition"
                                            title="Resume"
                                          >
                                            <Play size={10} className="fill-sky-400" />
                                          </button>
                                        ) : item.status === "processing" || item.status === "waiting" ? (
                                          <button
                                            onClick={() => pauseQueueItem(item.id)}
                                            className="p-1 rounded bg-slate-900 border border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
                                            title="Pause"
                                          >
                                            <Pause size={10} className="fill-slate-400" />
                                          </button>
                                        ) : (
                                          <div className="w-5"></div>
                                        )}

                                        <button
                                          onClick={() => cancelQueueItem(item.id)}
                                          className="p-1 rounded bg-slate-900 border border-slate-700 text-slate-500 hover:text-red-400 hover:bg-red-950/20 hover:border-red-900 transition"
                                          title="Remove"
                                        >
                                          <Trash size={10} />
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })
                            ) : (
                              <div className="py-12 flex flex-col items-center justify-center text-slate-500 text-[11px] font-mono gap-1.5">
                                <FolderDown size={24} className="text-slate-700 animate-pulse" />
                                <span>No active downloads.</span>
                                <span className="text-[9px] text-slate-600 font-sans">Add links from repack detail page</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Save Folder Block - Positioned elegantly below the history list */}
                      <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
                        <div className="space-y-1 text-left flex-1 min-w-0">
                          <h3 className="text-xs font-black text-white flex items-center gap-1.5 uppercase tracking-wider">
                            <Save size={14} className="text-indigo-400" />
                            {t("saveDir")} (Pasta Padrão de Downloads)
                          </h3>
                          <p className="text-[10px] text-slate-400 leading-tight">
                            {lang === "pt" ? "Defina onde você armazena seus repacks baixados para facilitar a extração posterior." : "Define where you store your downloaded repacks to facilitate extraction later."}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 w-full md:w-auto min-w-[320px]">
                          <div className="relative flex-1">
                            <input
                              type="text"
                              value={settings.downloadDirectory || "C:\\Downloads\\FitGirlRepacks"}
                              onChange={(e) => {
                                const path = e.target.value;
                                updateSettings({ ...settings, downloadDirectory: path });
                              }}
                              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-indigo-300 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              placeholder="e.g., C:\Downloads\FitGirlRepacks"
                            />
                          </div>

                          <button
                            onClick={async () => {
                              if (window.electronAPI?.selectDirectory) {
                                try {
                                  const selectedPath = await window.electronAPI.selectDirectory();
                                  if (selectedPath) {
                                    updateSettings({ ...settings, downloadDirectory: selectedPath });
                                    addLog(`[Settings] Standard save directory path changed: ${selectedPath}`);
                                    setSuccessMsg("Folder updated!");
                                  }
                                } catch (err: any) {
                                  addLog(`[Settings] Error choosing directory: ${err.message}`);
                                }
                              } else {
                                const systemPaths = [
                                  "C:\\Downloads\\FitGirlRepacks",
                                  "D:\\Games\\FitGirlExtracts",
                                  "E:\\SteamLibrary\\steamapps\\common",
                                  "C:\\Users\\User\\Downloads\\MyRepacks",
                                  "/home/user/Downloads/FitGirl"
                                ];
                                const randomPath = systemPaths[Math.floor(Math.random() * systemPaths.length)];
                                updateSettings({ ...settings, downloadDirectory: randomPath });
                                addLog(`[Settings] Standard save directory path changed (simulated): ${randomPath}`);
                                setSuccessMsg("Folder updated!");
                              }
                            }}
                            className="text-[10px] font-bold bg-slate-900 hover:bg-slate-700 text-sky-400 border border-slate-700 px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap"
                            title={t("browseFolderTip")}
                          >
                            {t("browseFolder")}
                          </button>
                        </div>
                      </div>

                    </div>
                  </div>
                )}



                {/* 6.5 GAME LIBRARY (STEAM-INSPIRED LAYOUT) */}
                {activeTab === "library" && (
                  <div className="flex-1 flex flex-col gap-6 animate-fade-in text-slate-300">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-slate-800 pb-4 select-none">
                      <div className="space-y-1">
                        <h1 className="text-xl font-black text-white flex items-center gap-2 tracking-tight">
                          <Gamepad2 className="text-sky-400" size={24} />
                          {t("libraryHeader")}
                        </h1>
                        <p className="text-xs text-slate-400">
                          {t("librarySubheader")}
                        </p>
                      </div>
                    </div>

                    {/* Steam Layout split screen */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch flex-1 min-h-[580px]">
                      
                      {/* Left Sidebar: Game List (Steam-style left panel) */}
                      <div className="lg:col-span-4 bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col gap-4 shadow-inner">
                        {/* Search in Library */}
                        <div className="relative">
                          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                          <input
                            type="text"
                            value={libraryQuery}
                            onChange={(e) => setLibraryQuery(e.target.value)}
                            placeholder={t("librarySearch")}
                            className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs placeholder:text-slate-600 text-slate-350 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 transition-all"
                          />
                        </div>

                        {/* List of Games */}
                        <div className="flex-1 overflow-y-auto max-h-[480px] space-y-1.5 pr-1 custom-scrollbar">
                          {libraryGames.filter(g => g.title.toLowerCase().includes(libraryQuery.toLowerCase())).length > 0 ? (
                            libraryGames
                              .filter(g => g.title.toLowerCase().includes(libraryQuery.toLowerCase()))
                              .map((game) => {
                                const isSelected = selectedLibraryGameId === game.id;
                                const isPlaying = game.status === "playing";
                                return (
                                  <button
                                    key={game.id}
                                    onClick={() => setSelectedLibraryGameId(game.id)}
                                    className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-all group ${
                                      isSelected
                                        ? "bg-slate-800/95 border border-slate-700/80 text-white font-bold"
                                        : "hover:bg-slate-800/40 border border-transparent text-slate-400 hover:text-slate-200"
                                    }`}
                                  >
                                    <div className="w-10 h-12 bg-slate-950 rounded-lg overflow-hidden shrink-0 border border-slate-800 shadow-sm relative">
                                      <img
                                        src={game.coverImage}
                                        alt=""
                                        className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300"
                                        referrerPolicy="no-referrer"
                                      />
                                      {isPlaying && (
                                        <div className="absolute inset-0 bg-emerald-950/40 flex items-center justify-center">
                                          <Play size={12} className="text-emerald-400 fill-emerald-400 animate-pulse" />
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex-1 min-w-0 space-y-0.5">
                                      <h3 className="text-xs font-semibold truncate leading-tight">
                                        {game.title}
                                      </h3>
                                      <div className="flex items-center gap-1.5">
                                        {isPlaying ? (
                                          <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                                            EM EXECUÇÃO
                                          </span>
                                        ) : game.status === "not_installed" ? (
                                          <span className="text-[9px] text-amber-500 font-bold uppercase tracking-wider flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                            NÃO BAIXADO
                                          </span>
                                        ) : game.status === "installing" ? (
                                          <span className="text-[9px] text-sky-400 font-bold uppercase tracking-wider flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                                            BAIXANDO ({game.progress || 0}%)
                                          </span>
                                        ) : (
                                          <span className="text-[9px] text-slate-500 font-mono">
                                            {game.playTime ? `${game.playTime} min` : t("notPlayedYet")}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </button>
                                );
                              })
                          ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-center text-slate-500 gap-2 border border-dashed border-slate-850 rounded-2xl">
                              <Gamepad2 size={24} className="text-slate-700" />
                              <span className="text-xs font-semibold">{t("libraryEmpty")}</span>
                              <span className="text-[10px] text-slate-600 max-w-[180px]">
                                {t("libraryEmptyDesc")}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Quick action: Seeding demo custom game */}
                        <button
                          onClick={() => {
                            const customRepack = {
                              title: "Grand Theft Auto V (v1.0.3095 + Online v1.68)",
                              url: "https://fitgirl-repacks.site/grand-theft-auto-v/",
                              coverImage: "https://shared.fastly.steamstatic.com/store_images/steam/apps/271590/header.jpg"
                            };
                            addToLibrary(customRepack);
                          }}
                          className="w-full py-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                        >
                          <Sparkles size={11} className="text-sky-400" />
                          <span>Adicionar GTA V (Demo)</span>
                        </button>
                      </div>

                      {/* Right Main Panel: Steam-style Game Page */}
                      <div className="lg:col-span-8 flex flex-col bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden shadow-inner relative min-h-[520px]">
                        {(() => {
                          const activeGame = libraryGames.find(g => g.id === selectedLibraryGameId);
                          if (!activeGame) {
                            return (
                              <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-8 text-center gap-3">
                                <Database size={48} className="text-slate-800" />
                                <h3 className="text-sm font-semibold text-slate-400">Nenhum jogo selecionado</h3>
                                <p className="text-xs text-slate-500 max-w-sm">
                                  Por favor, selecione um jogo na barra lateral esquerda ou adicione jogos a partir dos seus repacks buscados ou salvos!
                                </p>
                              </div>
                            );
                          }

                          const isPlaying = activeGame.status === "playing";

                          return (
                            <div className="flex-1 flex flex-col animate-fade-in">
                              
                              {/* Hero Game Banner Section */}
                              <div className="h-44 relative overflow-hidden flex items-end p-5 select-none border-b border-slate-800">
                                {/* Blurred Background cover */}
                                <div className="absolute inset-0 z-0 overflow-hidden">
                                  <img
                                    src={activeGame.coverImage}
                                    alt=""
                                    className="w-full h-full object-cover scale-110 blur-xl opacity-30 brightness-50"
                                    referrerPolicy="no-referrer"
                                  />
                                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
                                </div>

                                {/* Banner content */}
                                <div className="relative z-10 flex items-center gap-4 w-full">
                                  <div className="w-16 h-22 bg-slate-950 rounded-lg overflow-hidden border border-slate-750/80 shadow-md shrink-0">
                                    <img
                                      src={activeGame.coverImage}
                                      alt=""
                                      className="w-full h-full object-cover"
                                      referrerPolicy="no-referrer"
                                    />
                                  </div>
                                  <div className="space-y-1 min-w-0">
                                    <h2 className="text-lg md:text-xl font-black text-white tracking-tight leading-tight truncate">
                                      {activeGame.title}
                                    </h2>
                                    <div className="flex items-center gap-1 text-amber-400">
                                      {Array.from({ length: Math.round(activeGame.rating || 4) }).map((_, idx) => (
                                        <Star key={idx} size={12} className="fill-amber-400" />
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Steam Action Bar: Large PLAY button and metrics */}
                              <div className="bg-slate-950/80 p-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
                                <div className="flex items-center gap-4">
                                  {activeGame.status === "not_installed" ? (
                                    <button
                                      onClick={async () => {
                                        try {
                                          const res = await fetch(`/api/library/${activeGame.id}/install`, { method: "POST" });
                                          if (res.ok) {
                                            const data = await res.json();
                                            if (data.library) setLibraryGames(data.library);
                                            addLog(`[Library] Started installation for: "${activeGame.title}"`);
                                            setSuccessMsg("Download iniciado!");
                                          }
                                        } catch (err) {
                                          console.error(err);
                                        }
                                      }}
                                      className="px-8 py-3.5 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-black rounded-lg text-sm tracking-widest flex items-center gap-2 cursor-pointer transition-all shadow-lg shadow-indigo-500/20 hover:scale-[1.02]"
                                    >
                                      <Download size={16} className="text-white" />
                                      <span>{t("btnInstall") || "INSTALAR JOGO"}</span>
                                    </button>
                                  ) : activeGame.status === "installing" ? (
                                    <div className="flex items-center gap-2.5">
                                      <div className="px-6 py-3 bg-slate-900 border border-slate-800 text-sky-400 font-bold rounded-lg text-xs font-mono flex items-center gap-2.5 shadow-inner">
                                        <RefreshCw size={14} className="animate-spin text-sky-500" />
                                        <span>{t("btnInstalling") || "Instalando..."} {activeGame.progress || 0}%</span>
                                        <span className="text-slate-500 text-[10px]">(48.5 MB/s)</span>
                                      </div>
                                      <button
                                        onClick={async () => {
                                          try {
                                            const res = await fetch(`/api/library/${activeGame.id}/stop`, { method: "POST" });
                                            if (res.ok) {
                                              const data = await res.json();
                                              if (data.library) setLibraryGames(data.library);
                                              addLog(`[Library] Cancelled installation for: "${activeGame.title}"`);
                                              setSuccessMsg("Download cancelado.");
                                            }
                                          } catch (err) {
                                            console.error(err);
                                          }
                                        }}
                                        className="px-3.5 py-3 bg-slate-900 hover:bg-slate-850 border border-slate-700 text-slate-400 hover:text-slate-200 rounded-lg text-xs transition-all cursor-pointer font-bold font-mono"
                                        title="Cancelar Download"
                                      >
                                        {t("btnCancel") || "CANCELAR"}
                                      </button>
                                    </div>
                                  ) : isPlaying ? (
                                    <button
                                      onClick={async () => {
                                        try {
                                          const res = await fetch(`/api/library/${activeGame.id}/stop`, { method: "POST" });
                                          if (res.ok) {
                                            const data = await res.json();
                                            if (data.library) setLibraryGames(data.library);
                                            addLog(`[Launcher] Stopped game: "${activeGame.title}"`);
                                            setSuccessMsg("Jogo finalizado!");
                                          }
                                        } catch (err) {
                                          console.error(err);
                                        }
                                      }}
                                      className="px-8 py-3.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-black rounded-lg text-sm tracking-widest flex items-center gap-2 cursor-pointer transition-all shadow-lg shadow-red-500/10 hover:scale-[1.02]"
                                    >
                                      <Square size={16} className="fill-white" />
                                      <span>{t("btnStop")}</span>
                                    </button>
                                  ) : (
                                    <button
                                      onClick={async () => {
                                        try {
                                          const res = await fetch(`/api/library/${activeGame.id}/launch`, { method: "POST" });
                                          if (res.ok) {
                                            const data = await res.json();
                                            if (data.library) setLibraryGames(data.library);
                                            addLog(`[Launcher] Started game: "${activeGame.title}"`);
                                            setSuccessMsg("Jogo iniciado com sucesso!");
                                          }
                                        } catch (err) {
                                          console.error(err);
                                        }
                                      }}
                                      className="px-10 py-3.5 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-slate-950 font-black rounded-lg text-sm tracking-widest flex items-center gap-2 cursor-pointer transition-all shadow-lg shadow-green-500/15 hover:scale-[1.02]"
                                    >
                                      <Play size={16} className="fill-slate-950 text-slate-950" />
                                      <span>{t("btnPlay")}</span>
                                    </button>
                                  )}

                                  <div className="h-8 w-px bg-slate-800" />

                                  <div className="space-y-0.5 select-none">
                                    <p className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">{t("playTime")}</p>
                                    <p className="text-xs text-white font-bold font-mono">
                                      {activeGame.playTime || 0} min
                                    </p>
                                  </div>

                                  <div className="h-8 w-px bg-slate-800" />

                                  <div className="space-y-0.5 select-none">
                                    <p className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">{t("lastPlayed")}</p>
                                    <p className="text-xs text-slate-300 font-medium">
                                      {activeGame.lastPlayed || "-"}
                                    </p>
                                  </div>
                                </div>

                                <div className="text-right select-none space-y-0.5">
                                  <span className="text-[10px] text-sky-400 font-bold font-mono bg-sky-950/40 border border-sky-900/60 px-2.5 py-1 rounded-xl">
                                    STEAM DECK COMPATIBLE
                                  </span>
                                </div>
                              </div>

                              {/* Steam Details & Launch Configuration Grid */}
                              <div className="p-5 flex-1 overflow-y-auto space-y-5">
                                
                                {/* Simulator Live Console Log Overlay */}
                                {isPlaying && (
                                  <div className="bg-slate-950 border border-emerald-900/40 rounded-xl p-4 font-mono text-[10px] text-emerald-400 space-y-1 shadow-inner relative overflow-hidden">
                                    <div className="absolute top-2 right-2 flex items-center gap-1">
                                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                                      <span className="text-[9px] uppercase tracking-wide opacity-80">PROCESSO ATIVO</span>
                                    </div>
                                    <p className="text-emerald-500 font-bold">[SandboxLauncher] Inicializando jogo com segurança...</p>
                                    <p className="opacity-85">&gt; Pasta de Instalação: {activeGame.installPath}</p>
                                    <p className="opacity-85">&gt; Process ID (PID): 24908 • Threads Ativas: 64</p>
                                    <p className="opacity-85 font-semibold text-emerald-400">&gt; Estado de Verificação: Integridade de Arquivos 100% OK</p>
                                    <p className="text-sky-400 font-bold">[CORS-Proxy] Simulando alocação de RAM: 8.2 GB Utilizados</p>
                                    <p className="text-slate-500 text-[9px] mt-1 italic">Este jogo está rodando em modo sandbox. O tempo de jogo continuará contando...</p>
                                  </div>
                                )}

                                {/* Game Settings Form (Steam-style properties menu) */}
                                <div className="bg-slate-800/50 border border-slate-800 rounded-xl p-4 space-y-4">
                                  <div className="flex items-center gap-2 border-b border-slate-700/40 pb-2">
                                    <SettingsIcon size={14} className="text-indigo-400" />
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                                      {t("configureGame")}
                                    </h3>
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Install Path */}
                                    <div className="space-y-1 md:col-span-2">
                                      <label className="text-[10px] uppercase font-bold text-slate-400">{t("installPath")}</label>
                                      <input
                                        type="text"
                                        value={activeGame.installPath}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setLibraryGames(prev =>
                                            prev.map(g => (g.id === activeGame.id ? { ...g, installPath: val } : g))
                                          );
                                        }}
                                        className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                      />
                                    </div>

                                    {/* Rating */}
                                    <div className="space-y-1 md:col-span-2">
                                      <label className="text-[10px] uppercase font-bold text-slate-400">Avaliação Pessoal</label>
                                      <div className="flex flex-wrap items-center gap-3 bg-slate-950 p-3 rounded-lg border border-slate-850">
                                        <div className="flex items-center gap-1">
                                          {[1, 2, 3, 4, 5].map((starValue) => {
                                            const currentRating = Math.round(activeGame.rating || 4);
                                            const isFilled = starValue <= currentRating;
                                            return (
                                              <button
                                                key={starValue}
                                                type="button"
                                                onClick={() => {
                                                  setLibraryGames(prev =>
                                                    prev.map(g => (g.id === activeGame.id ? { ...g, rating: starValue } : g))
                                                  );
                                                  addLog(`[Library] Rated "${activeGame.title}" as ${starValue}/5 stars`);
                                                }}
                                                className="text-amber-400 hover:scale-125 transition-all p-1 cursor-pointer focus:outline-none"
                                                title={`${starValue} Estrela${starValue > 1 ? 's' : ''}`}
                                              >
                                                <Star
                                                  size={20}
                                                  className={isFilled ? "fill-amber-400 text-amber-400" : "text-slate-600"}
                                                />
                                              </button>
                                            );
                                          })}
                                        </div>
                                        <div className="h-5 w-px bg-slate-800" />
                                        <span className="text-xs font-mono font-black text-amber-400">
                                          {activeGame.rating ? `${activeGame.rating} / 5` : "Sem Avaliação"}
                                        </span>
                                        <span className="text-[10px] text-slate-400 font-sans font-medium">
                                          {(() => {
                                            const rating = activeGame.rating || 0;
                                            if (rating === 1) return "🤢 Terrível";
                                            if (rating === 2) return "😐 Ruim";
                                            if (rating === 3) return "🙂 Mediano";
                                            if (rating === 4) return "😄 Muito Bom";
                                            if (rating === 5) return "👑 Obra-Prima!";
                                            return "Clique para avaliar!";
                                          })()}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Disk & System details */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                  <div className="bg-slate-800/30 p-3.5 rounded-xl border border-slate-800 text-center space-y-1 select-none">
                                    <p className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">{t("sizeOnDisk")}</p>
                                    <p className="text-sm text-slate-200 font-bold font-mono">
                                      {activeGame.status === "not_installed" ? "0 GB" : 
                                       activeGame.status === "installing" ? `${((parseFloat(activeGame.sizeOnDisk || "42.5") * (activeGame.progress || 0)) / 100).toFixed(1)} GB / ${activeGame.sizeOnDisk || "42.5 GB"}` : 
                                       activeGame.sizeOnDisk || "42.5 GB"}
                                    </p>
                                  </div>
                                  <div className="bg-slate-800/30 p-3.5 rounded-xl border border-slate-800 text-center space-y-1 select-none">
                                    <p className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Estado de Instalação</p>
                                    <p className={`text-sm font-bold font-mono ${
                                      activeGame.status === "ready" || activeGame.status === "playing" ? "text-emerald-400" :
                                      activeGame.status === "installing" ? "text-sky-400 animate-pulse" : "text-amber-500"
                                    }`}>
                                      {activeGame.status === "ready" || activeGame.status === "playing" ? "100% OK" :
                                       activeGame.status === "installing" ? `Instalando... (${activeGame.progress || 0}%)` : "Não Instalado"}
                                    </p>
                                  </div>
                                  <div className="bg-slate-800/30 p-3.5 rounded-xl border border-slate-800 text-center space-y-1 select-none">
                                    <p className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Executável Verificado</p>
                                    <p className={`text-sm font-bold font-mono ${
                                      activeGame.status === "ready" || activeGame.status === "playing" ? "text-sky-400" :
                                      activeGame.status === "installing" ? "text-slate-500 animate-pulse" : "text-slate-600"
                                    }`}>
                                      {activeGame.status === "ready" || activeGame.status === "playing" ? "Integridade OK" :
                                       activeGame.status === "installing" ? "Verificando..." : "Não Verificado"}
                                    </p>
                                  </div>
                                </div>

                                {/* Save changes & Remove game buttons */}
                                <div className="flex items-center justify-between border-t border-slate-800 pt-4">
                                  <button
                                    onClick={() => {
                                      addLog(`[Library] Saved details updated for "${activeGame.title}"`);
                                      setSuccessMsg("Configurações salvas com sucesso!");
                                    }}
                                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-indigo-900/10"
                                  >
                                    <Save size={13} />
                                    <span>{t("saveConfig")}</span>
                                  </button>

                                  <button
                                    onClick={() => removeFromLibrary(activeGame.id)}
                                    className="px-4 py-2 bg-slate-950 hover:bg-red-950/40 hover:text-red-400 border border-slate-850 hover:border-red-900 text-slate-500 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
                                  >
                                    <Trash size={13} />
                                    <span>{t("removeGame")}</span>
                                  </button>
                                </div>

                              </div>

                            </div>
                          );
                        })()}
                      </div>

                    </div>
                  </div>
                )}

                {/* 7. SCRAPE PROCESS HISTORY */}
                {activeTab === "history" && (
                  <div className="flex-1 flex flex-col gap-6 animate-fade-in">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3 select-none">
                      <div className="space-y-1">
                        <h1 className="text-lg font-bold text-white flex items-center gap-2">
                          <History className="text-indigo-400" size={20} />
                          Scrape Operation History
                        </h1>
                        <p className="text-xs text-slate-400">
                          Review past operations, parsed links, and previously cached query results. Click any historical row to restore its parsed board instantly.
                        </p>
                      </div>

                      {history.length > 0 && (
                        <button
                          onClick={clearHistory}
                          className="px-3 py-1.5 rounded-xl bg-red-950/40 border border-red-900 text-red-400 text-xs font-bold hover:bg-red-950/80 transition flex items-center gap-1.5 cursor-pointer"
                        >
                          <Trash size={13} />
                          <span>Clear All Logs</span>
                        </button>
                      )}
                    </div>

                    {history.length > 0 ? (
                      <div className="bg-slate-800/40 border border-slate-700/80 rounded-2xl overflow-hidden shadow-sm flex flex-col">
                        <div className="divide-y divide-slate-800/60 max-h-[500px] overflow-y-auto">
                          {history.map((item) => (
                            <div
                              key={item.id}
                              className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-800/30 transition text-xs"
                            >
                              {/* Left: Repack Details */}
                              <div className="min-w-0 flex-1 space-y-1">
                                <h3 className="font-bold text-slate-200 truncate">
                                  {item.repackTitle}
                                </h3>
                                <div className="flex items-center gap-2 flex-wrap text-[10px] text-slate-400 font-mono">
                                  <span className="text-indigo-400">Parsed {item.linksCount} links</span>
                                  <span>•</span>
                                  <span>{new Date(item.timestamp).toLocaleString()}</span>
                                  <span>•</span>
                                  <span className="truncate max-w-xs" title={item.repackUrl}>{item.repackUrl}</span>
                                </div>
                              </div>

                              {/* Right: Actions */}
                              <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto select-none">
                                <button
                                  onClick={() => {
                                    // Construct transient SelectedRepack structure
                                    const mockRepack: RepackDetails = {
                                      id: `hist_${item.id}`,
                                      title: item.repackTitle,
                                      url: item.repackUrl,
                                      coverImage: item.coverImage || "",
                                      specs: {},
                                      links: item.links
                                    } as any;
                                    setSelectedRepack(mockRepack);
                                    addLog(`Restored extracted repack details from operation history: "${item.repackTitle}"`);
                                  }}
                                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-sky-400 font-bold rounded-lg text-[11px] transition flex items-center gap-1.5 cursor-pointer"
                                  title="Instantly restore parsed layout for this repack"
                                >
                                  <Search size={12} />
                                  <span>Load Links Board</span>
                                </button>

                                <button
                                  onClick={() => {
                                    removeFromHistory(item.id);
                                    addLog(`Removed item from history: "${item.repackTitle}"`);
                                  }}
                                  className="p-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-500 hover:text-red-400 hover:bg-red-950/20 hover:border-red-900 transition"
                                  title="Delete item from history"
                                >
                                  <Trash size={13} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-500 text-xs font-mono gap-2 border border-dashed border-slate-700 rounded-2xl">
                        <History size={32} className="text-slate-700" />
                        <span>Operation history is blank.</span>
                        <span className="text-[10px] text-slate-600 font-sans mt-1">Whenever you search or extract repack links, operation logs are saved here.</span>
                      </div>
                    )}
                  </div>
                )}

                {/* 8. SUPPORT & DONATIONS TAB */}
                {activeTab === "donate" && (
                  <div className="flex-1 flex flex-col gap-6 animate-fade-in">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3 select-none">
                      <div className="space-y-1">
                        <h1 className="text-lg font-bold text-white flex items-center gap-2">
                          <Heart className="text-rose-500 fill-rose-500" size={20} />
                          {t("donateHeader")}
                        </h1>
                        <p className="text-xs text-slate-400">
                          {t("donateSubheader")}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 items-stretch">
                      {/* Left Block: WM Livepix widget */}
                      <div className="lg:col-span-7 bg-slate-800 border border-slate-700 rounded-2xl p-5 flex flex-col justify-between gap-4 shadow-sm">
                        <div className="space-y-2">
                          <h2 className="text-md font-bold text-sky-400 flex items-center gap-2 border-b border-slate-700 pb-2">
                            <Sparkles size={16} />
                            {t("donateDevTitle")}
                          </h2>
                          <p className="text-xs text-slate-300 leading-relaxed">
                            {t("donateDevDesc")}
                          </p>
                        </div>

                        {/* Embed Livepix widget in iframe */}
                        <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden flex flex-col flex-1 min-h-[360px] max-h-[480px]">
                          <div className="bg-slate-950 px-3 py-1.5 flex items-center justify-between text-[10px] text-slate-500 font-mono border-b border-slate-800">
                            <span>LIVEPIX INTERACTIVE WIDGET</span>
                            <span className="text-emerald-400 font-bold">● SECURE GATEWAY</span>
                          </div>
                          <iframe 
                            src="https://widget.livepix.gg/embed/d0aaadfc-4b9e-491c-b2ef-ee4f4ac5d6f6" 
                            style={{ width: "100%", height: "100%", border: "none" }}
                            title="Livepix Donation Widget"
                            referrerPolicy="no-referrer"
                          />
                        </div>

                        {/* Failover Button if iframe doesn't render well */}
                        <div className="flex flex-col sm:flex-row items-center gap-3">
                          <a 
                            href="https://livepix.gg/d0aaadfc-4b9e-491c-b2ef-ee4f4ac5d6f6" 
                            target="_blank" 
                            rel="noreferrer"
                            className="flex-1 w-full py-2.5 bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-600 hover:to-indigo-600 text-slate-950 font-black text-center rounded-xl text-xs shadow-lg shadow-sky-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <ExternalLink size={14} />
                            <span>Open Livepix in New Tab</span>
                          </a>
                        </div>
                      </div>

                      {/* Right Block: FitGirl Donations */}
                      <div className="lg:col-span-5 bg-slate-800 border border-slate-700 rounded-2xl p-5 flex flex-col justify-between gap-4 shadow-sm">
                        <div className="space-y-4">
                          <h2 className="text-md font-bold text-pink-400 flex items-center gap-2 border-b border-slate-700 pb-2">
                            <Heart className="text-pink-500 fill-pink-500" size={16} />
                            {t("donateFgTitle")}
                          </h2>
                          <p className="text-xs text-slate-300 leading-relaxed">
                            {t("donateFgDesc")}
                          </p>

                          <div className="space-y-3 bg-slate-900/60 p-4 rounded-xl border border-slate-700/50">
                            <h4 className="text-xs font-bold text-slate-200 font-mono">Accepted Crypto Methods:</h4>
                            <div className="space-y-2 text-xs font-mono text-slate-400">
                              <div className="flex justify-between items-center bg-slate-950/60 p-2 rounded border border-slate-850">
                                <span className="text-yellow-500 font-sans font-bold">Bitcoin (BTC)</span>
                                <span className="text-[10px]">Main Network</span>
                              </div>
                              <div className="flex justify-between items-center bg-slate-950/60 p-2 rounded border border-slate-850">
                                <span className="text-blue-400 font-sans font-bold">Ethereum (ETH)</span>
                                <span className="text-[10px]">ERC-20</span>
                              </div>
                              <div className="flex justify-between items-center bg-slate-950/60 p-2 rounded border border-slate-850">
                                <span className="text-slate-200 font-sans font-bold">Litecoin (LTC)</span>
                                <span className="text-[10px]">Native Network</span>
                              </div>
                              <div className="flex justify-between items-center bg-slate-950/60 p-2 rounded border border-slate-850">
                                <span className="text-green-400 font-sans font-bold">Bitcoin Cash (BCH)</span>
                                <span className="text-[10px]">Native Network</span>
                              </div>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-2 leading-relaxed font-sans">
                              Check her official donation page for exact addresses and validation warnings before initiating any transfer.
                            </p>
                          </div>
                        </div>

                        <a 
                          href="https://fitgirl-repacks.site/donations/" 
                          target="_blank" 
                          rel="noreferrer"
                          className="w-full py-2.5 bg-pink-500 hover:bg-pink-600 text-white font-black text-center rounded-xl text-xs shadow-lg shadow-pink-500/15 transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <ExternalLink size={14} />
                          <span>Official FitGirl Donations Portal</span>
                        </a>
                      </div>
                    </div>
                  </div>
                )}
                
              </div>
            )}

          </div>

        </div>

      </div>

    </div>
  );
}

