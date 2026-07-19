import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import * as cheerio from "cheerio";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

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

// Setup Vite or static files serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
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
