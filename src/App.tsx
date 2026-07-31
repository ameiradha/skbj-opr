import React, { useState, useEffect } from "react";
import axios from "axios";
import { motion } from "motion/react";
import { FileUp, FileText, Loader2, Sparkles, Key, Settings, X, Check, HelpCircle } from "lucide-react";

interface ImageData {
  name: string;
  data: string;
  description: string;
}

export default function App() {
  useEffect(() => {
    document.title = "SKBJ OPR Generator";
  }, []);

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
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

  const [images, setImages] = useState<({ file: File | null; description: string })[]>([
    { file: null, description: "" },
    { file: null, description: "" },
    { file: null, description: "" },
    { file: null, description: "" },
  ]);

  const [showPreview, setShowPreview] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("GEMINI_API_KEY") || "");
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [titleClicks, setTitleClicks] = useState(0);

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
      alert("Sila masukkan nama program terlebih dahulu sebelum menjana objektif.");
      return;
    }
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
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleImageChange = (index: number, file: File | null) => {
    const newImages = [...images];
    newImages[index].file = file;
    setImages(newImages);
  };

  const handleDescChange = (index: number, description: string) => {
    const newImages = [...images];
    newImages[index].description = description;
    setImages(newImages);
  };

  const getImageUrl = (file: File | null) => {
    if (!file) return "";
    return URL.createObjectURL(file);
  };

  const compressImage = (file: File, maxWidth = 600, quality = 0.5): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const scale = maxWidth / img.width;
          if (img.width > maxWidth) {
            canvas.width = maxWidth;
            canvas.height = img.height * scale;
          } else {
            canvas.width = img.width;
            canvas.height = img.height;
          }

          const ctx = canvas.getContext("2d");
          if (!ctx) return reject("Failed to get canvas context");
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          const compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
          resolve(compressedDataUrl.split(",")[1]); // Return base64 only
        };
        img.src = event.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setProgress(30);

    try {
      const processedImages: ImageData[] = [];
      for (const img of images) {
        if (img.file) {
          const base64 = await compressImage(img.file);
          processedImages.push({
            name: img.file.name,
            data: base64,
            description: img.description,
          });
        }
      }

      setProgress(60);

      const response = await fetch("/api/generate-pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/pdf"
        },
        body: JSON.stringify({ formData, imagesData: processedImages })
      });

      setProgress(90);

      if (!response.ok) {
        const text = await response.text();
        let errMsg = "Gagal menjana PDF";
        try {
          const errorData = JSON.parse(text);
          errMsg = errorData.details || errorData.error || errMsg;
        } catch (_) {}
        throw new Error(errMsg);
      }

      const blob = await response.blob();

      // Verify the response is actually a PDF
      if (blob.type !== "application/pdf") {
        throw new Error("Format fail yang diterima bukan PDF");
      }

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${formData.programName || "Program"}_Report.pdf`);
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        link.remove();
      }, 100);

      setProgress(100);
      setTimeout(() => {
        setLoading(false);
        setProgress(0);
      }, 1000);
    } catch (error: any) {
      console.error("Error generating PDF:", error);
      alert(`Gagal menjana PDF: ${error.message || "Sila cuba lagi."}`);
      setLoading(false);
      setProgress(0);
    }
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

  const Preview = () => (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-slate-100 w-full max-w-4xl h-[90vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Sticky Header */}
        <div className="bg-white px-6 py-4 border-b border-slate-200 flex justify-between items-center z-20 shadow-sm">
          <h3 className="font-bold text-slate-700 text-sm tracking-wider uppercase flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600 animate-pulse" />
            PRATONTON LAPORAN (ONE PAGE REPORT)
          </h3>
          <button 
            onClick={() => setShowPreview(false)}
            className="text-slate-400 hover:text-red-500 hover:bg-slate-100 font-bold text-xl w-8 h-8 rounded-full flex items-center justify-center transition-all focus:outline-none"
            title="Tutup Pratonton"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Document Area */}
        <div className="flex-1 overflow-y-auto p-8 bg-slate-200 flex justify-center">
          <div className="p-8 bg-white text-slate-900 min-h-[1122px] w-[794px] shadow-lg border border-slate-200 relative overflow-hidden my-4 shrink-0">
            {/* Background Placeholder */}
            <div className="absolute inset-0 opacity-10 pointer-events-none flex items-center justify-center">
              <div className="w-[120%] h-[120%] rotate-12 border-[40px] border-blue-50"></div>
            </div>

            <div className="relative z-10">
              {/* Header/Logo Banner */}
              <div className="text-center mb-6 pb-4 border-b border-slate-100">
                 <img 
                   src="https://lh3.googleusercontent.com/d/15BJ119qQWyBepLyaVjP4IOk-EbIgovP-=w1920" 
                   alt="Header Banner" 
                   className="w-full h-auto max-h-24 object-contain"
                 />
              </div>

              <div className="space-y-4 text-[13px] leading-relaxed">
                <div className="grid grid-cols-[100px_1fr] gap-4">
                  <span className="font-bold text-slate-500 uppercase text-[11px]">Program:</span>
                  <span className="font-medium">{formData.programName || "—"}</span>
                </div>
                <div className="grid grid-cols-[100px_1fr] gap-4">
                  <span className="font-bold text-slate-500 uppercase text-[11px]">Anjuran:</span>
                  <span className="font-medium">{formData.organizer || "—"}</span>
                </div>
                <div className="grid grid-cols-[100px_1fr] gap-4">
                  <span className="font-bold text-slate-500 uppercase text-[11px]">Tarikh:</span>
                  <span className="font-medium">{formData.date || "—"}</span>
                </div>
                <div className="grid grid-cols-[100px_1fr] gap-4">
                  <span className="font-bold text-slate-500 uppercase text-[11px]">Tempat:</span>
                  <span className="font-medium">{formData.location || "—"}</span>
                </div>
                <div className="grid grid-cols-[100px_1fr] gap-4">
                  <span className="font-bold text-slate-500 uppercase text-[11px]">Sasaran:</span>
                  <span className="font-medium">{formData.targetAudience || "—"}</span>
                </div>
                <div className="mt-8 pt-4 border-t border-slate-50">
                  <div className="font-bold text-slate-500 uppercase text-[11px] mb-2">Objektif:</div>
                  <div className="whitespace-pre-wrap pl-4 border-l-2 border-blue-200 text-slate-700 italic bg-slate-50/50 p-4 rounded-r-lg">
                    {formData.objectives || "Tiada objektif dinyatakan."}
                  </div>
                </div>
              </div>

              {/* Images Grid */}
              <div className="mt-12 grid grid-cols-2 gap-10">
                {images.map((img, idx) => (
                  img.file ? (
                    <div key={idx} className="space-y-3">
                      <div className="aspect-[4/3] bg-slate-50 rounded-lg overflow-hidden border border-slate-200 shadow-sm">
                        <img 
                          src={URL.createObjectURL(img.file)} 
                          alt={`Preview ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <p className="text-[10px] font-bold text-slate-400 text-center uppercase tracking-widest">{img.description || `Kapsyen Gambar ${idx + 1}`}</p>
                    </div>
                  ) : null
                ))}
              </div>

              {/* Signatures */}
              <div className="mt-24 grid grid-cols-3 gap-12 border-t border-slate-50 pt-10">
                <div className="space-y-16">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Disediakan oleh:</div>
                  <div className="pt-2 border-t border-slate-900">
                    <div className="text-[12px] font-bold text-slate-900">{formData.userName || "—"}</div>
                    <div className="text-[9px] text-slate-500 font-medium">{formData.position || "—"}</div>
                    <div className="text-[8px] text-slate-400 mt-1">SK KAMPUNG BAHAGIA JAYA, SIBU</div>
                  </div>
                </div>
                <div className="space-y-16">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Disemak oleh:</div>
                  <div className="pt-2 border-t border-slate-900">
                    <div className="text-[12px] font-bold text-slate-900">{formData.userName1 || "—"}</div>
                    <div className="text-[9px] text-slate-500 font-medium">{formData.position1 || "—"}</div>
                    <div className="text-[8px] text-slate-400 mt-1">SK KAMPUNG BAHAGIA JAYA, SIBU</div>
                  </div>
                </div>
                <div className="space-y-16">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Disahkan oleh:</div>
                  <div className="pt-2 border-t border-slate-900">
                    <div className="text-[12px] font-bold text-slate-900">{formData.userName2 || "—"}</div>
                    <div className="text-[9px] text-slate-500 font-medium">{formData.position2 || "—"}</div>
                    <div className="text-[8px] text-slate-400 mt-1">SK KAMPUNG BAHAGIA JAYA, SIBU</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="bg-white border-t border-slate-200 p-4 flex justify-end gap-3 z-20 shadow-inner">
          <button
            onClick={() => setShowPreview(false)}
            className="px-6 py-2.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold rounded-xl transition-all text-sm uppercase shadow"
          >
            Tutup Pratonton
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 font-sans">
      {showPreview && <Preview />}
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden border border-slate-200">
        <header className="bg-blue-600 p-8 text-white text-center">
          <h1 
            onClick={handleTitleClick} 
            className="text-2xl font-bold tracking-tight cursor-pointer select-none active:scale-[0.99] transition-transform"
            title="SK Kampung Bahagia Jaya OPR Generator"
          >
            SK Kampung Bahagia Jaya OPR Generator
          </h1>
          <p className="text-blue-100 mt-2 opacity-90">Jana Laporan Satu Muka (One Page Report) dengan Mudah</p>
        </header>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Nama Program</label>
              <input
                type="text"
                name="programName"
                className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                placeholder="cth: Kejohanan Sukan Tahunan"
                onChange={handleChange}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Anjuran</label>
              <input
                type="text"
                name="organizer"
                className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                placeholder="cth: Unit Kokurikulum"
                onChange={handleChange}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Tarikh</label>
              <input
                type="text"
                name="date"
                className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                placeholder="cth: 15 Ogos 2026"
                onChange={handleChange}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Tempat</label>
              <input
                type="text"
                name="location"
                className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                placeholder="cth: Padang Sekolah"
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Sasaran</label>
            <input
              type="text"
              name="targetAudience"
              className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              placeholder="cth: Semua Murid Tahap 1 & 2"
              onChange={handleChange}
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-sm font-semibold text-slate-700">Objektif</label>
              <button
                type="button"
                onClick={generateAIObjectives}
                disabled={generatingAI}
                className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 disabled:text-slate-400 disabled:cursor-not-allowed transition-all bg-blue-50 hover:bg-blue-100 disabled:bg-slate-50 px-2.5 py-1 rounded-md cursor-pointer"
              >
                {generatingAI ? (
                  <>
                    <span className="animate-spin h-3 w-3 border-2 border-blue-600 border-t-transparent rounded-full inline-block"></span>
                    Menjana...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    Jana Guna AI
                  </>
                )}
              </button>
            </div>
            <textarea
              name="objectives"
              value={formData.objectives}
              rows={4}
              className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none"
              placeholder="Senaraikan objektif program..."
              onChange={handleChange}
            ></textarea>
          </div>

          <hr className="border-slate-200" />

          <div className="space-y-4">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <FileUp className="w-5 h-5 text-blue-600" />
              Gambar Laporan (Maksimum 4)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {images.map((img, idx) => (
                <div key={idx} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Gambar {idx + 1}</label>
                  <input
                    type="file"
                    accept="image/*"
                    className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-all"
                    onChange={(e) => handleImageChange(idx, e.target.files?.[0] || null)}
                  />
                  <input
                    type="text"
                    placeholder="Penerangan gambar..."
                    className="w-full px-3 py-1.5 text-sm rounded border border-slate-300 outline-none focus:ring-1 focus:ring-blue-500"
                    value={img.description}
                    onChange={(e) => handleDescChange(idx, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>

          <hr className="border-slate-200" />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-slate-800 border-l-4 border-blue-500 pl-2">Penyedia</h4>
              <select
                name="userName"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
                onChange={handleChange}
              >
                <option value="">Pilih Nama</option>
                {teacherNames.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              <select
                name="position"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
                onChange={handleChange}
              >
                <option value="">Pilih Jawatan</option>
                {positions.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-bold text-slate-800 border-l-4 border-blue-500 pl-2">Penyemak</h4>
              <select
                name="userName1"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
                onChange={handleChange}
              >
                <option value="">Pilih Nama</option>
                {teacherNames.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              <select
                name="position1"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
                onChange={handleChange}
              >
                <option value="">Pilih Jawatan</option>
                {positions.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-bold text-slate-800 border-l-4 border-blue-500 pl-2">Pengesah</h4>
              <select
                name="userName2"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
                onChange={handleChange}
              >
                <option value="">Pilih Nama</option>
                {validatorNames.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              <select
                name="position2"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
                onChange={handleChange}
              >
                <option value="">Pilih Jawatan</option>
                {positions.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="pt-4 flex flex-col md:flex-row gap-4">
            <button
              type="button"
              onClick={() => setShowPreview(true)}
              className="flex-1 bg-slate-800 hover:bg-slate-900 text-white font-bold py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-3"
            >
              <FileUp className="w-5 h-5" />
              PRATONTON
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  MENJANA PDF...
                </>
              ) : (
                <>
                  <FileText className="w-5 h-5" />
                  JANA LAPORAN PDF
                </>
              )}
            </button>

            {loading && (
              <div className="mt-6 space-y-2">
                <div className="flex justify-between text-xs font-bold text-slate-500">
                  <span>PROSES PENJANAAN</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-blue-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>
            )}
          </div>
        </form>

        <footer className="p-6 bg-slate-50 text-center border-t border-slate-200">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-widest">
            Developed by Cikgu Ameir Daniel
          </p>
        </footer>
      </div>

      {showKeyModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 relative">
            <button
              onClick={() => setShowKeyModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-all p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-amber-50 rounded-xl text-amber-600">
                <Key className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-lg">Tetapan Kunci API Gemini AI</h3>
                <p className="text-xs text-slate-500">Sokongan Penjana Objektif di Vercel</p>
              </div>
            </div>

            <div className="space-y-4 text-sm text-slate-600">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-2">
                <div className="font-bold text-blue-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4 text-blue-600" />
                  Cara Set di Vercel Dashboard (Rekomendasi):
                </div>
                <ol className="list-decimal list-inside text-xs text-blue-800 space-y-1">
                  <li>Buka Vercel Dashboard → Pilih Projek Ini.</li>
                  <li>Pergi ke <b>Settings</b> → <b>Environment Variables</b>.</li>
                  <li>Tambah Key: <code className="bg-blue-100 px-1 py-0.5 rounded font-mono text-[11px]">GEMINI_API_KEY</code></li>
                  <li>Masukkan nilai API Key Gemini anda dan klik <b>Save</b>.</li>
                  <li>Tekan <b>Redeploy</b> projek anda di Vercel.</li>
                </ol>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700">Atau Tampal Kunci API Gemini Anda Di Sini:</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => saveApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full px-4 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                />
                <p className="text-[11px] text-slate-400">
                  Kunci ini disimpan secara selamat dalam pelayar anda (localStorage).
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowKeyModal(false)}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all shadow"
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
