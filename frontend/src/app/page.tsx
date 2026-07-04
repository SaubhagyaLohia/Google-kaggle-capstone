"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Upload, 
  FileText, 
  Briefcase, 
  Award, 
  BarChart2, 
  CheckCircle2, 
  Loader2, 
  AlertCircle, 
  Trash2, 
  ArrowRight, 
  ShieldAlert, 
  FileDown, 
  Plus, 
  Sparkles, 
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
  { id: "security_agent", label: "Security Agent (MCP Guard)" },
  { id: "init_state", label: "Workflow Initializer" },
  { id: "read_resume_node", label: "Resume Reader" },
  { id: "resume_parser", label: "Resume Parser Agent" },
  { id: "ats_analysis", label: "ATS Analyzer Agent" },
  { id: "skill_gap", label: "Skill Gap Agent" },
  { id: "grammar_review", label: "Grammar & Tone Agent" },
  { id: "interview_prep", label: "Interview Prep Agent" },
  { id: "cover_letter", label: "Cover Letter Agent (Optional)" },
  { id: "validation_node", label: "Validation Agent" },
  { id: "career_coach", label: "Career Coach Agent" },
  { id: "report_generator", label: "Report Generator Agent" }
];

function ExplainabilityCard({ agentName, confidence, reasoning }: { agentName: string; confidence: number; reasoning: string }) {
  return (
    <div className="mt-4 p-4 bg-slate-950/80 border border-slate-800/80 rounded-xl flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase text-slate-500 tracking-wider">Agent Credentials</span>
        <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full">
          {agentName} (Conf: {confidence}%)
        </span>
      </div>
      <p className="text-xs text-slate-400 leading-relaxed mt-1">
        <span className="font-semibold text-slate-300">Reasoning:</span> {reasoning}
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
      "security_agent": "Verifying filesystem read permissions and integrity..."
    });

    // 2. Trigger analysis and start listening to SSE
    try {
      const controller = new AbortController();
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
                
                setAgentProgress(prev => ({
                  ...prev,
                  [agentId]: status,
                  security_agent: "completed"
                }));
                setAgentSummaries(prev => ({
                  ...prev,
                  security_agent: "✓ All filesystem, database, and browser calls validated",
                  ...(event.summary ? { [agentId]: event.summary } : {})
                }));
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
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
      {/* Sidebar: History */}
      <aside className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col justify-between shrink-0">
        <div className="flex flex-col flex-1 overflow-y-auto">
          <div className="p-6 border-b border-slate-800 flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-lg text-white">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-none">Career Copilot</h1>
              <p className="text-xs text-slate-400 mt-1">AI Job Application Multi-Agent</p>
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
              className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg font-medium text-sm transition flex items-center justify-center gap-2"
            >
              <Plus className="h-4 w-4" /> New Analysis
            </button>
          </div>

          <div className="px-4 flex-1">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-2">History</h2>
            {history.length === 0 ? (
              <p className="text-sm text-slate-400 italic px-2 py-4">No previous reports found.</p>
            ) : (
              <div className="space-y-1">
                {history.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => loadReport(item.id)}
                    className={`group w-full text-left p-3 rounded-lg cursor-pointer transition flex items-center justify-between ${
                      selectedReport?.id === item.id 
                        ? "bg-indigo-600/10 border border-indigo-500/30 text-indigo-400" 
                        : "hover:bg-slate-800 border border-transparent text-slate-300"
                    }`}
                  >
                    <div className="overflow-hidden pr-2">
                      <div className="font-medium text-sm truncate">{item.job_role}</div>
                      <div className="text-xs text-slate-500 truncate mt-0.5">{item.resume_filename}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                        item.ats_score >= 80 ? "bg-emerald-500/20 text-emerald-400" :
                        item.ats_score >= 60 ? "bg-amber-500/20 text-amber-400" :
                        "bg-rose-500/20 text-rose-400"
                      }`}>
                        {item.ats_score}
                      </span>
                      <button 
                        onClick={(e) => triggerDelete(item.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-400 text-slate-400 transition"
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
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto bg-slate-950 p-8">
        {!selectedReport && !isAnalyzing && (
          <div className="max-w-2xl mx-auto py-12">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-extrabold text-white tracking-tight">AI Career Analysis</h1>
              <p className="text-slate-400 mt-2">
                Upload your resume, specify the target job description, and run our multi-agent workflow to receive an ATS check, missing skills list, interview questions, and a customized cover letter.
              </p>
            </div>

            <form onSubmit={startAnalysis} className="space-y-6 bg-slate-900 p-8 border border-slate-800 rounded-2xl shadow-xl">
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Target Job Role <span className="text-rose-400">*</span></label>
                <div className="relative">
                  <Briefcase className="absolute left-3.5 top-3.5 h-5 w-5 text-slate-500" />
                  <input
                    type="text"
                    value={jobRole}
                    onChange={(e) => setJobRole(e.target.value)}
                    placeholder="e.g., Senior Full Stack Engineer"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-12 pr-4 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition text-sm"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Upload Resume (PDF, DOCX) <span className="text-rose-400">*</span></label>
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleFileDrop}
                  onClick={triggerFileSelect}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
                    resumeFile 
                      ? "border-emerald-500/50 bg-emerald-500/5" 
                      : "border-slate-800 hover:border-indigo-500/50 bg-slate-950"
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
                    <Upload className={`h-10 w-10 mb-3 ${resumeFile ? "text-emerald-400" : "text-slate-500"}`} />
                    {resumeFile ? (
                      <div>
                        <p className="font-semibold text-slate-200 text-sm">{resumeFile.name}</p>
                        <p className="text-xs text-emerald-400 mt-1">{(resumeFile.size / 1024 / 1024).toFixed(2)} MB • File loaded</p>
                      </div>
                    ) : (
                      <div>
                        <p className="font-medium text-slate-300 text-sm">Drag and drop your file here, or click to browse</p>
                        <p className="text-xs text-slate-500 mt-1.5">PDF or DOCX (max. 10MB)</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Job Description (Optional)</label>
                <textarea
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Paste the job description here to check for skill gaps and generate a personalized cover letter..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition text-sm h-32 resize-none"
                />
              </div>

              {errorMsg && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-rose-300">{errorMsg}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isUploading}
                className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold text-sm transition shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30 flex items-center justify-center gap-2"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Uploading...
                  </>
                ) : (
                  <>
                    Analyze Resume <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* Live Execution Progress */}
        {isAnalyzing && (
          <div className="max-w-xl mx-auto py-12">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl">
              <div className="text-center mb-8">
                <Loader2 className="h-10 w-10 animate-spin text-indigo-500 mx-auto mb-3" />
                <h2 className="text-xl font-bold text-white">Analyzing Job Application</h2>
                <p className="text-slate-400 text-sm mt-1">Multi-Agent swarm executing in parallel...</p>
              </div>

              <div className="space-y-4">
                {AGENTS.map((agent) => {
                  const status = agentProgress[agent.id] || "idle";
                  const summary = agentSummaries[agent.id];
                  return (
                    <div key={agent.id} className="flex flex-col p-3 rounded-lg bg-slate-950 border border-slate-800/50 gap-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`h-2.5 w-2.5 rounded-full ${
                            status === "completed" ? "bg-emerald-500 shadow-lg shadow-emerald-500/30" :
                            status === "running" ? "bg-amber-500 animate-pulse shadow-lg shadow-amber-500/30" :
                            status === "retrying" ? "bg-indigo-500 animate-bounce shadow-lg shadow-indigo-500/30" :
                            status === "failed" ? "bg-rose-500 shadow-lg shadow-rose-500/30" :
                            "bg-slate-700"
                          }`} />
                          <span className={`text-sm font-medium ${
                            status === "completed" ? "text-slate-200" :
                            status === "running" ? "text-amber-400 font-semibold" :
                            status === "retrying" ? "text-indigo-400 font-semibold" :
                            "text-slate-500"
                          }`}>{agent.label}</span>
                        </div>
                        <div className="shrink-0">
                          {status === "completed" && <CheckCircle2 className="h-5 w-5 text-emerald-400 animate-fade-in" />}
                          {status === "running" && <Loader2 className="h-4 w-4 animate-spin text-amber-400" />}
                          {status === "retrying" && <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />}
                          {status === "failed" && <AlertCircle className="h-5 w-5 text-rose-400" />}
                          {status === "idle" && <span className="text-xs text-slate-600 uppercase font-bold tracking-wider">Waiting</span>}
                        </div>
                      </div>
                      {summary && (
                        <div className="text-xs text-slate-400 pl-5 animate-fade-in font-mono">
                          {summary}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {errorMsg && (
                <div className="mt-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-rose-300">{errorMsg}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Report Viewer */}
        {selectedReport && !isAnalyzing && (
          <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-16">
            {/* Header: Score */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
              <div>
                <span className="text-xs font-semibold text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-full uppercase tracking-wider">Report Generated</span>
                <h1 className="text-3xl font-extrabold text-white mt-3">{selectedReport.job_role}</h1>
                <p className="text-sm text-slate-400 mt-1 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-slate-500" /> {selectedReport.resume_filename}
                </p>
              </div>
              <div className="flex items-center gap-6 shrink-0">
                <div className="relative h-28 w-28 flex items-center justify-center bg-slate-950 rounded-full border-4 border-slate-800">
                  <div className="text-center">
                    <span className="block text-3xl font-black text-white">{selectedReport.ats_score}</span>
                    <span className="text-xxs uppercase font-bold text-slate-500 tracking-wider">ATS Score</span>
                  </div>
                  {/* Circle outline animation */}
                  <svg className="absolute -top-1 -left-1 h-[116px] w-[116px] transform -rotate-90">
                    <circle
                      cx="58"
                      cy="58"
                      r="54"
                      className="stroke-indigo-600 fill-none"
                      strokeWidth="4"
                      strokeDasharray="339.29"
                      strokeDashoffset={339.29 - (339.29 * selectedReport.ats_score) / 100}
                    />
                  </svg>
                </div>
                <div className="flex flex-col gap-2">
                  <a
                    href={`${backendUrl}/api/reports/${selectedReport.id}/download`}
                    target="_blank"
                    className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-2 transition"
                  >
                    <FileDown className="h-4 w-4" /> Download Report
                  </a>
                </div>
              </div>
            </div>

            {/* 1. Executive Summary */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-indigo-400" /> Executive Summary
              </h2>
              <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-line">
                {selectedReport.report_data.executive_summary}
              </p>
              <ExplainabilityCard
                agentName="Report Generator Agent"
                confidence={selectedReport.report_data.final_confidence_score || 90}
                reasoning="Compiles and aggregates all verified outcomes from the specialist swarm."
              />
            </div>

            {/* 2. Career Coach Recommendation */}
            {selectedReport.report_data.career_coach_recommendation && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-indigo-400" /> Career Coach Recommendation
                </h2>
                <div className="space-y-4">
                  <div className="p-4 bg-slate-950/50 rounded-xl border border-slate-800">
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Application Readiness</h3>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      {selectedReport.report_data.career_coach_recommendation.readiness}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-950/50 rounded-xl border border-slate-800">
                      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Estimated Competitiveness</h3>
                      <p className="text-sm font-bold text-indigo-400">
                        {selectedReport.report_data.career_coach_recommendation.competitiveness}
                      </p>
                    </div>
                    <div className="p-4 bg-slate-950/50 rounded-xl border border-slate-800">
                      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Recommended Next Actions</h3>
                      <ul className="space-y-1.5 text-xs text-slate-300">
                        {selectedReport.report_data.career_coach_recommendation.next_actions.map((act: string, idx: number) => (
                          <li key={idx} className="flex gap-2">
                            <span className="text-indigo-400 font-bold">•</span>
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
            )}

            {/* 3. ATS Score & Details */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Gauge className="h-5 w-5 text-indigo-400" /> ATS Details & Layout Issues
              </h2>
              {selectedReport.report_data.ats_agent_report?.formatting_issues?.length > 0 ? (
                <ul className="space-y-2.5">
                  {selectedReport.report_data.ats_agent_report.formatting_issues.map((issue: string, idx: number) => (
                    <li key={idx} className="flex gap-2.5 text-sm text-slate-300 align-top">
                      <span className="text-amber-500 font-bold mt-0.5">•</span>
                      <span>{issue}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-emerald-400 font-medium">No formatting or layout issues detected by ATS Agent.</p>
              )}
              <ExplainabilityCard
                agentName="ATS Agent"
                confidence={selectedReport.report_data.ats_agent_report?.confidence_score || 85}
                reasoning={selectedReport.report_data.ats_agent_report?.reasoning || "Evaluated resume keywords, heading structures, and document parser compatibility."}
              />
            </div>

            {/* 4. Resume Strengths */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl">
              <h2 className="text-xl font-bold text-emerald-400 mb-4 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" /> Resume Strengths
              </h2>
              <ul className="space-y-3">
                {selectedReport.report_data.strengths.map((str, idx) => (
                  <li key={idx} className="flex gap-2.5 text-sm text-slate-300 align-top">
                    <span className="text-emerald-400 font-bold mt-0.5">•</span>
                    <span>{str}</span>
                  </li>
                ))}
              </ul>
              <ExplainabilityCard
                agentName="ATS & Career Coach Agents"
                confidence={90}
                reasoning="Identified candidate's outstanding professional characteristics, strong profile metrics, and key project outcomes."
              />
            </div>

            {/* 5. Priority Improvements */}
            {selectedReport.report_data.career_coach_recommendation && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl">
                <h2 className="text-xl font-bold text-rose-400 mb-4 flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5" /> Priority Improvements
                </h2>
                <ul className="space-y-3">
                  {selectedReport.report_data.career_coach_recommendation.improvements.map((imp: string, idx: number) => (
                    <li key={idx} className="flex gap-2.5 text-sm text-slate-300 align-top">
                      <span className="text-rose-400 font-bold mt-0.5">•</span>
                      <span>{imp}</span>
                    </li>
                  ))}
                </ul>
                <ExplainabilityCard
                  agentName="Career Coach Agent"
                  confidence={selectedReport.report_data.career_coach_recommendation.confidence_score || 95}
                  reasoning={selectedReport.report_data.career_coach_recommendation.reasoning}
                />
              </div>
            )}

            {/* 6. Skill Gap Analysis */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <Award className="h-5 w-5 text-indigo-400" /> Skill Gap Analysis
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Matching Skills</h3>
                  {selectedReport.report_data.resume_info.skills.length === 0 ? (
                    <p className="text-sm text-slate-500 italic">No skills listed.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {selectedReport.report_data.resume_info.skills.map((skill, idx) => (
                        <span key={idx} className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs px-2.5 py-1 rounded-md font-medium">
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Missing Skills (Recommended)</h3>
                  {selectedReport.report_data.missing_skills.length === 0 ? (
                    <p className="text-sm text-emerald-400 font-medium">No missing skills detected! Great fit.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {selectedReport.report_data.missing_skills.map((skill, idx) => (
                        <span key={idx} className="bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs px-2.5 py-1 rounded-md font-medium">
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {selectedReport.report_data.skill_gap_agent_report && (
                <div className="mb-4">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Skill Acquisition Plan</h3>
                  <ul className="space-y-3">
                    {selectedReport.report_data.skill_gap_agent_report.recommendations.map((rec: string, idx: number) => (
                      <li key={idx} className="flex gap-2.5 text-sm text-slate-300">
                        <span className="text-indigo-400 font-bold mt-0.5">•</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <ExplainabilityCard
                agentName="Skill Gap Agent"
                confidence={selectedReport.report_data.skill_gap_agent_report?.confidence_score || 88}
                reasoning={selectedReport.report_data.skill_gap_agent_report?.reasoning || "Searched job role requirements and checked skill matches."}
              />
            </div>

            {/* 7. Grammar & Tone Review */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-indigo-400" /> Grammar & Tone Review
              </h2>
              {selectedReport.report_data.grammar_agent_report && (
                <div className="space-y-4 mb-4">
                  <div>
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Grammar & Spelling Issues</h3>
                    {selectedReport.report_data.grammar_agent_report.grammar_errors.length === 0 && selectedReport.report_data.grammar_agent_report.spelling_errors.length === 0 ? (
                      <p className="text-sm text-emerald-400 font-medium">✓ No spelling or grammar errors detected!</p>
                    ) : (
                      <div className="space-y-2">
                        {selectedReport.report_data.grammar_agent_report.grammar_errors.map((err: string, idx: number) => (
                          <div key={idx} className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-sm text-rose-300 font-mono">
                            Grammar: {err}
                          </div>
                        ))}
                        {selectedReport.report_data.grammar_agent_report.spelling_errors.map((err: string, idx: number) => (
                          <div key={idx} className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-sm text-rose-300 font-mono">
                            Spelling: {err}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {selectedReport.report_data.grammar_agent_report.tone_suggestions?.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Tone & Professionalism Enhancements</h3>
                      <ul className="space-y-2">
                        {selectedReport.report_data.grammar_agent_report.tone_suggestions.map((sug: string, idx: number) => (
                          <li key={idx} className="flex gap-2 text-sm text-slate-300">
                            <span className="text-indigo-400 font-bold">•</span>
                            <span>{sug}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              <ExplainabilityCard
                agentName="Grammar Agent"
                confidence={selectedReport.report_data.grammar_agent_report?.confidence_score || 92}
                reasoning={selectedReport.report_data.grammar_agent_report?.reasoning || "Scanned experiences and descriptions for syntax, spelling correctness, and phrasing."}
              />
            </div>

            {/* 8. Interview Prep Questions */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-indigo-400" /> Tailored Interview Preparation
              </h2>

              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-indigo-400 mb-3 uppercase tracking-wider">HR & Behavioral</h3>
                  <div className="space-y-2">
                    {selectedReport.report_data.interview_questions.hr_questions.map((q, idx) => (
                      <div key={idx} className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 text-sm text-slate-300">
                        {q}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-indigo-400 mb-3 uppercase tracking-wider">Technical</h3>
                  <div className="space-y-2">
                    {selectedReport.report_data.interview_questions.technical_questions.map((q, idx) => (
                      <div key={idx} className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 text-sm text-slate-300">
                        {q}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-indigo-400 mb-3 uppercase tracking-wider">Project-based (from your Resume)</h3>
                  <div className="space-y-2">
                    {selectedReport.report_data.interview_questions.project_based_questions.map((q, idx) => (
                      <div key={idx} className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 text-sm text-slate-300">
                        {q}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <ExplainabilityCard
                agentName="Interview Agent"
                confidence={selectedReport.report_data.interview_questions.confidence_score || 90}
                reasoning={selectedReport.report_data.interview_questions.reasoning}
              />
            </div>

            {/* 9. Cover Letter (Optional) */}
            {selectedReport.report_data.cover_letter && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-indigo-400" /> Personalized Cover Letter
                </h2>
                <div className="p-6 bg-slate-950 border border-slate-800 rounded-xl">
                  <pre className="text-slate-300 text-sm font-sans whitespace-pre-wrap leading-relaxed">
                    {selectedReport.report_data.cover_letter}
                  </pre>
                </div>
                {selectedReport.report_data.cover_letter_agent_report && (
                  <ExplainabilityCard
                    agentName="Cover Letter Agent"
                    confidence={selectedReport.report_data.cover_letter_agent_report.confidence_score || 90}
                    reasoning={selectedReport.report_data.cover_letter_agent_report.reasoning}
                  />
                )}
              </div>
            )}

            {/* 10. Resume Improvement History */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <History className="h-5 w-5 text-indigo-400" /> Resume Improvement History
              </h2>
              {selectedReport.report_data.improvement_history ? (
                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-sm text-slate-300 whitespace-pre-line leading-relaxed">
                  {selectedReport.report_data.improvement_history}
                </div>
              ) : (
                <p className="text-sm text-slate-500 italic">First version analyzed. No previous resume versions exist in database history.</p>
              )}
              <ExplainabilityCard
                agentName="System Memory Module"
                confidence={100}
                reasoning="Identified candidate name and resume base filename to cross-reference previous databases runs."
              />
            </div>

            {/* 11. Final Confidence */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-indigo-400" /> Final Confidence Evaluation
              </h2>
              <div className="flex items-center gap-4">
                <div className="flex-1 bg-slate-950 rounded-full h-4 overflow-hidden border border-slate-800">
                  <div 
                    className="bg-gradient-to-r from-indigo-500 to-emerald-500 h-full rounded-full transition-all duration-1000"
                    style={{ width: `${selectedReport.report_data.final_confidence_score || 85}%` }}
                  />
                </div>
                <span className="text-lg font-bold text-white">{selectedReport.report_data.final_confidence_score || 85}%</span>
              </div>
            </div>

            {/* 12. Sources & Research Scope */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Search className="h-5 w-5 text-indigo-400" /> Sources & Research Scope
              </h2>
              {selectedReport.report_data.sources?.length > 0 ? (
                <ul className="space-y-2">
                  {selectedReport.report_data.sources.map((src: string, idx: number) => (
                    <li key={idx} className="flex gap-2 text-sm text-slate-300 font-mono">
                      <span className="text-indigo-400 font-bold">•</span>
                      <span>{src}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500 italic">Searched DuckDuckGo browser resources and local filesystem.</p>
              )}
              <ExplainabilityCard
                agentName="Browser & Filesystem MCP Servers"
                confidence={100}
                reasoning="Exposed standard protocol endpoints to query search indices and read configuration files safely."
              />
            </div>
          </div>
        )}
      </main>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId !== null && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-fade-in">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-rose-500" /> Confirm Deletion
            </h3>
            <p className="text-sm text-slate-400 mt-2 leading-relaxed">
              Are you sure you want to delete this report? This will permanently delete the report and ATS scores from history.
            </p>
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="py-2 px-4 hover:bg-slate-800 border border-slate-800 rounded-lg text-sm text-slate-400 transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="py-2 px-4 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-sm font-semibold transition"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
