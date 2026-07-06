# Copyright 2026 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
import os
import sys
import json
import time
from typing import Optional, Any
import dotenv

dotenv.load_dotenv()

import google.auth
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

# Add project roots for imports
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from backend.database import database
from backend.agents.agent_workflow import career_copilot_workflow, WorkflowInput

app = FastAPI(
    title="AI Career Copilot API",
    description="Backend API for Resume Parser, ATS Analysis, and Multi-Agent Orchestration."
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all for development flexibility
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "uploads"))
REPORTS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "reports"))

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(REPORTS_DIR, exist_ok=True)

class AnalyzeRequest(BaseModel):
    resume_path: str
    job_role: str
    job_description: Optional[str] = None

def get_agent_summary(agent_name: str, output: Any) -> str:
    if not output:
        return ""
    try:
        def get_val(obj, key, default):
            if isinstance(obj, dict):
                return obj.get(key, default)
            return getattr(obj, key, default)
            
        if agent_name == "resume_parser":
            name = get_val(output, "name", "Candidate")
            skills_count = len(get_val(output, "skills", []) or [])
            return f"✓ Parsed name: {name} • {skills_count} skills extracted"
        elif agent_name == "ats_analysis":
            score = get_val(output, "ats_compatibility_score", 0)
            return f"✓ Score: {score}/100"
        elif agent_name == "skill_gap":
            missing = get_val(output, "missing_skills", []) or []
            if missing:
                return f"✓ Missing: {', '.join(missing[:3])}{'...' if len(missing) > 3 else ''}"
            return "✓ No missing skills identified"
        elif agent_name == "grammar_review":
            g_errors = len(get_val(output, "grammar_errors", []) or [])
            s_errors = len(get_val(output, "spelling_errors", []) or [])
            return f"✓ {g_errors} grammar & {s_errors} spelling issues found"
        elif agent_name == "interview_prep":
            hr = len(get_val(output, "hr_questions", []) or [])
            tech = len(get_val(output, "technical_questions", []) or [])
            proj = len(get_val(output, "project_based_questions", []) or [])
            return f"✓ Generated {hr + tech + proj} practice questions"
        elif agent_name == "check_job_desc" or agent_name == "cover_letter":
            c_letter = get_val(output, "cover_letter", "")
            if c_letter:
                return "✓ Cover letter generated successfully"
            return "✓ Cover letter skipped (no job description)"
        elif agent_name == "career_coach":
            comp = get_val(output, "competitiveness", "Medium")
            score = get_val(output, "confidence_score", 0)
            return f"✓ Competitiveness: {comp} • Confidence: {score}%"
        elif agent_name == "report_generator":
            return "✓ Final report successfully compiled and saved"
    except Exception as e:
        return f"Completed with output: {str(e)}"
    return "Completed"

async def run_workflow_stream(resume_path: str, job_role: str, job_description: Optional[str] = None):
    from google.adk.runners import InMemoryRunner
    from google.adk.apps import App
    from google.genai import types
    
    app_instance = App(name="app", root_agent=career_copilot_workflow)
    runner = InMemoryRunner(app=app_instance)
    
    session = await runner.session_service.create_session(app_name="app", user_id="local_user")
    
    input_data = {
        "resume_path": resume_path,
        "job_role": job_role,
        "job_description": job_description or ""
    }
    
    msg = types.Content(
        role="user",
        parts=[types.Part.from_text(text=json.dumps(input_data))]
    )
    
    active_agent = None
    candidate_name = None
    previous_analysis = None
    
    try:
        async for event in runner.run_async(user_id="local_user", session_id=session.id, new_message=msg):
            author = event.author
            node_output = event.output
            
            # Candidate Identification & Previous History Lookup
            if author == "resume_parser" and node_output is not None:
                if hasattr(node_output, "name"):
                    candidate_name = node_output.name
                elif isinstance(node_output, dict):
                    candidate_name = node_output.get("name", "")
                
                if candidate_name:
                    previous_analysis = database.get_latest_analysis_by_name_or_file(
                        candidate_name, os.path.basename(resume_path)
                    )
            
            # Injection of historical comparison metrics right after validation node passes
            if author == "validation_node" and node_output == "Validation Passed":
                if previous_analysis:
                    p_data = previous_analysis["report_data"]
                    p_ats = previous_analysis["ats_score"]
                    
                    p_g_list = p_data.get("grammar_suggestions", []) or []
                    if not p_g_list and isinstance(p_data.get("grammar_review"), dict):
                        p_g_list = p_data.get("grammar_review", {}).get("grammar_errors", []) or []
                        p_s_list = p_data.get("grammar_review", {}).get("spelling_errors", []) or []
                        p_g_list = p_g_list + p_s_list
                    p_grammar = len(p_g_list)
                    
                    p_s_list = p_data.get("missing_skills", []) or []
                    if not p_s_list and isinstance(p_data.get("skill_gap"), dict):
                        p_s_list = p_data.get("skill_gap", {}).get("missing_skills", []) or []
                    p_skills = len(p_s_list)
                    
                    latest_session = await runner.session_service.get_session(app_name="app", user_id="local_user", session_id=session.id)
                    curr_ats_obj = latest_session.state.get("ats_analysis", {})
                    curr_grammar_obj = latest_session.state.get("grammar_review", {})
                    curr_skills_obj = latest_session.state.get("skill_gap", {})
                    
                    def get_val(obj, key, default):
                        if isinstance(obj, dict):
                            return obj.get(key, default)
                        return getattr(obj, key, default)
                        
                    curr_ats = get_val(curr_ats_obj, "ats_compatibility_score", 0)
                    c_g_errors = len(get_val(curr_grammar_obj, "grammar_errors", []) or [])
                    c_s_errors = len(get_val(curr_grammar_obj, "spelling_errors", []) or [])
                    curr_grammar = c_g_errors + c_s_errors
                    curr_skills = len(get_val(curr_skills_obj, "missing_skills", []) or [])
                    
                    comparison_summary = f"""### Resume Improvement History
- **ATS Score**: {p_ats} ➔ {curr_ats}
- **Grammar/Spelling Issues**: {p_grammar} ➔ {curr_grammar}
- **Missing Skills**: {p_skills} ➔ {curr_skills}
"""
                    session.state["improvement_history"] = comparison_summary
                    storage_session = runner.session_service.sessions["app"]["local_user"].get(session.id)
                    if storage_session:
                        storage_session.state["improvement_history"] = comparison_summary
            
            # We want to yield back progress events
            tracked_agents = [
                "init_state", "read_resume_node", "resume_parser", "ats_analysis", 
                "skill_gap", "grammar_review", "interview_prep", "check_job_desc",
                "cover_letter", "career_coach", "validation_node", "report_generator"
            ]
            if author and author in tracked_agents:
                if author != active_agent:
                    if active_agent:
                        # Extract the final output of the completed agent
                        latest_session = await runner.session_service.get_session(app_name="app", user_id="local_user", session_id=session.id)
                        agent_output = latest_session.state.get(active_agent)
                        summary_msg = get_agent_summary(active_agent, agent_output)
                        yield {"data": json.dumps({"agent": active_agent, "status": "completed", "summary": summary_msg})}
                    
                    # Yield running status for the new agent
                    active_agent = author
                    yield {"data": json.dumps({"agent": active_agent, "status": "running"})}
                    
                    # If the validation node triggered reruns, yield "retrying" status to client
                    latest_session = await runner.session_service.get_session(app_name="app", user_id="local_user", session_id=session.id)
                    retrying = latest_session.state.get("retrying_agents", [])
                    if retrying:
                        for retrying_agent in retrying:
                            yield {"data": json.dumps({"agent": retrying_agent, "status": "retrying"})}
            
            # If the report is generated, we get the output
            if event.output is not None and author == "report_generator":
                result_data = event.output
                if hasattr(result_data, "model_dump"):
                    result_data = result_data.model_dump()
                
                # yield final completion
                yield {"data": json.dumps({"agent": "report_generator", "status": "completed", "summary": "Final report generated successfully", "result": result_data})}
        
        # Post-loop cleanup to yield completion for the leftover active agent (e.g. career_coach)
        if active_agent:
            latest_session = await runner.session_service.get_session(app_name="app", user_id="local_user", session_id=session.id)
            agent_output = latest_session.state.get(active_agent)
            summary_msg = get_agent_summary(active_agent, agent_output)
            yield {"data": json.dumps({"agent": active_agent, "status": "completed", "summary": summary_msg})}
            
        # Guarantee final report completion event is yielded
        latest_session = await runner.session_service.get_session(app_name="app", user_id="local_user", session_id=session.id)
        final_report = latest_session.state.get("final_report")
        if final_report:
            if hasattr(final_report, "model_dump"):
                final_report = final_report.model_dump()
            yield {"data": json.dumps({"agent": "report_generator", "status": "completed", "summary": "Final report generated successfully", "result": final_report})}
                
    except Exception as e:
        yield {"data": json.dumps({"error": str(e)})}

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    filename = file.filename
    file_path = os.path.join(UPLOAD_DIR, filename)
    
    # Safe execution: never overwrite uploaded files
    if os.path.exists(file_path):
        name, ext = os.path.splitext(filename)
        file_path = os.path.join(UPLOAD_DIR, f"{name}_{int(time.time())}{ext}")
        filename = os.path.basename(file_path)
        
    try:
        with open(file_path, "wb") as f:
            f.write(await file.read())
        return {"filename": filename, "filepath": file_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload file: {str(e)}")

@app.post("/api/analyze")
async def analyze_resume(request: AnalyzeRequest):
    if not os.path.exists(request.resume_path):
        raise HTTPException(status_code=400, detail=f"Resume file not found at path: {request.resume_path}")
        
    return EventSourceResponse(run_workflow_stream(
        request.resume_path,
        request.job_role,
        request.job_description
    ))

@app.get("/api/history")
def get_history():
    return database.get_all_analyses()

@app.get("/api/reports/{id}")
def get_report(id: int):
    report = database.get_analysis_by_id(id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report

@app.delete("/api/reports/{id}")
def delete_report(id: int):
    report = database.get_analysis_by_id(id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
        
    database.delete_analysis_by_id(id)
    return {"status": "success", "message": f"Report {id} deleted successfully"}

@app.get("/api/reports/{id}/download")
def download_report(id: int):
    report = database.get_analysis_by_id(id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
        
    resume_filename = report["resume_filename"]
    # Rebuild Markdown on the fly to guarantee correct schema layout and explainability cards
    temp_file = os.path.join(REPORTS_DIR, f"temp_{id}_report.md")
    rdata = report["report_data"]
    
    # Helper to get confidence and reasoning safely
    def get_explainability(section_key, default_agent):
        obj = rdata.get(section_key) or {}
        score = obj.get("confidence_score") if isinstance(obj, dict) else getattr(obj, "confidence_score", 85)
        reason = obj.get("reasoning") if isinstance(obj, dict) else getattr(obj, "reasoning", "Analysis successfully compiled.")
        return default_agent, score or 85, reason or "Analysis successfully compiled."

    # Build individual explainability cards
    cc_agent, cc_score, cc_reason = get_explainability("career_coach_recommendation", "Career Coach Agent")
    parsed_agent, parsed_score, parsed_reason = get_explainability("resume_info", "Resume Parser Agent")
    ats_agent, ats_score_val, ats_reason = get_explainability("ats_agent_report", "ATS Agent")
    sg_agent, sg_score, sg_reason = get_explainability("skill_gap_agent_report", "Skill Gap Agent")
    grammar_agent, grammar_score, grammar_reason = get_explainability("grammar_agent_report", "Grammar Agent")
    int_agent, int_score, int_reason = get_explainability("interview_questions", "Interview Agent")
    cl_agent, cl_score, cl_reason = get_explainability("cover_letter_agent_report", "Cover Letter Agent")

    cc_rec = rdata.get("career_coach_recommendation") or {}
    cc_readiness = cc_rec.get("readiness", "")
    cc_competitiveness = cc_rec.get("competitiveness", "Medium")
    cc_next = cc_rec.get("next_actions", [])
    
    markdown_content = f"""# AI Career Copilot Analysis Report
**Target Role**: {report['job_role']}
**File Name**: {resume_filename}
**Date Generated**: {report['timestamp']}

---

## 1. Executive Summary
{rdata.get('executive_summary', '')}

*Generated by: Report Generator Agent | Confidence: {rdata.get('final_confidence_score', 85)}%*

---

## 2. Career Coach Recommendation
### Overall Readiness
{cc_readiness}

**Estimated Competitiveness**: {cc_competitiveness}

### Recommended Next Actions
""" + "\n".join([f"- {a}" for a in cc_next]) + f"""

*Generated by: {cc_agent} | Confidence: {cc_score}%*
> **Reasoning**: {cc_reason}

---

## 3. ATS Score: {report['ats_score']}/100
### Formatting Issues & Feedback
""" + "\n".join([f"- {s}" for s in rdata.get('ats_agent_report', {}).get('formatting_issues', [])]) + f"""

*Generated by: {ats_agent} | Confidence: {ats_score_val}%*
> **Reasoning**: {ats_reason}

---

## 4. Resume Strengths
""" + "\n".join([f"- {s}" for s in rdata.get('strengths', [])]) + f"""

*Generated by: Career Coach Agent & ATS Agent*

---

## 5. Priority Improvements
""" + "\n".join([f"- {s}" for s in cc_rec.get('improvements', [])]) + f"""

*Generated by: {cc_agent} | Confidence: {cc_score}%*
> **Reasoning**: {cc_reason}

---

## 6. Skill Gap Analysis
### Matching Skills
""" + ", ".join(rdata.get('resume_info', {}).get('skills', [])) + f"""

### Missing Skills
""" + "\n".join([f"- {s}" for s in rdata.get('missing_skills', [])]) + f"""

### Skill Acquisition Recommendations
""" + "\n".join([f"- {r}" for r in rdata.get('skill_gap_agent_report', {}).get('recommendations', [])]) + f"""

*Generated by: {sg_agent} | Confidence: {sg_score}%*
> **Reasoning**: {sg_reason}

---

## 7. Grammar & Style Review
### Grammar & Spelling Errors
""" + "\n".join([f"- {g}" for g in rdata.get('grammar_agent_report', {}).get('grammar_errors', [])]) + f"""
""" + "\n".join([f"- {s}" for s in rdata.get('grammar_agent_report', {}).get('spelling_errors', [])]) + f"""

### Tone Suggestions
""" + "\n".join([f"- {t}" for t in rdata.get('grammar_agent_report', {}).get('tone_suggestions', [])]) + f"""

*Generated by: {grammar_agent} | Confidence: {grammar_score}%*
> **Reasoning**: {grammar_reason}

---

## 8. Interview Preparation
### HR & Behavioral Questions
""" + "\n".join([f"- {q}" for q in rdata.get('interview_questions', {}).get('hr_questions', [])]) + f"""

### Technical Questions
""" + "\n".join([f"- {q}" for q in rdata.get('interview_questions', {}).get('technical_questions', [])]) + f"""

### Project-Based Questions
""" + "\n".join([f"- {q}" for q in rdata.get('interview_questions', {}).get('project_based_questions', [])]) + f"""

*Generated by: {int_agent} | Confidence: {int_score}%*
> **Reasoning**: {int_reason}

---

## 9. Cover Letter
""" + (rdata.get('cover_letter') or "skipped (no job description provided)") + f"""

*Generated by: {cl_agent} | Confidence: {cl_score}%*
> **Reasoning**: {cl_reason}

---

## 10. Resume Improvement History
{rdata.get('improvement_history') or "First version analyzed (no previous history found)."}

*Generated by: System Memory Module*

---

## 11. Final Confidence
- **Overall Confidence Score**: {rdata.get('final_confidence_score', 85)}%

*Generated by: Orchestrator / Validation Agent*

---

## 12. Sources & Research Scope
""" + "\n".join([f"- {s}" for s in rdata.get('sources', [])]) + """

*Generated by: Browser MCP & Filesystem MCP*
"""
    
    with open(temp_file, "w", encoding="utf-8") as f:
        f.write(markdown_content)
        
    return FileResponse(temp_file, media_type="text/markdown", filename=f"{resume_filename}_report.md")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
