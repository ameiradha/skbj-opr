import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import puppeteer from "puppeteer";
import ejs from "ejs";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper function to get Gemini AI instance
function getGeminiClient(overrideKey?: string) {
  const apiKey = overrideKey || process.env.GEMINI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    return null;
  }
  return new GoogleGenAI({
    apiKey: apiKey.trim(),
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: true, limit: "100mb" }));

// API Route for Gemini AI Objective Generation
app.post(["/api/gemini/generate-objectives", "/gemini/generate-objectives"], async (req, res) => {
  try {
    const { programName, customApiKey } = req.body || {};
    if (!programName || typeof programName !== "string" || !programName.trim()) {
      return res.status(400).json({ error: "Sila masukkan nama program terlebih dahulu." });
    }

    console.log(`Generating AI objectives for program: "${programName}"...`);
    const cleanName = programName.trim();
    
    const clientKey = customApiKey || (req.headers["x-gemini-api-key"] as string);
    const ai = getGeminiClient(clientKey);
    let response = null;

    if (ai) {
      const modelsToTry = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
      for (const modelName of modelsToTry) {
        try {
          console.log(`Trying model: ${modelName}`);
          response = await ai.models.generateContent({
            model: modelName,
            contents: `Anda adalah pembantu pengurusan sekolah di Malaysia. Sila jana 2 hingga 3 objektif program yang ringkas, profesional, dan padat (dalam Bahasa Melayu) berdasarkan tajuk program berikut: "${cleanName}".

Garis Panduan Penting:
1. Tulis dalam bentuk senarai bernombor (numbering) bermula dengan angka 1 dan seterusnya (cth: "1. ", "2. ", "3. "). Jangan gunakan simbol "- " atau bullet points lain.
2. Setiap objektif mestilah ringkas, padat dan mudah difahami (1 baris setiap satu).
3. Terus berikan senarai objektif tersebut tanpa sebarang pengenalan, penutup, atau hiasan teks lain.

Contoh Output:
1. Meningkatkan kesedaran murid tentang kepentingan keselamatan jalan raya.
2. Memupuk semangat kerjasama dan kepimpinan dalam kalangan peserta.
3. Melahirkan pelajar yang berdisiplin dan bertanggungjawab.`,
          });
          if (response && response.text) {
            console.log(`Successfully generated using ${modelName}`);
            break;
          }
        } catch (err: any) {
          console.warn(`Model ${modelName} failed:`, err.message || err);
        }
      }
    } else {
      console.warn("GEMINI_API_KEY environment variable is missing in Vercel.");
    }

    let objectives = "";
    if (response && response.text) {
      objectives = response.text.trim();
      console.log("Objectives generated successfully via Gemini API.");
    } else {
      console.warn("Using high-quality local fallback generator...");
      objectives = [
        `1. Meningkatkan pemahaman dan kesedaran murid tentang kepentingan aktiviti dalam "${cleanName}".`,
        `2. Memupuk semangat kerjasama, disiplin, dan penglibatan aktif semua peserta yang menyertai "${cleanName}".`,
        `3. Melahirkan pelajar yang seimbang dari aspek intelek, rohani, emosi, dan jasmani melalui program ini.`
      ].join("\n");
    }

    res.json({ objectives });
  } catch (error: any) {
    console.error("Gemini Generation Error:", error);
    const fallbackName = (req.body?.programName || "Program").trim();
    const fallbackObjectives = [
      `1. Meningkatkan pemahaman dan kesedaran murid tentang kepentingan aktiviti dalam "${fallbackName}".`,
      `2. Memupuk semangat kerjasama, disiplin, dan penglibatan aktif semua peserta yang menyertai "${fallbackName}".`,
      `3. Melahirkan pelajar yang seimbang dari aspek intelek, rohani, emosi, dan jasmani melalui program ini.`
    ].join("\n");
    res.json({ objectives: fallbackObjectives });
  }
});

// API Route for PDF Generation
app.post("/api/generate-pdf", async (req, res) => {
  console.log("Received PDF generation request...");
  let browser;
  try {
    const { formData = {}, imagesData = [] } = req.body;
    
    const normalizedFormData = {
      programName: formData.programName || "",
      organizer: formData.organizer || "",
      date: formData.date || "",
      location: formData.location || "",
      targetAudience: formData.targetAudience || "",
      objectives: formData.objectives || "",
      userName: formData.userName || "",
      position: formData.position || "",
      userName1: formData.userName1 || "",
      position1: formData.position1 || "",
      userName2: formData.userName2 || "",
      position2: formData.position2 || "",
    };

    console.log("Form Data:", normalizedFormData.programName);
    console.log("Images Count:", imagesData ? imagesData.length : 0);

    // Render HTML using EJS
    const templatePath = path.join(process.cwd(), "src", "templates", "pdfTemplate.ejs");
    console.log("Rendering template from:", templatePath);
    const htmlContent = await ejs.renderFile(templatePath, { formData: normalizedFormData, imagesData });
    console.log("Template rendered successfully. Length:", htmlContent.length);

    // Launch Puppeteer to generate PDF
    console.log("Launching browser...");
    browser = await puppeteer.launch({
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-zygote",
        "--single-process"
      ],
      headless: true,
    });

    const page = await browser.newPage();
    console.log("Setting page content...");
    // Using networkidle0 to ensure images are fully loaded before PDF generation
    await page.setContent(htmlContent, { waitUntil: "networkidle0" });
    
    console.log("Generating PDF...");
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0px", right: "0px", bottom: "0px", left: "0px" },
      timeout: 60000 
    });

    console.log("PDF generated successfully. Size:", pdfBuffer.length);
    await browser.close();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${formData.programName || "Report"}.pdf"`);
    res.send(Buffer.from(pdfBuffer));
    console.log("PDF sent to client.");
  } catch (error: any) {
    console.error("PDF Generation Error:", error);
    if (browser) await browser.close();
    res.status(500).json({ error: "Failed to generate PDF", details: error.message });
  }
});

// Vite middleware for development
async function setupViteMiddleware() {
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
}

// Start local listener if not running on Vercel serverless environment
if (process.env.VERCEL !== "1") {
  setupViteMiddleware().then(() => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  });
} else {
  // Pre-setup Vite or static routes for Vercel
  const distPath = path.join(process.cwd(), "dist");
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

export default app;
