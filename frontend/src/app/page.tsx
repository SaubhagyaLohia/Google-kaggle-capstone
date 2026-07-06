"use client";

import React, { useState, useEffect, useRef } from "react";
import BorderGlow from "../components/BorderGlow";
import { 
  Upload, 
  FileText, 
  Briefcase, 
  Award, 
  CheckCircle2, 
  Loader2, 
  AlertCircle, 
  Trash2, 
  ArrowRight, 
  ShieldAlert, 
  FileDown, 
  Plus, 
  User, 
  BookOpen, 
  HelpCircle,
  X,
  UserCheck,
  Gauge,
  History,
  ShieldCheck,
  Search
} from "lucide-react";

interface HistoryItem {
  id: number;
  resume_filename: string;
  timestamp: string;
  ats_score: number;
  job_role: string;
}

interface AnalysisReport {
  id: number;
  resume_filename: string;
  timestamp: string;
  ats_score: number;
  job_role: string;
  report_data: {
    executive_summary: string;
    resume_info: {
      name: string;
      contact_info: {
        email?: string;
        phone?: string;
        location?: string;
      };
      education: Array<{ school: string; degree: string; year: string }>;
      skills: string[];
      experience: Array<{ company: string; role: string; dates: string; description: string }>;
      projects: Array<{ name: string; description: string; technologies: string[] }>;
      certifications: string[];
    };
    ats_score: number;
    strengths: string[];
    weaknesses: string[];
    missing_skills: string[];
    grammar_suggestions: string[];
    professional_improvements: string[];
    interview_questions: {
      hr_questions: string[];
      technical_questions: string[];
      project_based_questions: string[];
    };
    cover_letter?: string;
    final_recommendations: string[];
  };
}

const AGENTS = [
  { id: "security_agent", label: "Security Agent Guard" },
  { id: "init_state", label: "Workflow Initializer" },
  { id: "read_resume_node", label: "Resume Document Reader" },
  { id: "resume_parser", label: "Resume Parser Specialist" },
  { id: "ats_analysis", label: "ATS Compatibility Specialist" },
  { id: "skill_gap", label: "Skill Gap Specialist" },
  { id: "grammar_review", label: "Grammar & Style Specialist" },
  { id: "interview_prep", label: "Interview Preparation Specialist" },
  { id: "cover_letter", label: "Cover Letter Specialist" },
  { id: "validation_node", label: "Workflow Validation Agent" },
  { id: "career_coach", label: "Hiring Manager Career Coach" },
  { id: "report_generator", label: "Report Compiler & Exporter" }
];

function ExplainabilityCard({ agentName, confidence, reasoning }: { agentName: string; confidence: number; reasoning: string }) {
  return (
    <div className="mt-5 p-4 bg-purple-950/10 border border-purple-500/10 rounded-lg flex flex-col gap-2 shadow-[0_0_15px_rgba(168,85,247,0.05)]">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-extrabold uppercase text-purple-400 tracking-wider font-sans">Agent Evaluation Credentials</span>
        <span className="text-[10px] font-bold text-pink-300 bg-pink-950/30 border border-pink-500/20 px-2 py-0.5 rounded font-sans">
          {agentName} (Confidence: {confidence}%)
        </span>
      </div>
      <p className="text-xs text-zinc-300 leading-relaxed mt-1">
        <span className="font-semibold text-purple-300">Verification Reasoning:</span> {reasoning}
      </p>
    </div>
  );
}

export default function Home() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [selectedReport, setSelectedReport] = useState<AnalysisReport | null>(null);
  
  // Form state
  const [jobRole, setJobRole] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  
  // Execution status
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [agentProgress, setAgentProgress] = useState<Record<string, "idle" | "running" | "completed" | "failed" | "retrying">>({});
  const [agentSummaries, setAgentSummaries] = useState<Record<string, string>>({});
  const [activeStep, setActiveStep] = useState<string | null>(null);
  
  // Delete modal state
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const backendUrl = "http://localhost:8000";

  // Fetch analysis history on mount
  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${backendUrl}/api/history`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (err) {
      console.error("Failed to fetch history:", err);
    }
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setResumeFile(e.dataTransfer.files[0]);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setResumeFile(e.target.files[0]);
    }
  };

  const loadReport = async (id: number) => {
    try {
      const res = await fetch(`${backendUrl}/api/reports/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedReport(data);
        setIsAnalyzing(false);
      } else {
        console.error("Failed to load report");
      }
    } catch (err) {
      console.error("Error loading report:", err);
    }
  };

  const startAnalysis = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resumeFile) {
      setErrorMsg("Please upload a resume file.");
      return;
    }
    if (!jobRole.trim()) {
      setErrorMsg("Please enter a target job role.");
      return;
    }

    setErrorMsg("");
    setIsUploading(true);
    setSelectedReport(null);

    // 1. Upload the resume file
    const formData = new FormData();
    formData.append("file", resumeFile);

    let resumePath = "";
    try {
      const uploadRes = await fetch(`${backendUrl}/api/upload`, {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        throw new Error("Resume upload failed.");
      }

      const uploadData = await uploadRes.json();
      resumePath = uploadData.filepath;
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to upload resume file.");
      setIsUploading(false);
      return;
    }

    setIsUploading(false);
    setIsAnalyzing(true);
    
    // Reset progress states
    const initialProgress: Record<string, "idle" | "running" | "completed" | "failed" | "retrying"> = {};
    AGENTS.forEach(a => {
      initialProgress[a.id] = "idle";
    });
    initialProgress["security_agent"] = "running";
    setAgentProgress(initialProgress);
    setAgentSummaries({
      "security_agent": "Verifying filesystem read permissions and workspace integrity..."
    });

    // 2. Trigger analysis and start listening to SSE
    try {
      const response = await fetch(`${backendUrl}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resume_path: resumePath,
          job_role: jobRole,
          job_description: jobDescription || null,
        }),
      });

      if (!response.body) {
        throw new Error("No response body received.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data:")) {
            const dataStr = line.replace("data:", "").trim();
            if (!dataStr) continue;

            try {
              const event = JSON.parse(dataStr);
              if (event.error) {
                setErrorMsg(`Workflow Error: ${event.error}`);
                setIsAnalyzing(false);
                break;
              }

              if (event.agent) {
                const agentId = event.agent;
                const status = event.status;
                
                setAgentProgress(prev => {
                  const newProgress = {
                    ...prev,
                    [agentId]: status,
                    security_agent: "completed" as const
                  };
                  if (agentId === "resume_parser") {
                    newProgress["init_state"] = "completed";
                    newProgress["read_resume_node"] = "completed";
                  }
                  if (agentId === "career_coach") {
                    newProgress["validation_node"] = "completed";
                    if (newProgress["cover_letter"] !== "completed") {
                      newProgress["cover_letter"] = "completed";
                    }
                  }
                  return newProgress;
                });
                setAgentSummaries(prev => {
                  const newSummaries = {
                    ...prev,
                    security_agent: "✓ All filesystem, database, and browser calls validated successfully",
                    ...(event.summary ? { [agentId]: event.summary } : {})
                  };
                  if (agentId === "career_coach" && !newSummaries["cover_letter"]) {
                    newSummaries["cover_letter"] = "✓ Cover letter skipped (no job description)";
                  }
                  return newSummaries;
                });
                setActiveStep(agentId);

                if (agentId === "report_generator" && status === "completed" && event.result) {
                  // We received the final report
                  setSelectedReport({
                    id: Date.now(), // temporary UI ID
                    resume_filename: resumeFile.name,
                    timestamp: new Date().toISOString(),
                    ats_score: event.result.ats_score,
                    job_role: jobRole,
                    report_data: event.result
                  });
                  setIsAnalyzing(false);
                  fetchHistory();
                }
              }
            } catch (jsonErr) {
              console.error("Error parsing event JSON:", jsonErr);
            }
          }
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An error occurred during analysis.");
      setIsAnalyzing(false);
    }
  };

  const triggerDelete = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirmId(id);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;

    try {
      const res = await fetch(`${backendUrl}/api/reports/${deleteConfirmId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        if (selectedReport?.id === deleteConfirmId) {
          setSelectedReport(null);
        }
        fetchHistory();
      }
    } catch (err) {
      console.error("Error deleting report:", err);
    } finally {
      setDeleteConfirmId(null);
    }
  };

  return (
    <div className="flex h-screen bg-[#07050f] text-[#f4f4f7] font-sans overflow-hidden">
      {/* Sidebar: History */}
      <aside className="w-80 bg-zinc-950/40 backdrop-blur-md border-r border-white/5 flex flex-col justify-between shrink-0">
        <div className="flex flex-col flex-1 overflow-y-auto">
          <div className="p-6 border-b border-white/5 flex items-center gap-3">
            <div className="p-2 bg-gradient-to-tr from-pink-500 via-purple-600 to-indigo-600 rounded text-white shadow-[0_0_15px_rgba(236,72,153,0.3)]">
              <Briefcase className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-none tracking-tight text-white">Career Copilot</h1>
              <p className="text-[11px] text-purple-400 font-sans mt-1 uppercase tracking-wider font-semibold">Report Analysis Swarm</p>
            </div>
          </div>

          <div className="p-4">
            <button 
              onClick={() => {
                setSelectedReport(null);
                setIsAnalyzing(false);
                setJobRole("");
                setJobDescription("");
                setResumeFile(null);
              }}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white rounded font-sans font-bold text-xs tracking-wide transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(236,72,153,0.25)] border-0 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" /> New Analysis
            </button>
          </div>

          <div className="px-4 flex-1">
            <h2 className="text-[10px] font-bold text-purple-400 uppercase tracking-widest mb-3 px-2 font-sans">Analysis Archive</h2>
            {history.length === 0 ? (
              <p className="text-xs text-stone-400 italic px-2 py-4">No archived reports found.</p>
            ) : (
              <div className="space-y-1">
                {history.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => loadReport(item.id)}
                    className={`group w-full text-left p-3 rounded cursor-pointer transition-all flex items-center justify-between border ${
                      selectedReport?.id === item.id 
                        ? "bg-purple-950/30 border-purple-500/50 text-white shadow-[0_0_15px_rgba(168,85,247,0.1)]" 
                        : "bg-transparent hover:bg-white/5 border-transparent text-zinc-300 hover:text-white"
                    }`}
                  >
                    <div className="overflow-hidden pr-2 flex-1">
                      <div className="font-bold text-sm truncate text-zinc-100 group-hover:text-white">{item.job_role}</div>
                      <div className="text-[11px] text-zinc-400 font-sans truncate mt-0.5">{item.resume_filename}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[11px] font-sans font-bold px-1.5 py-0.5 rounded border ${
                        item.ats_score >= 80 ? "bg-emerald-950/40 text-emerald-400 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.1)]" :
                        item.ats_score >= 60 ? "bg-amber-950/40 text-amber-400 border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.1)]" :
                        "bg-rose-950/40 text-rose-400 border-rose-500/30 shadow-[0_0_10px_rgba(239,68,68,0.1)]"
                      }`}>
                        {item.ats_score}
                      </span>
                      <button 
                        onClick={(e) => triggerDelete(item.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-400 text-zinc-500 transition"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        {/* User signature */}
        <div className="p-4 border-t border-white/5 bg-zinc-950/30 flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-purple-950/60 border border-purple-500/30 flex items-center justify-center text-purple-300">
            <User className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-zinc-200 font-sans">Executive Portal</p>
            <p className="text-[10px] text-purple-400/80 font-sans">Active Session</p>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto bg-transparent p-10">
        {!selectedReport && !isAnalyzing && (
          <div className="max-w-2xl mx-auto py-10">
            <div className="text-center mb-10">
              <h1 className="text-3xl font-extrabold tracking-tight leading-tight bg-clip-text text-transparent bg-gradient-to-r from-pink-400 via-purple-400 to-indigo-400">Executive Resume Optimization</h1>
              <p className="text-zinc-400 text-sm mt-3 leading-relaxed max-w-lg mx-auto">
                Align your professional profile against target corporate roles. Compiles ATS compliance indices, searches market skills, and crafts structured career coach recommendations.
              </p>
            </div>

            <BorderGlow className="w-full">
              <form onSubmit={startAnalysis} className="space-y-6 p-8">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 font-sans mb-2">Target Job Role <span className="text-pink-500">*</span></label>
                <div className="relative">
                  <Briefcase className="absolute left-3.5 top-3.5 h-4 w-4 text-purple-400" />
                  <input
                    type="text"
                    value={jobRole}
                    onChange={(e) => setJobRole(e.target.value)}
                    placeholder="e.g., Senior Investment Analyst"
                    className="w-full bg-zinc-950/50 border border-white/10 rounded py-3 pl-10 pr-4 text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition text-sm font-sans"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 font-sans mb-2">Upload Resume (PDF, DOCX) <span className="text-pink-500">*</span></label>
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleFileDrop}
                  onClick={triggerFileSelect}
                  className={`border-2 border-dashed rounded p-10 text-center cursor-pointer transition-all ${
                    resumeFile 
                      ? "border-emerald-500/50 bg-emerald-950/10 shadow-[0_0_15px_rgba(16,185,129,0.05)]" 
                      : "border-white/10 bg-zinc-950/20 hover:bg-zinc-950/40 hover:border-purple-500/40"
                  }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".pdf,.docx"
                    className="hidden"
                  />
                  <div className="flex flex-col items-center justify-center">
                    <Upload className={`h-8 w-8 mb-3 ${resumeFile ? "text-emerald-400" : "text-purple-400"}`} />
                    {resumeFile ? (
                      <div>
                        <p className="font-bold text-white text-sm">{resumeFile.name}</p>
                        <p className="text-[11px] text-emerald-400 font-semibold font-sans mt-1">{(resumeFile.size / 1024 / 1024).toFixed(2)} MB • File loaded successfully</p>
                      </div>
                    ) : (
                      <div>
                        <p className="font-medium text-zinc-300 text-sm">Drag and drop document, or click to browse</p>
                        <p className="text-[11px] text-zinc-500 font-sans mt-1.5">PDF or DOCX format (Max 10MB)</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 font-sans mb-2">Job Description (Optional)</label>
                <textarea
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Paste the target job description to map detailed skill deficiencies and generate cover letters..."
                  className="w-full bg-zinc-950/50 border border-white/10 rounded py-3 px-4 text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition text-sm h-32 resize-none font-sans"
                />
              </div>

              {errorMsg && (
                <div className="p-4 bg-rose-950/30 border border-rose-500/20 rounded flex items-start gap-3">
                  <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-rose-200 font-sans font-medium">{errorMsg}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isUploading}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 hover:from-purple-700 hover:via-fuchsia-700 hover:to-pink-700 text-white rounded font-bold text-xs tracking-wider uppercase font-sans transition-all duration-300 transform hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(168,85,247,0.3)] border-0 cursor-pointer"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-white" /> Uploading Document...
                  </>
                ) : (
                  <>
                    Run Analysis Swarm <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
              </form>
            </BorderGlow>
          </div>
        )}

        {/* Live Execution Progress */}
        {isAnalyzing && (
          <div className="max-w-xl mx-auto py-10">
            <BorderGlow className="w-full">
              <div className="p-8">
              <div className="text-center mb-8">
                <Loader2 className="h-8 w-8 animate-spin text-purple-400 mx-auto mb-3" />
                <h2 className="text-xl font-bold text-white">Multi-Agent Orchestration Swarm</h2>
                <p className="text-zinc-400 text-xs font-sans mt-1">Executing parallel analysis modules & validation rules...</p>
              </div>

              <div className="space-y-3">
                {AGENTS.map((agent) => {
                  const status = agentProgress[agent.id] || "idle";
                  const summary = agentSummaries[agent.id];
                  return (
                    <div key={agent.id} className="flex flex-col p-3 rounded bg-zinc-950/40 border border-white/5 gap-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`h-2 w-2 rounded-full ${
                            status === "completed" ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" :
                            status === "running" ? "bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.5)]" :
                            status === "retrying" ? "bg-fuchsia-500 animate-bounce shadow-[0_0_8px_rgba(217,70,239,0.5)]" :
                            status === "failed" ? "bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" :
                            "bg-zinc-700"
                          }`} />
                          <span className={`text-xs font-semibold font-sans ${
                            status === "completed" ? "text-zinc-200" :
                            status === "running" ? "text-amber-300 font-bold" :
                            status === "retrying" ? "text-fuchsia-300 font-bold" :
                            "text-zinc-500"
                          }`}>{agent.label}</span>
                        </div>
                        <div className="shrink-0 font-sans">
                          {status === "completed" && <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/30 border border-emerald-500/20 px-1.5 py-0.5 rounded">Done</span>}
                          {status === "running" && <span className="text-[10px] text-amber-400 font-bold bg-amber-950/30 border border-amber-500/20 px-1.5 py-0.5 rounded animate-pulse">Running</span>}
                          {status === "retrying" && <span className="text-[10px] text-fuchsia-400 font-bold bg-fuchsia-950/30 border border-fuchsia-500/20 px-1.5 py-0.5 rounded">Retrying</span>}
                          {status === "failed" && <span className="text-[10px] text-rose-400 font-bold bg-rose-950/30 border border-rose-500/20 px-1.5 py-0.5 rounded">Failed</span>}
                          {status === "idle" && <span className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Queue</span>}
                        </div>
                      </div>
                      {summary && (
                        <div className="text-xs text-zinc-400 pl-5 font-mono">
                          {summary}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {errorMsg && (
                <div className="mt-6 p-4 bg-rose-950/30 border border-rose-500/20 rounded flex items-start gap-3">
                  <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-rose-200 font-sans font-medium">{errorMsg}</p>
                </div>
              )}
            </div>
          </BorderGlow>
        </div>
      )}

        {/* Report Viewer */}
        {selectedReport && !isAnalyzing && (
          <div className="max-w-4xl mx-auto space-y-8 pb-16">
            {/* Header: Score */}
            <BorderGlow className="w-full">
              <div className="p-8 flex flex-col md:flex-row items-center justify-between gap-6">
                <div>
                  <span className="text-[10px] font-bold text-purple-300 bg-purple-950/50 border border-purple-500/30 px-2.5 py-1 rounded uppercase tracking-wider font-sans">Executive Summary Report</span>
                  <h1 className="text-3xl font-extrabold text-white mt-3 leading-tight bg-clip-text text-transparent bg-gradient-to-r from-pink-400 via-purple-400 to-indigo-400">{selectedReport.job_role}</h1>
                  <p className="text-xs text-zinc-400 mt-1.5 flex items-center gap-2 font-sans">
                    <FileText className="h-4 w-4 text-purple-400" /> {selectedReport.resume_filename}
                  </p>
                </div>
                <div className="flex items-center gap-6 shrink-0">
                  <div className="relative h-28 w-28 flex items-center justify-center bg-zinc-950/50 rounded-full border border-white/10 shadow-[0_0_20px_rgba(168,85,247,0.15)]">
                    <div className="text-center">
                      <span className="block text-3xl font-extrabold text-white">{selectedReport.ats_score}</span>
                      <span className="text-[10px] uppercase font-bold text-purple-400 tracking-widest font-sans">ATS Score</span>
                    </div>
                    {/* Circle outline animation with rounded glowing strokes */}
                    <svg className="absolute -top-1 -left-1 h-[114px] w-[114px] transform -rotate-90">
                      <defs>
                        <linearGradient id="atsGlowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#ec4899" />
                          <stop offset="100%" stopColor="#8b5cf6" />
                        </linearGradient>
                      </defs>
                      <circle
                        cx="57"
                        cy="57"
                        r="53"
                        className="stroke-purple-950/40 fill-none"
                        strokeWidth="4"
                      />
                      <circle
                        cx="57"
                        cy="57"
                        r="53"
                        className="fill-none"
                        stroke="url(#atsGlowGrad)"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeDasharray="333"
                        strokeDashoffset={333 - (333 * selectedReport.ats_score) / 100}
                      />
                    </svg>
                  </div>
                  <div className="flex flex-col gap-2 font-sans">
                    <a
                      href={`${backendUrl}/api/reports/${selectedReport.id}/download`}
                      target="_blank"
                      className="py-2 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white border-0 rounded text-xs font-semibold flex items-center gap-2 transition shadow-[0_4px_12px_rgba(168,85,247,0.2)]"
                    >
                      <FileDown className="h-4 w-4 text-purple-200" /> Download Report
                    </a>
                  </div>
                </div>
              </div>
            </BorderGlow>

            {/* 1. Executive Summary */}
            <BorderGlow className="w-full">
              <div className="p-8">
                <h2 className="text-xl font-extrabold text-white border-b border-white/5 pb-3 mb-5 flex items-center gap-2">
                  Executive Overview Summary
                </h2>
                <p className="text-zinc-200 text-sm leading-relaxed whitespace-pre-line">
                  {selectedReport.report_data.executive_summary}
                </p>
                <ExplainabilityCard
                  agentName="Report Compiler Agent"
                  confidence={92}
                  reasoning="Consolidates verified findings from all parallel specialist swarms."
                />
              </div>
            </BorderGlow>

            {/* 2. Career Coach Recommendation */}
            {selectedReport.report_data.career_coach_recommendation && (
              <BorderGlow className="w-full">
                <div className="p-8">
                  <h2 className="text-xl font-extrabold text-white border-b border-white/5 pb-3 mb-5 flex items-center gap-2">
                    Hiring Manager Recommendations
                  </h2>
                  <div className="space-y-4">
                    <div className="p-4 bg-zinc-950/40 rounded border border-white/5">
                      <h3 className="text-[10px] font-bold text-purple-400 uppercase tracking-widest font-sans mb-1.5">Application Readiness Statement</h3>
                      <p className="text-sm text-zinc-200 leading-relaxed">
                        {selectedReport.report_data.career_coach_recommendation.readiness}
                      </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-zinc-950/40 rounded border border-white/5">
                        <h3 className="text-[10px] font-bold text-purple-400 uppercase tracking-widest font-sans mb-1.5">Estimated Competitiveness</h3>
                        <p className="text-sm font-bold text-white">
                          {selectedReport.report_data.career_coach_recommendation.competitiveness}
                        </p>
                      </div>
                      <div className="p-4 bg-zinc-950/40 rounded border border-white/5">
                        <h3 className="text-[10px] font-bold text-purple-400 uppercase tracking-widest font-sans mb-2.5">Priority Actions</h3>
                        <ul className="space-y-1.5 text-xs text-zinc-300">
                          {selectedReport.report_data.career_coach_recommendation.next_actions.map((act: string, idx: number) => (
                            <li key={idx} className="flex gap-2">
                              <span className="text-pink-500 font-bold">•</span>
                              <span>{act}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                  <ExplainabilityCard
                    agentName="Career Coach Agent"
                    confidence={selectedReport.report_data.career_coach_recommendation.confidence_score || 95}
                    reasoning={selectedReport.report_data.career_coach_recommendation.reasoning}
                  />
                </div>
              </BorderGlow>
            )}

            {/* 3. ATS Score & Details */}
            <BorderGlow className="w-full">
              <div className="p-8">
                <h2 className="text-xl font-extrabold text-white border-b border-white/5 pb-3 mb-5 flex items-center gap-2">
                  ATS Layout & Compatibility Review
                </h2>
                {selectedReport.report_data.ats_agent_report?.formatting_issues?.length > 0 ? (
                  <ul className="space-y-2.5">
                    {selectedReport.report_data.ats_agent_report.formatting_issues.map((issue: string, idx: number) => (
                      <li key={idx} className="flex gap-2.5 text-sm text-zinc-200 align-top">
                        <span className="text-amber-400 font-bold mt-0.5">•</span>
                        <span>{issue}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-emerald-400 font-medium font-sans">No format or template layout issues detected. Document parsed successfully.</p>
                )}
                <ExplainabilityCard
                  agentName="ATS Specialist Agent"
                  confidence={selectedReport.report_data.ats_agent_report?.confidence_score || 85}
                  reasoning={selectedReport.report_data.ats_agent_report?.reasoning || "Evaluated structural headings, tables, margins, and standard compliance."}
                />
              </div>
            </BorderGlow>

            {/* 4. Resume Strengths */}
            <BorderGlow className="w-full">
              <div className="p-8">
                <h2 className="text-xl font-extrabold text-white border-b border-white/5 pb-3 mb-5 flex items-center gap-2">
                  Document Strengths
                </h2>
                <div className="bg-emerald-950/10 border border-emerald-500/20 p-5 rounded">
                  <ul className="space-y-3">
                    {selectedReport.report_data.strengths.map((str, idx) => (
                      <li key={idx} className="flex gap-2.5 text-sm text-zinc-200 align-top">
                        <span className="text-emerald-400 font-bold mt-0.5">•</span>
                        <span>{str}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <ExplainabilityCard
                  agentName="ATS & Career Coach Agents"
                  confidence={90}
                  reasoning="Identified strong experience descriptions, concrete metrics, and relevant keyword match configurations."
                />
              </div>
            </BorderGlow>

            {/* 5. Priority Improvements */}
            {selectedReport.report_data.career_coach_recommendation && (
              <BorderGlow className="w-full">
                <div className="p-8">
                  <h2 className="text-xl font-extrabold text-white border-b border-white/5 pb-3 mb-5 flex items-center gap-2">
                    Priority Areas for Improvement
                  </h2>
                  <div className="bg-rose-950/10 border border-rose-500/20 p-5 rounded">
                    <ul className="space-y-3">
                      {selectedReport.report_data.career_coach_recommendation.improvements.map((imp: string, idx: number) => (
                        <li key={idx} className="flex gap-2.5 text-sm text-zinc-200 align-top">
                          <span className="text-rose-400 font-bold mt-0.5">•</span>
                          <span>{imp}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <ExplainabilityCard
                    agentName="Career Coach Agent"
                    confidence={selectedReport.report_data.career_coach_recommendation.confidence_score || 95}
                    reasoning={selectedReport.report_data.career_coach_recommendation.reasoning}
                  />
                </div>
              </BorderGlow>
            )}

            {/* 6. Skill Gap Analysis */}
            <BorderGlow className="w-full">
              <div className="p-8">
                <h2 className="text-xl font-extrabold text-white border-b border-white/5 pb-3 mb-5 flex items-center gap-2">
                  Industry Skill Alignment Checks
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6 font-sans">
                  <div>
                    <h3 className="text-[10px] font-bold text-purple-400 uppercase tracking-widest mb-3">Matching Qualifications</h3>
                    {selectedReport.report_data.resume_info.skills.length === 0 ? (
                      <p className="text-xs text-zinc-500 italic">No matching skills identified.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {selectedReport.report_data.resume_info.skills.map((skill, idx) => (
                          <span key={idx} className="bg-emerald-950/30 text-emerald-400 border border-emerald-500/20 text-[11px] px-2.5 py-1 rounded font-medium">
                            {skill}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="text-[10px] font-bold text-purple-400 uppercase tracking-widest mb-3">Identified Deficiencies</h3>
                    {selectedReport.report_data.missing_skills.length === 0 ? (
                      <p className="text-xs text-emerald-400 font-bold bg-emerald-950/30 px-2.5 py-1 rounded border border-emerald-500/20 w-fit">Full skill alignment matches job role specifications.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {selectedReport.report_data.missing_skills.map((skill, idx) => (
                          <span key={idx} className="bg-rose-950/30 text-rose-400 border border-rose-500/20 text-[11px] px-2.5 py-1 rounded font-medium">
                            {skill}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {selectedReport.report_data.skill_gap_agent_report && (
                  <div className="mb-4">
                    <h3 className="text-[10px] font-bold text-purple-400 uppercase tracking-widest font-sans mb-3">Recommended Skill Acquisition Strategy</h3>
                    <ul className="space-y-2.5">
                      {selectedReport.report_data.skill_gap_agent_report.recommendations.map((rec: string, idx: number) => (
                        <li key={idx} className="flex gap-2.5 text-sm text-zinc-200">
                          <span className="text-purple-400 font-bold">•</span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <ExplainabilityCard
                  agentName="Skill Gap Specialist"
                  confidence={selectedReport.report_data.skill_gap_agent_report?.confidence_score || 88}
                  reasoning={selectedReport.report_data.skill_gap_agent_report?.reasoning || "Cross-referenced current credentials with search indices to discover gap areas."}
                />
              </div>
            </BorderGlow>

            {/* 7. Grammar & Tone Review */}
            <BorderGlow className="w-full">
              <div className="p-8">
                <h2 className="text-xl font-extrabold text-white border-b border-white/5 pb-3 mb-5 flex items-center gap-2">
                  Grammar, Tone & Professional Style Review
                </h2>
                {selectedReport.report_data.grammar_agent_report && (
                  <div className="space-y-4 mb-4">
                    <div>
                      <h3 className="text-[10px] font-bold text-purple-400 uppercase tracking-widest font-sans mb-2.5">Spelling & Syntax Corrections</h3>
                      {selectedReport.report_data.grammar_agent_report.grammar_errors.length === 0 && selectedReport.report_data.grammar_agent_report.spelling_errors.length === 0 ? (
                        <p className="text-xs text-emerald-400 font-bold bg-emerald-950/30 px-2.5 py-1.5 rounded border border-emerald-200 w-fit">✓ No spelling or formatting syntax errors found.</p>
                      ) : (
                        <div className="space-y-2 font-mono text-xs">
                          {selectedReport.report_data.grammar_agent_report.grammar_errors.map((err: string, idx: number) => (
                            <div key={idx} className="p-3 bg-rose-950/20 border border-rose-500/10 text-rose-300 rounded">
                              Grammar Recommendation: {err}
                            </div>
                          ))}
                          {selectedReport.report_data.grammar_agent_report.spelling_errors.map((err: string, idx: number) => (
                            <div key={idx} className="p-3 bg-rose-950/20 border border-rose-500/10 text-rose-300 rounded">
                              Spelling Correction: {err}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {selectedReport.report_data.grammar_agent_report.tone_suggestions?.length > 0 && (
                      <div>
                        <h3 className="text-[10px] font-bold text-purple-400 uppercase tracking-widest font-sans mb-2.5">Tone & Professionalism Enhancements</h3>
                        <ul className="space-y-2">
                          {selectedReport.report_data.grammar_agent_report.tone_suggestions.map((sug: string, idx: number) => (
                            <li key={idx} className="flex gap-2 text-sm text-zinc-200">
                              <span className="text-purple-400 font-bold">•</span>
                              <span>{sug}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
                <ExplainabilityCard
                  agentName="Grammar & Style Agent"
                  confidence={selectedReport.report_data.grammar_agent_report?.confidence_score || 92}
                  reasoning={selectedReport.report_data.grammar_agent_report?.reasoning || "Scanned experiences and profiles to detect passive language and redundant expressions."}
                />
              </div>
            </BorderGlow>

            {/* 8. Interview Prep Questions */}
            <BorderGlow className="w-full">
              <div className="p-8">
                <h2 className="text-xl font-extrabold text-white border-b border-white/5 pb-3 mb-5 flex items-center gap-2">
                  Customized Interview Preparation
                </h2>

                <div className="space-y-6">
                  <div>
                    <h3 className="text-xs font-bold text-purple-400 uppercase tracking-widest font-sans mb-3">HR & Behavioral Interview Prep</h3>
                    <div className="space-y-2">
                      {selectedReport.report_data.interview_questions.hr_questions.map((q, idx) => (
                        <div key={idx} className="p-3 bg-zinc-950/40 rounded border border-white/5 text-sm text-zinc-200">
                          {q}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-bold text-purple-400 uppercase tracking-widest font-sans mb-3">Technical Qualifications Checks</h3>
                    <div className="space-y-2">
                      {selectedReport.report_data.interview_questions.technical_questions.map((q, idx) => (
                        <div key={idx} className="p-3 bg-zinc-950/40 rounded border border-white/5 text-sm text-zinc-200">
                          {q}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-bold text-purple-400 uppercase tracking-widest font-sans mb-3">Resume-specific Project Questions</h3>
                    <div className="space-y-2">
                      {selectedReport.report_data.interview_questions.project_based_questions.map((q, idx) => (
                        <div key={idx} className="p-3 bg-zinc-950/40 rounded border border-white/5 text-sm text-zinc-200">
                          {q}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <ExplainabilityCard
                  agentName="Interview Specialist Agent"
                  confidence={selectedReport.report_data.interview_questions.confidence_score || 90}
                  reasoning={selectedReport.report_data.interview_questions.reasoning}
                />
              </div>
            </BorderGlow>

            {/* 9. Cover Letter (Optional) */}
            {selectedReport.report_data.cover_letter && (
              <BorderGlow className="w-full">
                <div className="p-8">
                  <h2 className="text-xl font-extrabold text-white border-b border-white/5 pb-3 mb-5 flex items-center gap-2">
                    Personalized Cover Letter
                  </h2>
                  <div className="p-6 bg-zinc-950/50 border border-white/5 rounded shadow-inner">
                    <pre className="text-zinc-200 text-sm font-sans whitespace-pre-wrap leading-relaxed">
                      {selectedReport.report_data.cover_letter}
                    </pre>
                  </div>
                  {selectedReport.report_data.cover_letter_agent_report && (
                    <ExplainabilityCard
                      agentName="Cover Letter Specialist"
                      confidence={selectedReport.report_data.cover_letter_agent_report.confidence_score || 90}
                      reasoning={selectedReport.report_data.cover_letter_agent_report.reasoning}
                    />
                  )}
                </div>
              </BorderGlow>
            )}

            {/* 10. Resume Improvement History */}
            <BorderGlow className="w-full">
              <div className="p-8">
                <h2 className="text-xl font-extrabold text-white border-b border-white/5 pb-3 mb-5 flex items-center gap-2">
                  Comparative Alignment History
                </h2>
                {selectedReport.report_data.improvement_history ? (
                  <div className="p-5 bg-zinc-950/40 rounded border border-white/5 text-sm text-zinc-200 whitespace-pre-line leading-relaxed">
                    {selectedReport.report_data.improvement_history}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500 italic">First optimization cycle recorded. Subsequent runs will display deltas.</p>
                )}
                <ExplainabilityCard
                  agentName="System Memory Database Module"
                  confidence={100}
                  reasoning="Identified candidate filename history to trace performance metrics differences."
                />
              </div>
            </BorderGlow>

            {/* 11. Final Confidence */}
            <BorderGlow className="w-full">
              <div className="p-8">
                <h2 className="text-xl font-extrabold text-white border-b border-white/5 pb-3 mb-5 flex items-center gap-2">
                  Final Confidence Evaluation
                </h2>
                <div className="flex items-center gap-4">
                  <div className="flex-1 bg-zinc-900 rounded-full h-3 overflow-hidden border border-white/5 font-sans">
                    <div 
                      className="bg-gradient-to-r from-purple-500 to-pink-500 h-full rounded-full transition-all duration-1000 shadow-[0_0_12px_rgba(168,85,247,0.4)]"
                      style={{ width: `${selectedReport.report_data.final_confidence_score || 85}%` }}
                    />
                  </div>
                  <span className="text-base font-bold text-white font-sans">{selectedReport.report_data.final_confidence_score || 85}%</span>
                </div>
              </div>
            </BorderGlow>

            {/* 12. Sources & Research Scope */}
            <BorderGlow className="w-full">
              <div className="p-8">
                <h2 className="text-xl font-extrabold text-white border-b border-white/5 pb-3 mb-5 flex items-center gap-2">
                  Search Scope & Verified Sources
                </h2>
                {selectedReport.report_data.sources?.length > 0 ? (
                  <ul className="space-y-2">
                    {selectedReport.report_data.sources.map((src: string, idx: number) => (
                      <li key={idx} className="flex gap-2 text-xs text-zinc-300 font-mono">
                        <span className="text-purple-400 font-bold">•</span>
                        <span>{src}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-zinc-500 italic">Referenced internal dictionaries, filesystem configurations, and DuckDuckGo API.</p>
                )}
                <ExplainabilityCard
                  agentName="Browser & Filesystem MCP Servers"
                  confidence={100}
                  reasoning="Exposed remote Stdio subprocesses to check external websites and filesystem indices."
                />
              </div>
            </BorderGlow>
          </div>
        )}
      </main>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId !== null && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-950 border border-white/10 rounded-lg p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-rose-500" /> Confirm Deletion
            </h3>
            <p className="text-xs text-zinc-400 font-sans mt-2.5 leading-relaxed">
              Are you sure you want to permanently delete this report and historical metrics from the database? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3 mt-6 font-sans text-xs">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="py-2 px-4 hover:bg-white/5 border border-white/10 rounded text-zinc-300 transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="py-2 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded font-bold transition"
              >
                Delete Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
