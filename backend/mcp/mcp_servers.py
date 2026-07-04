import sys
import os
import json
import pypdf
import docx
from mcp.server.fastmcp import FastMCP
from duckduckgo_search import DDGS
from typing import Dict, Any

# Ensure database module is accessible
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
from backend.database import database

class SecurityAgent:
    """Security Agent verifying tool parameters and preventing malicious commands."""
    @staticmethod
    def approve(tool_name: str, args: dict) -> None:
        workspace_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        # Validate Filesystem Operations
        if tool_name in ["read_resume", "save_report_file", "export_improved_resume"]:
            filepath = args.get("filepath", "")
            if not filepath:
                raise PermissionError("Security Agent: Filepath cannot be empty.")
            
            # Normalize path
            if not os.path.isabs(filepath):
                abs_path = os.path.abspath(os.path.join(workspace_root, filepath))
            else:
                abs_path = os.path.abspath(filepath)
            
            # Allow only within workspace_root
            if not abs_path.startswith(workspace_root):
                raise PermissionError(f"Security Agent Blocked Path Traversal: Access to {abs_path} outside workspace is forbidden.")
                
            # Prevent overwriting uploaded resumes
            if tool_name == "save_report_file":
                if "uploads" in abs_path:
                    raise PermissionError("Security Agent: Overwriting files in uploads/ is forbidden.")
                # Verify report export path is in reports/ or is a temp markdown file in reports/
                if "reports" not in abs_path:
                    raise PermissionError("Security Agent: Reports must be saved inside the reports/ folder.")
                    
            if tool_name == "export_improved_resume":
                # Ensure original is not overwritten
                if os.path.exists(abs_path) and "improved" not in os.path.basename(abs_path):
                    raise PermissionError("Security Agent: Overwriting original resume is forbidden. Use improved suffix.")

        # Validate Database Tools
        elif tool_name in ["store_analysis_report", "fetch_analysis_history", "fetch_report_by_id"]:
            report_json = args.get("report_data_json", "")
            role = args.get("job_role", "")
            for input_field in [report_json, role]:
                if any(kw in input_field.upper() for kw in ["DROP TABLE", "DELETE FROM", "UPDATE ", "INSERT INTO"]):
                    raise PermissionError("Security Agent: Database injection attempt blocked.")
            
        # Validate Browser Operations
        elif tool_name in ["research_company", "research_common_skills", "research_role_trends", "research_certifications_and_topics"]:
            query_input = args.get("company_name", "") or args.get("role", "") or args.get("query", "")
            blocked_keywords = ["rm ", "sh ", "sudo", "exec", "flag", "password", "secret"]
            for keyword in blocked_keywords:
                if keyword in query_input.lower():
                    raise PermissionError(f"Security Agent: Suspicious browser search query blocked: contains '{keyword}'.")

        # LLM-based Security Agent Check
        try:
            from google.genai import Client
            from pydantic import BaseModel, Field
            
            class SecurityApproval(BaseModel):
                is_safe: bool = Field(description="True if the request is safe, False if unsafe")
                reason: str = Field(description="Explanation of the safety determination")
                
            client = Client()
            prompt = f"""You are the Security Agent guarding all external filesystem, database, and web search operations in the Career Copilot application.
            Analyze the requested action and decide if it violates safety guidelines.
            
            Workspace Directory: {workspace_root}
            Requested Action: {tool_name}
            Arguments: {json.dumps(args)}
            
            Safety Rules:
            1. Filesystem paths MUST be within the Workspace Directory. Any path starting with "{workspace_root}" is safe. Traversal (like '../' or paths outside that root) is strictly prohibited.
            2. Never allow overwriting files in the 'uploads/' folder or original resume files.
            3. Saved Markdown reports must be written to the 'reports/' directory.
            4. Database operations must not contain SQL injection keywords (DROP TABLE, DELETE FROM, UPDATE, INSERT INTO bypasses).
            5. Web searches must be standard search queries and not execute terminal commands or shell execution (rm, sh, sudo, exec).
            
            Determine if this request is safe and provide your reasoning."""
            
            response = client.models.generate_content(
                model="gemini-2.0-flash",
                contents=prompt,
                config={
                    "response_mime_type": "application/json",
                    "response_schema": SecurityApproval
                }
            )
            result = json.loads(response.text)
            if not result.get("is_safe", True):
                raise PermissionError(f"Security Agent Blocked Request: {result.get('reason')}")
        except PermissionError:
            raise
        except Exception:
            # Fallback if API key is not present or API fails
            pass

# 1. FILESYSTEM MCP
filesystem_mcp = FastMCP("filesystem")

@filesystem_mcp.tool()
def read_resume(filepath: str) -> str:
    """Reads and extracts text from an uploaded resume (PDF, DOCX, or text).
    
    Args:
        filepath: The absolute path to the resume file.
    """
    SecurityAgent.approve("read_resume", {"filepath": filepath})
    if not os.path.isabs(filepath):
        # Allow relative to workspace
        workspace = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        filepath = os.path.join(workspace, filepath)
        
    if not os.path.exists(filepath):
        return f"Error: File not found at {filepath}"
    
    _, ext = os.path.splitext(filepath.lower())
    try:
        if ext == ".pdf":
            reader = pypdf.PdfReader(filepath)
            text = ""
            for page in reader.pages:
                text += page.extract_text() or ""
            return text
        elif ext == ".docx":
            doc = docx.Document(filepath)
            text = ""
            for para in doc.paragraphs:
                text += para.text + "\n"
            return text
        else:
            with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                return f.read()
    except Exception as e:
        return f"Error parsing file: {str(e)}"

@filesystem_mcp.tool()
def save_report_file(filepath: str, content: str) -> str:
    """Saves a generated report to the filesystem.
    
    Args:
        filepath: Absolute path where the report should be saved.
        content: The text content of the report.
    """
    SecurityAgent.approve("save_report_file", {"filepath": filepath})
    try:
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        return f"Report successfully saved to {filepath}"
    except Exception as e:
        return f"Error saving report: {str(e)}"

@filesystem_mcp.tool()
def export_improved_resume(filepath: str, content: str) -> str:
    """Exports an improved version of the resume. Ensures the original is not overwritten.
    
    Args:
        filepath: Absolute path to save the improved resume.
        content: The text content of the improved resume.
    """
    SecurityAgent.approve("export_improved_resume", {"filepath": filepath})
    try:
        # Prevent overwrite
        if os.path.exists(filepath):
            dir_name, file_name = os.path.split(filepath)
            name, ext = os.path.splitext(file_name)
            filepath = os.path.join(dir_name, f"{name}_improved{ext}")
            
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        return f"Improved resume exported to {filepath}"
    except Exception as e:
        return f"Error exporting resume: {str(e)}"


# 2. SQLITE MCP
sqlite_mcp = FastMCP("sqlite")

@sqlite_mcp.tool()
def store_analysis_report(resume_filename: str, ats_score: int, job_role: str, report_data_json: str) -> str:
    """Stores the analysis history, ATS scores, and generated reports in the SQLite database.
    
    Args:
        resume_filename: The name of the analyzed resume file.
        ats_score: The generated ATS score (out of 100).
        job_role: The targeted job role.
        report_data_json: JSON string of the full report content.
    """
    SecurityAgent.approve("store_analysis_report", {"job_role": job_role, "report_data_json": report_data_json})
    try:
        report_dict = json.loads(report_data_json)
        inserted_id = database.save_analysis(resume_filename, ats_score, job_role, report_dict)
        return f"Success: Analysis saved with ID {inserted_id}"
    except Exception as e:
        return f"Error saving to database: {str(e)}"

@sqlite_mcp.tool()
def fetch_analysis_history() -> str:
    """Fetches the previous analysis history from the database."""
    SecurityAgent.approve("fetch_analysis_history", {})
    try:
        history = database.get_all_analyses()
        return json.dumps(history)
    except Exception as e:
        return f"Error fetching history: {str(e)}"

@sqlite_mcp.tool()
def fetch_report_by_id(analysis_id: int) -> str:
    """Fetches a specific analysis report by its database ID.
    
    Args:
        analysis_id: The unique ID of the analysis.
    """
    SecurityAgent.approve("fetch_report_by_id", {})
    try:
        report = database.get_analysis_by_id(analysis_id)
        if report:
            return json.dumps(report)
        return f"Error: Analysis ID {analysis_id} not found."
    except Exception as e:
        return f"Error fetching report: {str(e)}"


# 3. BROWSER MCP
browser_mcp = FastMCP("browser")

@browser_mcp.tool()
def research_company(company_name: str) -> str:
    """Researches a company online to find their business focus, core products, and recent news.
    
    Args:
        company_name: The name of the company to research.
    """
    SecurityAgent.approve("research_company", {"company_name": company_name})
    query = f"{company_name} company overview products news"
    try:
        with DDGS() as ddgs:
            results = ddgs.text(query, max_results=5)
            if not results:
                return f"No online information found for company: {company_name}"
            formatted = []
            for r in results:
                formatted.append(f"Title: {r['title']}\nSnippet: {r['body']}\n")
            return f"Search results for company '{company_name}':\n\n" + "\n".join(formatted)
    except Exception as e:
        return f"Error searching for company: {str(e)}"

@browser_mcp.tool()
def research_common_skills(role: str) -> str:
    """Researches the common technical and soft skills required for a given job role.
    
    Args:
        role: The job title or role to research.
    """
    SecurityAgent.approve("research_common_skills", {"role": role})
    query = f"top key skills required for {role} job description"
    try:
        with DDGS() as ddgs:
            results = ddgs.text(query, max_results=5)
            if not results:
                return f"No common skills found online for role: {role}"
            formatted = []
            for r in results:
                formatted.append(f"Title: {r['title']}\nSnippet: {r['body']}\n")
            return f"Common skills research for role '{role}':\n\n" + "\n".join(formatted)
    except Exception as e:
        return f"Error searching for skills: {str(e)}"

@browser_mcp.tool()
def research_role_trends(role: str) -> str:
    """Researches the latest industry trends and technology direction for a given job role.
    
    Args:
        role: The job title or role to research.
    """
    SecurityAgent.approve("research_role_trends", {"role": role})
    query = f"latest industry trends technology shifts for {role}"
    try:
        with DDGS() as ddgs:
            results = ddgs.text(query, max_results=5)
            if not results:
                return f"No industry trends found online for role: {role}"
            formatted = []
            for r in results:
                formatted.append(f"Title: {r['title']}\nSnippet: {r['body']}\n")
            return f"Industry trends research for role '{role}':\n\n" + "\n".join(formatted)
    except Exception as e:
        return f"Error searching for trends: {str(e)}"

@browser_mcp.tool()
def research_certifications_and_topics(role: str) -> str:
    """Researches relevant professional certifications and typical interview topics/questions for a given job role.
    
    Args:
        role: The job title or role to research.
    """
    SecurityAgent.approve("research_certifications_and_topics", {"role": role})
    query = f"top certifications typical interview questions topics for {role}"
    try:
        with DDGS() as ddgs:
            results = ddgs.text(query, max_results=5)
            if not results:
                return f"No certifications or interview topics found online for role: {role}"
            formatted = []
            for r in results:
                formatted.append(f"Title: {r['title']}\nSnippet: {r['body']}\n")
            return f"Certifications and interview topics research for role '{role}':\n\n" + "\n".join(formatted)
    except Exception as e:
        return f"Error searching for certifications/topics: {str(e)}"


if __name__ == "__main__":
    server = sys.argv[1] if len(sys.argv) > 1 else "filesystem"
    if server == "filesystem":
        filesystem_mcp.run()
    elif server == "sqlite":
        sqlite_mcp.run()
    elif server == "browser":
        browser_mcp.run()
    else:
        print(f"Unknown MCP server: {server}", file=sys.stderr)
        sys.exit(1)
