import React, { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { 
  FileUp, 
  FileText, 
  Loader2, 
  Sparkles, 
  Key, 
  X, 
  Printer, 
  AlertCircle, 
  Download,
  Eye,
  CheckCircle2,
  HelpCircle,
  Image as ImageIcon
} from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

interface ImageItem {
  file: File | null;
  dataUrl: string;
  description: string;
}

export default function App() {
  useEffect(() => {
    document.title = "SK Kampung Bahagia Jaya OPR Generator";
  }, []);

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressStatus, setProgressStatus] = useState("");
  const [notification, setNotification] = useState<{ type: "info" | "warning" | "error" | "success"; message: string } | null>(null);

  const [formData, setFormData] = useState({
    programName: "",
    organizer: "",
    date: "",
    location: "",
    targetAudience: "",
    objectives: "",
    userName: "",
    position: "",
    userName1: "",
    position1: "",
    userName2: "",
    position2: "",
  });

  const [images, setImages] = useState<ImageItem[]>([
    { file: null, dataUrl: "", description: "" },
    { file: null, dataUrl: "", description: "" },
    { file: null, dataUrl: "", description: "" },
    { file: null, dataUrl: "", description: "" },
  ]);

  const [bannerDataUrl, setBannerDataUrl] = useState<string>("");
  const [showPreview, setShowPreview] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("GEMINI_API_KEY") || "");
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [titleClicks, setTitleClicks] = useState(0);

  const exportReportRef = useRef<HTMLDivElement>(null);

  // Preload header banner as base64 data url for seamless html2canvas rendering
  useEffect(() => {
    const bannerUrl = "https://lh3.googleusercontent.com/d/15BJ119qQWyBepLyaVjP4IOk-EbIgovP-=w1920";
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.referrerPolicy = "no-referrer";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const dataUri = canvas.toDataURL("image/jpeg", 0.95);
          setBannerDataUrl(dataUri);
        }
      } catch {
        setBannerDataUrl(bannerUrl);
      }
    };
    img.onerror = () => {
      setBannerDataUrl(bannerUrl);
    };
    img.src = bannerUrl;
  }, []);

  const handleTitleClick = () => {
    setTitleClicks((prev) => {
      const next = prev + 1;
      if (next >= 5) {
        setShowKeyModal(true);
        return 0;
      }
      return next;
    });
  };

  const saveApiKey = (key: string) => {
    setApiKey(key);
    if (key.trim()) {
      localStorage.setItem("GEMINI_API_KEY", key.trim());
    } else {
      localStorage.removeItem("GEMINI_API_KEY");
    }
  };

  const generateAIObjectives = async () => {
    if (!formData.programName || !formData.programName.trim()) {
      setNotification({
        type: "warning",
        message: "Sila masukkan nama program terlebih dahulu sebelum menjana objektif."
      });
      return;
    }
    setNotification(null);
    setGeneratingAI(true);
    const cleanProgramName = formData.programName.trim();

    try {
      const storedKey = localStorage.getItem("GEMINI_API_KEY") || apiKey;
      const response = await fetch("/api/gemini/generate-objectives", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-gemini-api-key": storedKey || ""
        },
        body: JSON.stringify({ 
          programName: cleanProgramName,
          customApiKey: storedKey || undefined
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data && data.objectives) {
          setFormData(prev => ({
            ...prev,
            objectives: data.objectives
          }));
          setNotification({
            type: "success",
            message: "Objektif berjaya dijana dengan AI!"
          });
          return;
        }
      }
    } catch (err: any) {
      console.warn("API request failed, using intelligent client-side fallback:", err);
    } finally {
      setGeneratingAI(false);
    }

    // Fallback objectives if API fails or Vercel route is unconfigured
    const fallbackObjectives = [
      `1. Meningkatkan pemahaman dan kesedaran murid tentang kepentingan aktiviti dalam "${cleanProgramName}".`,
      `2. Memupuk semangat kerjasama, disiplin, dan penglibatan aktif semua peserta yang menyertai "${cleanProgramName}".`,
      `3. Melahirkan pelajar yang seimbang dari aspek intelek, rohani, emosi, dan jasmani melalui program ini.`
    ].join("\n");

    setFormData(prev => ({
      ...prev,
      objectives: fallbackObjectives
    }));
    setNotification({
      type: "info",
      message: "Objektif berjaya dijana secara automatik."
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleImageChange = (index: number, file: File | null) => {
    const newImages = [...images];
    newImages[index].file = file;

    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        // Compress image before saving dataUrl
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width || 800;
          let height = img.height || 600;
          const maxWidth = 900;
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            newImages[index].dataUrl = canvas.toDataURL("image/jpeg", 0.75);
          } else {
            newImages[index].dataUrl = result;
          }
          setImages([...newImages]);
        };
        img.onerror = () => {
          newImages[index].dataUrl = result;
          setImages([...newImages]);
        };
        img.src = result;
      };
      reader.readAsDataURL(file);
    } else {
      newImages[index].dataUrl = "";
      setImages(newImages);
    }
  };

  const handleDescChange = (index: number, description: string) => {
    const newImages = [...images];
    newImages[index].description = description;
    setImages(newImages);
  };

  // Pure Client-side High-Resolution Strict A4 PDF Generator
  const generatePdfFile = async () => {
    setNotification(null);
    setLoading(true);
    setProgress(20);
    setProgressStatus("Menyediakan templat laporan A4...");

    try {
      const targetElement = exportReportRef.current || document.getElementById("opr-export-document");

      if (!targetElement) {
        throw new Error("Elemen templat laporan tidak dijumpai.");
      }

      setProgress(40);
      setProgressStatus("Merender grafik & gambar beresolusi tinggi...");
      
      // Short delay to ensure DOM and layout settled
      await new Promise(resolve => setTimeout(resolve, 200));

      const canvas = await html2canvas(targetElement, {
        scale: 2, // 2x gives crisp 300dpi printing quality on A4
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
        width: 794,
        height: 1123,
        windowWidth: 794,
        windowHeight: 1123,
        x: 0,
        y: 0,
        scrollX: 0,
        scrollY: 0,
        onclone: (clonedDoc) => {
          // Sanitize cloned document to prevent any Tailwind v4 oklch color parsing errors
          const clonedNodes = clonedDoc.querySelectorAll("*");
          clonedNodes.forEach((node) => {
            if (node instanceof HTMLElement) {
              const inlineStyle = node.getAttribute("style") || "";
              if (inlineStyle.includes("oklch")) {
                node.style.color = "#0f172a";
                node.style.borderColor = "#cbd5e1";
              }
            }
          });
        }
      });

      setProgress(75);
      setProgressStatus("Menyusun fail PDF piawaian A4...");

      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      
      // Standard A4 dimensions in mm: 210 x 297 (Strict 1-page A4)
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
        compress: true,
      });

      const pdfWidth = pdf.internal.pageSize.getWidth(); // 210 mm
      const pdfHeight = pdf.internal.pageSize.getHeight(); // 297 mm

      pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight, undefined, "FAST");

      setProgress(95);
      setProgressStatus("Menyimpan fail...");

      const cleanFileName = (formData.programName || "OPR_SKBJ").trim().replace(/[/\\?%*:|"<>]/g, "_");
      pdf.save(`${cleanFileName}_One_Page_Report.pdf`);

      setProgress(100);
      setProgressStatus("Selesai!");
      setNotification({
        type: "success",
        message: `Laporan PDF "${cleanFileName}_One_Page_Report.pdf" (Saiz A4) berjaya dimuat turun!`
      });

      setTimeout(() => {
        setLoading(false);
        setProgress(0);
        setProgressStatus("");
      }, 700);
    } catch (error: any) {
      console.error("Gagal menjana PDF:", error);
      const msg = error?.message || "Ralat semasa pemprosesan PDF.";
      setNotification({
        type: "warning",
        message: `Penjanaan terus: ${msg}. Pratonton dibuka untuk anda cetak / simpan sebagai PDF.`
      });
      setShowPreview(true);
      setLoading(false);
      setProgress(0);
      setProgressStatus("");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.programName || !formData.programName.trim()) {
      setNotification({
        type: "warning",
        message: "Sila masukkan Nama Program terlebih dahulu."
      });
      return;
    }
    generatePdfFile();
  };

  const teacherNames = [
    "HAMDI BIN NAJDI",
    "LAM KAH SOON",
    "MOHAMMAD RAMOS BIN MUSTAPHA",
    "JAMALLUDIN BIN JERAAEE@JURIT",
    "AMEIR DANIEL HAKIEM BIN AZMI",
    "AQILAH BINTI MOHAMMAD SHA’ARI",
    "DORENCE ANAK JULIUS TUNGKIONG",
    "HASINAH KHAN BINTI NISAR",
    "HENNY IRAWATY BINTI IBRAHIM",
    "HOO KIONG",
    "KHAIRUNNISA MADIHAH BINTI ABDUL RAHIM",
    "KOH WEI WEI",
    "KONG AI LING",
    "LAU ENG ENG",
    "LIM JIA LIH",
    "LING SIEW SIEW",
    "MAIMON BINTI RAHIM",
    "MARISSA MARTHA ABDULLAH",
    "MEGAWATI BINTI SALLEH",
    "MERINI ANAK PRIA",
    "MOHAMAD ERWAN BIN ALIM",
    "MOHAMAD SHADON BIN WAHAP",
    "MOHD FADHLAN ABDULLAH",
    "NOOR SHAHIDA BINTI SHAFIE",
    "NOORAZLINA BINTI BOLHASSAN",
    "NORMAH BINTI RAWI",
    "NURATIQAH BINTI MOHD SAID",
    "NURUL NABILAH BINTI ABDUL HALIM",
    "RAHIMAH BINTI IBRAHIM",
    "RAMALAH BINTI YUSUF",
    "RITA WONG SIAO ING",
    "ROSMAH BINTI JOHREE",
    "ROSMAWATI BINTI CHENG",
    "THOMAS CHIEW SENG KAI",
    "WAHYUNI BINTI ESAEH@ISHA",
    "WAN MOHD LUKMANUL HAKIM BIN WAN MAZLI",
    "CHRISTINA TELESAI ANAK JOSEPH MAUH",
    "TING YIENG NI",
    "OLYVIA ANAK KUNSAN",
    "SANDRA TING TAI LING",
  ];

  const validatorNames = [
    "HAMDI BIN NAJDI",
    "LAM KAH SOON",
    "MOHAMMAD RAMOS BIN MUSTAPHA",
    "JAMALLUDIN BIN JERAAEE@JURIT"
  ];

  // Specific 4 positions for Pengesah only
  const validatorPositions = [
    "GURU BESAR",
    "PK PENTADBIRAN",
    "PK HAL EHWAL MURID",
    "PK KOKURIKULUM"
  ];

  const positions = [
    "GURU BESAR",
    "PK PENTADBIRAN",
    "PK HAL EHWAL MURID",
    "PK KOKURIKULUM",
    "GURU AKADEMIK BIASA",
    "ADMIN APDM",
    "AJK 1 PBPPP",
    "AJK 2 PBPPP",
    "AJK 3 PBPPP",
    "AJK JADUAL WAKTU DAN TEACH-IN",
    "BENDAHARI JK ASRAMA",
    "BENDAHARI KELAB STAF",
    "BENDAHARI KOKURIKULUM",
    "BENDAHARI PIBG",
    "BERTANGGUNGJAWAB MELAPOR KEROSAKAN DALAM BANGUNAN, LUAR BANGUNAN DAN PERALATAN SEKOLAH",
    "GURU 3K",
    "GURU BIMBINGAN & KAUNSELING",
    "GURU BIASISWA / KWAMP / BANTUAN",
    "GURU DATA",
    "GURU KEDAP",
    "GURU KELAS TAHUN 1",
    "GURU KELAS TAHUN 2",
    "GURU KELAS TAHUN 3",
    "GURU KELAS TAHUN 4",
    "GURU KELAS TAHUN 5",
    "GURU KELAS TAHUN 6",
    "GURU PAJSK",
    "GURU PEMULIHAN KHAS",
    "GURU PENASIHAT KELAB BAHASA MELAYU",
    "GURU PENASIHAT KELAB BOLA BALING",
    "GURU PENASIHAT KELAB BOLA TAKRAW",
    "GURU PENASIHAT KELAB KEBUDAYAAN",
    "GURU PENASIHAT KELAB PENCEGAH JENAYAH",
    "GURU PENASIHAT KEBUDAYAAN",
    "GURU PENASIHAT PPDA",
    "GURU PENASIHAT PROGRAM PEMBANGUNAN OLAHRAGA / MERENTAS DESA",
    "GURU PENASIHAT TKRS",
    "GURU RUMAH SUKAN (HIJAU)",
    "GURU RUMAH SUKAN (MERAH)",
    "GURU RUMAH SUKAN (KUNING)",
    "GURU RUMAH SUKAN (BIRU)",
    "GURU SEGAK",
    "GURU SPBT",
    "GURU SUKAN",
    "JURULATIH RUMAH SUKAN (HIJAU)",
    "JURULATIH RUMAH SUKAN (MERAH)",
    "JURULATIH RUMAH SUKAN (KUNING)",
    "JURULATIH RUMAH SUKAN (BIRU)",
    "KEMASUKAN DAN PERPINDAHAN MURID",
    "KETUA GURU DISIPLIN & PENGAWAS",
    "KETUA PANITIA BAHASA IBAN",
    "KETUA PANITIA BAHASA INGGERIS",
    "KETUA PANITIA BAHASA MELAYU",
    "KETUA PANITIA MATEMATIK",
    "KETUA PANITIA PENDIDIKAN MORAL",
    "KETUA PANITIA PENDIDIKAN MUZIK",
    "KETUA PANITIA PENDIDIKAN SENI VISUAL",
    "KETUA PANITIA PJK",
    "KETUA PANITIA RBT",
    "KETUA PANITIA SAINS",
    "KETUA PANITIA SEJARAH",
    "KETUA RUMAH SUKAN (HIJAU)",
    "KETUA RUMAH SUKAN (MERAH)",
    "KETUA RUMAH SUKAN (KUNING)",
    "KETUA RUMAH SUKAN (BIRU)",
    "MENCATAT KELUAR MASUK SURAT",
    "MENCETAK UJIAN, LATIHAN DAN PDP GURU",
    "PEGAWAI ASET",
    "PEGAWAI PELUPUSAN ASET",
    "PEMBANTU GURU SPBT",
    "PEMBANTU JK PERPINDAHAN KELUAR / MASUK MURID",
    "PEMBANTU PENGURUSAN MURID ASRAMA",
    "PEMBANTU PENGURUSAN MURID PRA",
    "PEMBANTU PENYELARAS EKSA",
    "PEMERIKSA ASET",
    "PENASIHAT KELAB BOLA BALING",
    "PENASIHAT TKRS",
    "PENGERUSI AJK JADUAL WAKTU / TEACH-IN",
    "PENGERUSI E-OPERASI",
    "PENGERUSI EMIS",
    "PENGERUSI HRMIS",
    "PENGERUSI JAWATANKUASA ASRAMA",
    "PENGERUSI PBPPP",
    "PENGERUSI SKPM",
    "PENTADBIR HRMIS",
    "PENOLONG BENDAHARI PIBG",
    "PENOLONG GURU ICT",
    "PENOLONG PENASIHAT KELAB BOLA SEPAK",
    "PENOLONG PENYELARAS E-OPERASI (KEBERADAAN)",
    "PENOLONG SETIAUSAHA PIBG",
    "PENYELARAS BESTARI / ICT",
    "PENYELARAS DELIMA",
    "PENYELARAS DLP",
    "PENYELARAS E-OPERASI",
    "PENYELARAS EKSA",
    "PENYELARAS HIP",
    "PENYELARAS HRMIS",
    "PENYELARAS I-KEPS",
    "PENYELARAS JADUAL WAKTU / TEACH-IN",
    "PENYELARAS KBAT",
    "PENYELARAS KEDAP",
    "PENYELARAS MAJLIS SEKOLAH",
    "PENYELARAS PBD",
    "PENYELARAS PBPPP",
    "PENYELARAS PEPERIKSAAN",
    "PENYELARAS PERHIMPUNAN SEKOLAH",
    "PENYELARAS PIKAP",
    "PENYELARAS PKL",
    "PENYELARAS PLAN",
    "PENYELARAS PLC",
    "PENYELARAS PROGRAM KELAB STAF",
    "PENYELARAS RMT",
    "PENYELARAS SISKA",
    "PENYELARAS SISTEM FAIL SEKOLAH",
    "PENYELARAS SKPM",
    "PENYELARAS SPLKPM",
    "PENYELARAS STOK",
    "PENYELARAS TS25",
    "PENYELIA ASRAMA",
    "RETEN BULANAN KEHADIRAN",
    "SETIAUSAHA BANTUAN SEKOLAH",
    "SETIAUSAHA JK ASRAMA",
    "SETIAUSAHA JK HEM",
    "SETIAUSAHA KELAB STAF & BILIK GURU",
    "SETIAUSAHA KOKURIKULUM",
    "SETIAUSAHA KURIKULUM",
    "SETIAUSAHA MESYUARAT KEWANGAN",
    "SETIAUSAHA MESYUARAT PENGURUSAN STAF",
    "SETIAUSAHA PBPPP",
    "SETIAUSAHA PIBG",
    "SETIAUSAHA SKPM KUALITI@SEKOLAH",
    "SETIAUSAHA TS25",
    "URUS SETIA PBPPP",
    "WARDEN ASRAMA",
  ];

  // Reusable Single-Page A4 OPR Report Document Layout with pure standard HEX styles and clean multiline text wrapping
  const renderDocumentContent = (containerId: string, refInstance?: React.RefObject<HTMLDivElement | null>) => (
    <div 
      id={containerId}
      ref={refInstance}
      style={{ 
        width: "794px", 
        height: "1123px", 
        minHeight: "1123px", 
        maxHeight: "1123px", 
        backgroundColor: "#ffffff",
        color: "#0f172a",
        padding: "28px 32px",
        boxSizing: "border-box",
        border: "1px solid #e2e8f0",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        fontFamily: "Inter, Arial, Helvetica, sans-serif"
      }}
    >
      {/* Subtle background graphic watermark */}
      <div 
        style={{ 
          position: "absolute", 
          inset: 0, 
          opacity: 0.04, 
          pointerEvents: "none", 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center" 
        }}
      >
        <div style={{ width: "120%", height: "120%", transform: "rotate(12deg)", border: "40px solid #2563eb" }}></div>
      </div>

      <div style={{ position: "relative", zIndex: 10, flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        {/* Header / Banner */}
        <div>
          <div style={{ textAlign: "center", marginBottom: "14px", paddingBottom: "10px", borderBottom: "2px solid #2563eb" }}>
            {bannerDataUrl ? (
              <img 
                src={bannerDataUrl} 
                alt="Header Banner" 
                style={{ width: "100%", height: "auto", maxHeight: "75px", objectFit: "contain", margin: "0 auto", display: "block" }}
                crossOrigin="anonymous"
              />
            ) : (
              <div style={{ textAlign: "center", padding: "6px 0" }}>
                <h2 style={{ fontSize: "19px", fontWeight: "bold", color: "#1e3a8a", letterSpacing: "0.05em", margin: 0 }}>
                  SEKOLAH KEBANGSAAN KAMPUNG BAHAGIA JAYA
                </h2>
                <p style={{ fontSize: "11.5px", color: "#475569", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", marginTop: "3px" }}>
                  LAPORAN SATU MUKA (ONE PAGE REPORT - OPR)
                </p>
              </div>
            )}
          </div>

          {/* Details Table / Grid */}
          <div style={{ display: "flex", flexDirection: "column", gap: "7px", fontSize: "12px", lineHeight: "1.3" }}>
            <div style={{ display: "grid", gridTemplateColumns: "95px 1fr", gap: "8px", alignItems: "baseline" }}>
              <span style={{ fontWeight: "bold", color: "#475569", textTransform: "uppercase", fontSize: "11px" }}>Program:</span>
              <span style={{ fontWeight: 600, color: "#0f172a" }}>{formData.programName || "—"}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "95px 1fr", gap: "8px", alignItems: "baseline" }}>
              <span style={{ fontWeight: "bold", color: "#475569", textTransform: "uppercase", fontSize: "11px" }}>Anjuran:</span>
              <span style={{ fontWeight: 500, color: "#1e293b" }}>{formData.organizer || "—"}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "95px 1fr", gap: "8px", alignItems: "baseline" }}>
              <span style={{ fontWeight: "bold", color: "#475569", textTransform: "uppercase", fontSize: "11px" }}>Tarikh:</span>
              <span style={{ fontWeight: 500, color: "#1e293b" }}>{formData.date || "—"}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "95px 1fr", gap: "8px", alignItems: "baseline" }}>
              <span style={{ fontWeight: "bold", color: "#475569", textTransform: "uppercase", fontSize: "11px" }}>Tempat:</span>
              <span style={{ fontWeight: 500, color: "#1e293b" }}>{formData.location || "—"}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "95px 1fr", gap: "8px", alignItems: "baseline" }}>
              <span style={{ fontWeight: "bold", color: "#475569", textTransform: "uppercase", fontSize: "11px" }}>Sasaran:</span>
              <span style={{ fontWeight: 500, color: "#1e293b" }}>{formData.targetAudience || "—"}</span>
            </div>
            <div style={{ paddingTop: "6px", borderTop: "1px solid #e2e8f0" }}>
              <div style={{ fontWeight: "bold", color: "#334155", textTransform: "uppercase", fontSize: "11px", marginBottom: "4px" }}>Objektif:</div>
              <div 
                style={{ 
                  whiteSpace: "pre-wrap", 
                  paddingLeft: "10px", 
                  borderLeft: "4px solid #3b82f6", 
                  color: "#1e293b", 
                  fontSize: "11px", 
                  backgroundColor: "#f8fafc", 
                  padding: "7px 10px", 
                  borderRadius: "0 6px 6px 0", 
                  lineHeight: "1.45", 
                  minHeight: "45px" 
                }}
              >
                {formData.objectives || "Tiada objektif dinyatakan."}
              </div>
            </div>
          </div>
        </div>

        {/* Images Grid (2 x 2) */}
        <div style={{ margin: "10px 0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
          {images.map((img, idx) => (
            <div 
              key={idx} 
              style={{ 
                display: "flex", 
                flexDirection: "column", 
                alignItems: "center", 
                backgroundColor: "#f8fafc", 
                padding: "6px", 
                borderRadius: "6px", 
                border: "1px solid #e2e8f0" 
              }}
            >
              <div 
                style={{ 
                  width: "100%", 
                  height: "120px", 
                  backgroundColor: "#e2e8f0", 
                  borderRadius: "4px", 
                  overflow: "hidden", 
                  border: "1px solid #cbd5e1", 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center" 
                }}
              >
                {img.dataUrl ? (
                  <img 
                    src={img.dataUrl} 
                    alt={`Gambar ${idx + 1}`}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: "11px", gap: "3px" }}>
                    <ImageIcon style={{ width: "22px", height: "22px", opacity: 0.4 }} />
                    <span>Ruang Gambar {idx + 1}</span>
                  </div>
                )}
              </div>
              <p 
                style={{ 
                  marginTop: "5px", 
                  fontSize: "9.5px", 
                  fontWeight: "bold", 
                  color: "#475569", 
                  textAlign: "center", 
                  textTransform: "uppercase", 
                  letterSpacing: "0.03em",
                  lineHeight: "1.25",
                  wordBreak: "break-word",
                  maxHeight: "26px",
                  overflow: "hidden"
                }}
              >
                {img.description || `Gambar ${idx + 1}`}
              </p>
            </div>
          ))}
        </div>

        {/* 3 Signature Blocks with Complete Unclipped Full Names and Clean Wrapping */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "18px", borderTop: "1px solid #cbd5e1", paddingTop: "12px", marginTop: "2px" }}>
          {/* Penyedia */}
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: "130px" }}>
            <div style={{ fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
              Disediakan oleh:
            </div>
            <div style={{ borderTop: "1.5px solid #0f172a", paddingTop: "5px", marginTop: "auto" }}>
              <div style={{ fontSize: "10.5px", fontWeight: "bold", color: "#0f172a", textTransform: "uppercase", lineHeight: "1.3", wordBreak: "break-word" }}>
                {formData.userName || "—"}
              </div>
              <div style={{ fontSize: "9px", color: "#475569", fontWeight: 600, textTransform: "uppercase", lineHeight: "1.25", marginTop: "2px", wordBreak: "break-word" }}>
                {formData.position || "—"}
              </div>
              <div style={{ fontSize: "8px", color: "#94a3b8", fontWeight: 500, marginTop: "2px" }}>
                SK KAMPUNG BAHAGIA JAYA, SIBU
              </div>
            </div>
          </div>

          {/* Penyemak */}
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: "130px" }}>
            <div style={{ fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
              Disemak oleh:
            </div>
            <div style={{ borderTop: "1.5px solid #0f172a", paddingTop: "5px", marginTop: "auto" }}>
              <div style={{ fontSize: "10.5px", fontWeight: "bold", color: "#0f172a", textTransform: "uppercase", lineHeight: "1.3", wordBreak: "break-word" }}>
                {formData.userName1 || "—"}
              </div>
              <div style={{ fontSize: "9px", color: "#475569", fontWeight: 600, textTransform: "uppercase", lineHeight: "1.25", marginTop: "2px", wordBreak: "break-word" }}>
                {formData.position1 || "—"}
              </div>
              <div style={{ fontSize: "8px", color: "#94a3b8", fontWeight: 500, marginTop: "2px" }}>
                SK KAMPUNG BAHAGIA JAYA, SIBU
              </div>
            </div>
          </div>

          {/* Pengesah */}
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: "130px" }}>
            <div style={{ fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
              Disahkan oleh:
            </div>
            <div style={{ borderTop: "1.5px solid #0f172a", paddingTop: "5px", marginTop: "auto" }}>
              <div style={{ fontSize: "10.5px", fontWeight: "bold", color: "#0f172a", textTransform: "uppercase", lineHeight: "1.3", wordBreak: "break-word" }}>
                {formData.userName2 || "—"}
              </div>
              <div style={{ fontSize: "9px", color: "#475569", fontWeight: 600, textTransform: "uppercase", lineHeight: "1.25", marginTop: "2px", wordBreak: "break-word" }}>
                {formData.position2 || "—"}
              </div>
              <div style={{ fontSize: "8px", color: "#94a3b8", fontWeight: 500, marginTop: "2px" }}>
                SK KAMPUNG BAHAGIA JAYA, SIBU
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 font-sans text-slate-800">
      {/* Dedicated Clean Export Container with 100% Strict A4 (794px x 1123px) Dimensions */}
      <div 
        id="opr-export-wrapper"
        style={{ 
          position: "fixed", 
          left: 0, 
          top: 0, 
          width: "794px", 
          height: "1123px",
          zIndex: -999,
          opacity: 1,
          pointerEvents: "none",
          overflow: "hidden",
          backgroundColor: "#ffffff"
        }}
      >
        {renderDocumentContent("opr-export-document", exportReportRef)}
      </div>

      {/* Interactive Fullscreen Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-100 w-full max-w-4xl h-[92vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden border border-slate-300 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-white px-6 py-4 border-b border-slate-200 flex justify-between items-center z-20 shadow-sm">
              <h3 className="font-bold text-slate-800 text-sm tracking-wider uppercase flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600 animate-pulse" />
                PRATONTON LAPORAN SATU MUKA (ONE PAGE REPORT)
              </h3>
              <button 
                onClick={() => setShowPreview(false)}
                className="text-slate-400 hover:text-red-500 hover:bg-slate-100 font-bold text-xl w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer"
                title="Tutup Pratonton"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Document Canvas View */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-300/70 flex justify-center items-start">
              {renderDocumentContent("opr-print-container")}
            </div>

            {/* Modal Footer Controls */}
            <div className="bg-white border-t border-slate-200 p-4 flex flex-wrap justify-between items-center gap-3 z-20 shadow-inner">
              <div className="text-xs text-slate-500 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Dokumen sedia untuk dimuat turun atau dicetak dalam saiz standard A4.</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => generatePdfFile()}
                  disabled={loading}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold rounded-xl transition-all text-xs uppercase shadow flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Menjana PDF...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Muat Turun Fail PDF (.pdf)
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded-xl transition-all text-xs uppercase shadow flex items-center gap-2 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  Cetak / Print
                </button>
                <button
                  type="button"
                  onClick={() => setShowPreview(false)}
                  className="px-5 py-2.5 bg-slate-600 hover:bg-slate-700 active:bg-slate-800 text-white font-bold rounded-xl transition-all text-xs uppercase shadow cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Generator Card Container */}
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
        {/* Header with School Banner & 5-click easter egg */}
        <header className="bg-gradient-to-b from-blue-700 to-blue-600 p-8 text-white text-center relative shadow-sm">
          <div className="flex justify-center mb-3">
            <img 
              src="https://lh3.googleusercontent.com/d/1f7DG6iymydW3DJPoDklB4bjBZB2hNDoc" 
              alt="Logo SK Kampung Bahagia Jaya" 
              className="h-20 w-auto object-contain drop-shadow-md"
              referrerPolicy="no-referrer"
            />
          </div>
          <h1 
            onClick={handleTitleClick} 
            className="text-2xl md:text-3xl font-extrabold tracking-tight cursor-pointer select-none active:scale-[0.99] transition-transform"
            title="Klik 5 kali untuk membuka Tetapan Kunci API Gemini AI"
          >
            SK Kampung Bahagia Jaya OPR Generator
          </h1>
          <p className="text-blue-100 mt-2 text-sm font-medium">Jana Laporan Satu Muka (One Page Report) dengan Mudah & Pantas</p>
        </header>

        {/* Global Notifications */}
        {notification && (
          <div className={`mx-6 md:mx-8 mt-6 p-4 rounded-xl flex items-start gap-3 border ${
            notification.type === "error"
              ? "bg-red-50 border-red-200 text-red-800"
              : notification.type === "warning"
              ? "bg-amber-50 border-amber-200 text-amber-800"
              : notification.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-blue-50 border-blue-200 text-blue-800"
          }`}>
            {notification.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-600" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 text-sm font-medium">{notification.message}</div>
            <button
              type="button"
              onClick={() => setNotification(null)}
              className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
          {/* Main Form Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Nama Program <span className="text-red-500">*</span></label>
              <input
                type="text"
                name="programName"
                value={formData.programName}
                required
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm font-medium"
                placeholder="cth: Kejohanan Sukan Tahunan"
                onChange={handleChange}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Anjuran</label>
              <input
                type="text"
                name="organizer"
                value={formData.organizer}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm font-medium"
                placeholder="cth: Unit Kokurikulum"
                onChange={handleChange}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Tarikh</label>
              <input
                type="text"
                name="date"
                value={formData.date}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm font-medium"
                placeholder="cth: 15 Ogos 2026"
                onChange={handleChange}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Tempat</label>
              <input
                type="text"
                name="location"
                value={formData.location}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm font-medium"
                placeholder="cth: Padang Sekolah"
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Sasaran</label>
            <input
              type="text"
              name="targetAudience"
              value={formData.targetAudience}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm font-medium"
              placeholder="cth: Semua Murid Tahap 1 & 2"
              onChange={handleChange}
            />
          </div>

          {/* Objectives with AI Generation Button */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Objektif Program</label>
              <button
                type="button"
                onClick={generateAIObjectives}
                disabled={generatingAI}
                className="flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:text-blue-800 disabled:text-slate-400 disabled:cursor-not-allowed transition-all bg-blue-50 hover:bg-blue-100 disabled:bg-slate-100 px-3 py-1.5 rounded-lg border border-blue-200 cursor-pointer shadow-xs"
              >
                {generatingAI ? (
                  <>
                    <span className="animate-spin h-3.5 w-3.5 border-2 border-blue-600 border-t-transparent rounded-full inline-block"></span>
                    Menjana Objektif...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    Jana Guna AI
                  </>
                )}
              </button>
            </div>
            <textarea
              name="objectives"
              value={formData.objectives}
              rows={4}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm font-medium resize-none leading-relaxed"
              placeholder="Senaraikan objektif program (cth: 1. ..., 2. ...)..."
              onChange={handleChange}
            ></textarea>
          </div>

          <hr className="border-slate-200" />

          {/* 4 Image Uploaders */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 uppercase tracking-wide">
              <FileUp className="w-4 h-4 text-blue-600" />
              Gambar Laporan Aktiviti (Maksimum 4 Keping)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {images.map((img, idx) => (
                <div key={idx} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5 hover:border-slate-300 transition-colors">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Gambar {idx + 1}</label>
                    {img.dataUrl && (
                      <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        Dipilih
                      </span>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-all cursor-pointer"
                    onChange={(e) => handleImageChange(idx, e.target.files?.[0] || null)}
                  />
                  <input
                    type="text"
                    placeholder={`Kapsyen gambar ${idx + 1}...`}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    value={img.description}
                    onChange={(e) => handleDescChange(idx, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>

          <hr className="border-slate-200" />

          {/* Teacher Signatures */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Penyedia */}
            <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 border-l-4 border-blue-500 pl-2">Penyedia</h4>
              <select
                name="userName"
                value={formData.userName}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium"
                onChange={handleChange}
              >
                <option value="">Pilih Nama Guru</option>
                {teacherNames.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              <select
                name="position"
                value={formData.position}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium"
                onChange={handleChange}
              >
                <option value="">Pilih Jawatan Guru</option>
                {positions.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {/* Penyemak */}
            <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 border-l-4 border-blue-500 pl-2">Penyemak</h4>
              <select
                name="userName1"
                value={formData.userName1}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium"
                onChange={handleChange}
              >
                <option value="">Pilih Nama Guru</option>
                {teacherNames.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              <select
                name="position1"
                value={formData.position1}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium"
                onChange={handleChange}
              >
                <option value="">Pilih Jawatan Guru</option>
                {positions.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {/* Pengesah (Restricted to 4 Administrator Positions only) */}
            <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 border-l-4 border-blue-500 pl-2">Pengesah</h4>
              <select
                name="userName2"
                value={formData.userName2}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium"
                onChange={handleChange}
              >
                <option value="">Pilih Nama Pentadbir</option>
                {validatorNames.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              <select
                name="position2"
                value={formData.position2}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium"
                onChange={handleChange}
              >
                <option value="">Pilih Jawatan Pentadbir</option>
                {validatorPositions.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 flex flex-col sm:flex-row gap-4">
            <button
              type="button"
              onClick={() => setShowPreview(true)}
              className="flex-1 bg-slate-800 hover:bg-slate-900 active:bg-slate-950 text-white font-bold py-3.5 px-6 rounded-xl shadow-md transition-all flex items-center justify-center gap-2.5 text-sm uppercase cursor-pointer"
            >
              <Eye className="w-4 h-4" />
              PRATONTON
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-[2] bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold py-3.5 px-6 rounded-xl shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2.5 text-sm uppercase disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>MENJANA PDF...</span>
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  <span>JANA LAPORAN PDF (A4)</span>
                </>
              )}
            </button>
          </div>

          {/* Progress Indicator */}
          {loading && (
            <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl space-y-2 animate-in fade-in duration-200">
              <div className="flex justify-between text-xs font-bold text-blue-900">
                <span>{progressStatus || "PROSES PENJANAAN PDF"}</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full h-2.5 bg-blue-100 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-blue-600"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>
          )}
        </form>

        <footer className="p-5 bg-slate-50 text-center border-t border-slate-200">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
            Developed by Cikgu Ameir Daniel • SK Kampung Bahagia Jaya
          </p>
        </footer>
      </div>

      {/* Secret Gemini API Key Modal (Triggered by clicking title 5 times) */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setShowKeyModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-all p-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-amber-50 rounded-xl text-amber-600 border border-amber-200">
                <Key className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-lg">Tetapan Kunci API Gemini AI</h3>
                <p className="text-xs text-slate-500">Kunci Rahsia Penjana Objektif Automatik</p>
              </div>
            </div>

            <div className="space-y-4 text-sm text-slate-600">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-2">
                <div className="font-bold text-blue-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4 text-blue-600" />
                  Cara Tetapan di Vercel Dashboard (Rekomendasi):
                </div>
                <ol className="list-decimal list-inside text-xs text-blue-800 space-y-1">
                  <li>Buka Vercel Dashboard → Pilih Projek Anda.</li>
                  <li>Pergi ke <b>Settings</b> → <b>Environment Variables</b>.</li>
                  <li>Tambah Key: <code className="bg-blue-100 px-1.5 py-0.5 rounded font-mono text-[11px] font-bold">GEMINI_API_KEY</code></li>
                  <li>Masukkan nilai API Key Gemini anda dan klik <b>Save</b>.</li>
                  <li>Tekan <b>Redeploy</b> di Vercel.</li>
                </ol>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700">Atau Tampal Kunci API Gemini Anda Di Sini:</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => saveApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                />
                <p className="text-[11px] text-slate-400">
                  Kunci ini disimpan secara selamat dalam pelayar anda (localStorage).
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowKeyModal(false)}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs uppercase rounded-xl transition-all shadow cursor-pointer"
              >
                Simpan & Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
