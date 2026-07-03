import os
import sys
from typing import Optional, Any
from pydantic import BaseModel, Field, ConfigDict

from google.adk.workflow import Workflow, node, START, JoinNode
from google.adk.agents import LlmAgent
from google.adk.events import Event
from google.adk.agents.context import Context
from google.adk.tools.mcp_tool import McpToolset
from google.adk.tools.mcp_tool.mcp_session_manager import StdioConnectionParams
from mcp import StdioServerParameters

# Add parent and grandparent to path for local imports
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from backend.mcp.mcp_servers import read_resume as local_read_resume

# Define Input / Output Schemas

class ContactInfo(BaseModel):
    email: Optional[str] = Field(default=None, description="Email address")
    phone: Optional[str] = Field(default=None, description="Phone number")
    location: Optional[str] = Field(default=None, description="Physical location")

class EducationItem(BaseModel):
    school: str = Field(description="Name of the school or institution")
    degree: str = Field(description="Degree or qualification earned")
    year: str = Field(description="Year of graduation or study period")

class ExperienceItem(BaseModel):
    company: str = Field(description="Name of the company")
    role: str = Field(description="Job title or role")
    dates: str = Field(description="Dates of employment")
    description: str = Field(description="Description of responsibilities and achievements")

class ProjectItem(BaseModel):
    name: str = Field(description="Project name")
    description: str = Field(description="Project description")
    technologies: list[str] = Field(description="Technologies used")

class KeywordDensityItem(BaseModel):
    keyword: str = Field(description="The keyword analyzed")
    count: int = Field(description="Number of times the keyword appeared")
    density_percentage: float = Field(description="Density percentage")

class WorkflowInput(BaseModel):
    resume_path: str = Field(description="Absolute path to the resume file")
    job_role: str = Field(description="Target job title or role")
    job_description: Optional[str] = Field(default=None, description="Optional job description text")

class ResumeParserOutput(BaseModel):
    name: str = Field(description="Candidate's full name")
    contact_info: ContactInfo = Field(description="Contact info details")
    education: list[EducationItem] = Field(description="Education history list")
    skills: list[str] = Field(description="List of skills extracted from resume")
    experience: list[ExperienceItem] = Field(description="Experience history list")
    projects: list[ProjectItem] = Field(description="Projects list")
    certifications: list[str] = Field(description="Certifications extracted")
    confidence_score: int = Field(description="Confidence score from 0 to 100")
    reasoning: str = Field(description="Short reasoning summary explaining the parsing evaluation")

class AtsAnalysisOutput(BaseModel):
    formatting_issues: list[str] = Field(description="Formatting improvements or issues found")
    keyword_density: list[KeywordDensityItem] = Field(description="Keyword analysis details")
    ats_compatibility_score: int = Field(description="ATS score out of 100")
    comments: str = Field(description="General ATS compatibility review comments")
    confidence_score: int = Field(description="Confidence score from 0 to 100")
    reasoning: str = Field(description="Short reasoning summary explaining the ATS evaluation")

class SkillGapOutput(BaseModel):
    matching_skills: list[str] = Field(description="Skills that candidate matches")
    missing_skills: list[str] = Field(description="Skills candidate is missing for target role")
    recommendations: list[str] = Field(description="Recommendations on how to acquire missing skills")
    confidence_score: int = Field(description="Confidence score from 0 to 100")
    reasoning: str = Field(description="Short reasoning summary explaining the skill gap evaluation")

class GrammarOutput(BaseModel):
    grammar_errors: list[str] = Field(description="List of grammatical errors")
    spelling_errors: list[str] = Field(description="List of spelling errors")
    tone_suggestions: list[str] = Field(description="Suggestions to make resume tone more professional")
    repeated_content_issues: list[str] = Field(description="Areas where content is repetitive")
    confidence_score: int = Field(description="Confidence score from 0 to 100")
    reasoning: str = Field(description="Short reasoning summary explaining the grammar evaluation")

class InterviewPrepOutput(BaseModel):
    hr_questions: list[str] = Field(description="HR/Behavioral questions")
    technical_questions: list[str] = Field(description="Technical questions related to the role/skills")
    project_based_questions: list[str] = Field(description="Questions specifically based on candidate projects")
    confidence_score: int = Field(description="Confidence score from 0 to 100")
    reasoning: str = Field(description="Short reasoning summary explaining the interview prep evaluation")

class CoverLetterOutput(BaseModel):
    cover_letter: str = Field(description="Personalized cover letter content")
    confidence_score: int = Field(description="Confidence score from 0 to 100")
    reasoning: str = Field(description="Short reasoning summary explaining the cover letter evaluation")

class CareerCoachOutput(BaseModel):
    readiness: str = Field(description="Overall application readiness statement")
    strengths: list[str] = Field(description="Top strengths of the candidate's application")
    improvements: list[str] = Field(description="Highest priority improvements needed")
    competitiveness: str = Field(description="Estimated competitiveness level (e.g., High, Medium, Low)")
    next_actions: list[str] = Field(description="Recommended next actions for the job hunt")
    confidence_score: int = Field(description="Confidence score as an integer out of 100")
    reasoning: str = Field(description="Brief reasoning summary explaining the Career Coach evaluation")

class FinalReport(BaseModel):
    executive_summary: str = Field(description="Brief overview of analysis and score")
    career_coach_recommendation: CareerCoachOutput = Field(description="Career Coach's holistic assessment of application readiness")
    resume_info: ResumeParserOutput = Field(description="Parsed resume content")
    ats_score: int = Field(description="Final ATS score out of 100")
    strengths: list[str] = Field(description="Key strengths of the resume")
    weaknesses: list[str] = Field(description="Key weaknesses of the resume")
    missing_skills: list[str] = Field(description="Top missing skills for target role")
    grammar_suggestions: list[str] = Field(description="Grammar/Tone suggestions")
    professional_improvements: list[str] = Field(description="Formatting and layout improvement recommendations")
    interview_questions: InterviewPrepOutput = Field(description="Tailored interview prep questions")
    cover_letter: Optional[str] = Field(default=None, description="Generated cover letter if job description was provided")
    improvement_history: Optional[str] = Field(default=None, description="Detailed resume version improvement comparison summary")
    final_confidence_score: int = Field(description="Overall aggregate confidence score of all agents")
    sources: list[str] = Field(description="List of resources and searches accessed during research")
    ats_agent_report: AtsAnalysisOutput = Field(description="ATS specialist agent detailed report")
    skill_gap_agent_report: SkillGapOutput = Field(description="Skill gap specialist agent detailed report")
    grammar_agent_report: GrammarOutput = Field(description="Grammar specialist agent detailed report")
    cover_letter_agent_report: Optional[CoverLetterOutput] = Field(default=None, description="Cover letter specialist agent detailed report")


# Setup MCP toolsets
mcp_script = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "mcp", "mcp_servers.py"))
python_cmd = sys.executable or "python3"

filesystem_mcp_tool = McpToolset(
    connection_params=StdioConnectionParams(
        server_params=StdioServerParameters(
            command=python_cmd,
            args=[mcp_script, "filesystem"]
        )
    )
)

sqlite_mcp_tool = McpToolset(
    connection_params=StdioConnectionParams(
        server_params=StdioServerParameters(
            command=python_cmd,
            args=[mcp_script, "sqlite"]
        )
    )
)

browser_mcp_tool = McpToolset(
    connection_params=StdioConnectionParams(
        server_params=StdioServerParameters(
            command=python_cmd,
            args=[mcp_script, "browser"]
        )
    )
)


# Define Workflow Nodes

@node
def init_state(ctx: Context, node_input: WorkflowInput):
    resume_filename = os.path.basename(node_input.resume_path)
    return Event(
        output=node_input.resume_path,
        state={
            "resume_path": node_input.resume_path,
            "resume_filename": resume_filename,
            "job_role": node_input.job_role,
            "job_description": node_input.job_description or "",
            "cover_letter": "",
            "validation_retry_count": 0,
            "ats_analysis_override_guidance": "",
            "retrying_agents": [],
            "improvement_history": ctx.state.get("improvement_history") or "",
            "career_coach": ctx.state.get("career_coach") or {}
        }
    )

@node
async def read_resume_node(ctx: Context, node_input: str):
    resume_text = local_read_resume(node_input)
    if "Error" in resume_text:
        raise ValueError(resume_text)
    
    return Event(
        output=resume_text,
        state={"resume_text": resume_text}
    )


# Agent nodes definitions
# We use 'gemini-2.5-flash' or 'gemini-1.5-flash' as standard
model_name = "gemini-2.0-flash"

resume_parser_agent = LlmAgent(
    name="resume_parser",
    model=model_name,
    mode="single_turn",
    instruction="""You are an expert resume parser. Analyze the raw resume text provided in the input.
    Extract the following details:
    - Candidate name
    - Contact info (email, phone, location)
    - Education history (institutions, degrees, years)
    - Skills (list of keywords)
    - Professional experience (companies, roles, dates, descriptions)
    - Projects (names, descriptions, technologies used)
    - Certifications
    
    Make sure to output a JSON object adhering to the ResumeParserOutput schema.""",
    output_schema=ResumeParserOutput,
    output_key="parsed_resume"
)

ats_analysis_agent = LlmAgent(
    name="ats_analysis",
    model=model_name,
    mode="single_turn",
    instruction="""You are an ATS (Applicant Tracking System) optimization expert.
    Analyze the parsed resume: {parsed_resume}
    
    Assess the following:
    - Formatting issues (e.g. structure, readability, headings)
    - Keyword density (analyze keywords compared to standard professional resumes)
    - ATS compatibility score (an integer out of 100)
    
    {ats_analysis_override_guidance}
    
    Provide helpful feedback and comments. Output must strictly match AtsAnalysisOutput schema.""",
    output_schema=AtsAnalysisOutput,
    output_key="ats_analysis"
)

skill_gap_agent = LlmAgent(
    name="skill_gap",
    model=model_name,
    mode="single_turn",
    instruction="""You are an expert Career Advisor and Skill Gap Analyst.
    Candidate Parsed Resume: {parsed_resume}
    Target Job Role: {job_role}
    Job Description (if provided): {job_description}
    
    Your task:
    1. Research common skills required for this job role using the Browser MCP tool `research_common_skills`.
    2. Research industry trends and technology direction for this role using the Browser MCP tool `research_role_trends`.
    3. Research relevant certifications and typical interview topics/questions using the Browser MCP tool `research_certifications_and_topics`.
    4. If a company name is mentioned in the job description, research the company focus using the Browser MCP tool `research_company`.
    5. Compare candidate's skills with the researched common skills, trends, and the job description.
    6. Identify matching skills, missing skills, and recommend improvements.
    
    Output must match the SkillGapOutput schema.""",
    output_schema=SkillGapOutput,
    output_key="skill_gap",
    tools=[browser_mcp_tool]
)

grammar_review_agent = LlmAgent(
    name="grammar_review",
    model=model_name,
    mode="single_turn",
    instruction="""You are a professional Resume Editor.
    Analyze the candidate's parsed resume: {parsed_resume}
    
    Check for:
    - Grammar errors
    - Spelling errors
    - Repetitive words or content
    - Professional tone improvements
    
    Output must match the GrammarOutput schema.""",
    output_schema=GrammarOutput,
    output_key="grammar_review"
)

interview_prep_agent = LlmAgent(
    name="interview_prep",
    model=model_name,
    mode="single_turn",
    instruction="""You are an expert Interview Coach and Technical Recruiter.
    Parsed Resume: {parsed_resume}
    Target Role: {job_role}
    
    Generate relevant HR, technical, and project-based interview questions tailored to the candidate's experience and target role.
    Output must match the InterviewPrepOutput schema.""",
    output_schema=InterviewPrepOutput,
    output_key="interview_prep"
)

@node(rerun_on_resume=True)
async def check_job_desc(ctx: Context, node_input: Any):
    if ctx.state.get("job_description"):
        cover_letter_res = await ctx.run_node(cover_letter_agent, node_input="")
        return Event(output=cover_letter_res)
    else:
        empty_out = CoverLetterOutput(
            cover_letter="",
            confidence_score=100,
            reasoning="No job description was provided, so cover letter generation was skipped."
        )
        ctx.state["cover_letter"] = empty_out
        return Event(output=empty_out)

cover_letter_agent = LlmAgent(
    name="cover_letter",
    model=model_name,
    mode="single_turn",
    instruction="""You are a professional writer.
    Parsed Resume: {parsed_resume}
    Job Description: {job_description}
    Target Role: {job_role}
    
    Write a personalized and compelling cover letter for the candidate matching the job description.
    Output must match the CoverLetterOutput schema.""",
    output_schema=CoverLetterOutput,
    output_key="cover_letter"
)

career_coach_agent = LlmAgent(
    name="career_coach",
    model=model_name,
    mode="single_turn",
    instruction="""You are a Career Coach Agent.
    Read the outputs of all previous specialist agents from state:
    - ATS Analysis: {ats_analysis}
    - Grammar Review: {grammar_review}
    - Skill Gap: {skill_gap}
    - Interview Prep: {interview_prep}
    - Cover Letter: {cover_letter}
    
    Produce a single coherent recommendation summarizing the candidate's readiness.
    Include:
    - Application readiness statement (overall readiness)
    - Top strengths
    - Highest priority improvements (actionable, prioritized)
    - Estimated competitiveness (e.g. High, Medium, Low)
    - Recommended next actions (as a list)
    - Confidence score (0-100)
    - Brief reasoning summary explaining the Career Coach evaluation
    
    Output must strictly match the CareerCoachOutput schema.""",
    output_schema=CareerCoachOutput,
    output_key="career_coach"
)

def get_field(obj: Any, field_name: str, default: Any = None) -> Any:
    if obj is None:
        return default
    if isinstance(obj, dict):
        return obj.get(field_name, default)
    return getattr(obj, field_name, default)

@node(rerun_on_resume=True)
async def validation_node(ctx: Context, node_input: Any):
    parsed_resume = ctx.state.get("parsed_resume")
    ats_analysis = ctx.state.get("ats_analysis")
    skill_gap = ctx.state.get("skill_gap")
    grammar_review = ctx.state.get("grammar_review")
    interview_prep = ctx.state.get("interview_prep")
    job_description = ctx.state.get("job_description")
    cover_letter = ctx.state.get("cover_letter")
    
    failed_agents = []
    
    # 1. Parsed Resume checks
    if not parsed_resume or not get_field(parsed_resume, "name") or not get_field(parsed_resume, "skills"):
        failed_agents.append(("resume_parser", resume_parser_agent))
        
    # 2. ATS Score checks
    ats_score = None
    if ats_analysis:
        ats_score = get_field(ats_analysis, "ats_compatibility_score")
        if ats_score is None or not (0 <= ats_score <= 100):
            failed_agents.append(("ats_analysis", ats_analysis_agent))
    else:
        failed_agents.append(("ats_analysis", ats_analysis_agent))
        
    # 3. Skill Gap checks
    if not skill_gap or not get_field(skill_gap, "recommendations") or len(get_field(skill_gap, "recommendations", [])) == 0:
        failed_agents.append(("skill_gap", skill_gap_agent))
        
    # 4. Grammar checks
    grammar_errors = []
    spelling_errors = []
    if not grammar_review:
        failed_agents.append(("grammar_review", grammar_review_agent))
    else:
        grammar_errors = get_field(grammar_review, "grammar_errors", []) or []
        spelling_errors = get_field(grammar_review, "spelling_errors", []) or []
        
    # 5. Interview prep checks
    if not interview_prep:
        failed_agents.append(("interview_prep", interview_prep_agent))
    else:
        hr = get_field(interview_prep, "hr_questions", []) or []
        tech = get_field(interview_prep, "technical_questions", []) or []
        proj = get_field(interview_prep, "project_based_questions", []) or []
        if not hr and not tech and not proj:
            failed_agents.append(("interview_prep", interview_prep_agent))
            
    # 6. Cover letter checks
    if job_description and (not cover_letter or not get_field(cover_letter, "cover_letter")):
        failed_agents.append(("cover_letter", cover_letter_agent))
        
    # 7. Contradiction/Conflict detection
    # Conflict: ATS score is high (>=80) but there are grammar or spelling errors (>5 errors total)
    if ats_score is not None and ats_score >= 80:
        total_errors = len(grammar_errors) + len(spelling_errors)
        if total_errors > 5:
            # Contradiction detected: High ATS score but high grammar/spelling issues.
            # Mark ats_analysis to regenerate (to lower the score or re-evaluate layout/spelling integration)
            if ("ats_analysis", ats_analysis_agent) not in failed_agents:
                failed_agents.append(("ats_analysis", ats_analysis_agent))
                ctx.state["ats_analysis_override_guidance"] = (
                    f"\nNOTE FOR REMEDIAL EXECUTION: Validation detected a conflict: ATS Score was {ats_score} but Grammar review found {total_errors} errors. Please re-assess compatibility score and formatting issues with higher rigor.\n"
                )
    
    # Filter out duplicate failed agents
    unique_failed_agents = []
    seen = set()
    for name, agent in failed_agents:
        if name not in seen:
            seen.add(name)
            unique_failed_agents.append((name, agent))
    failed_agents = unique_failed_agents
    
    if not failed_agents:
        # Clear override guidance on success
        ctx.state["ats_analysis_override_guidance"] = ""
        ctx.state["retrying_agents"] = []
        return Event(output="Validation Passed", route="pass")
        
    retry_count = ctx.state.get("validation_retry_count", 0)
    if retry_count < 1:
        ctx.state["validation_retry_count"] = retry_count + 1
        ctx.state["retrying_agents"] = [name for name, _ in failed_agents]
        for name, agent in failed_agents:
            if name == "resume_parser":
                resume_text = ctx.state.get("resume_text", "")
                await ctx.run_node(agent, node_input=resume_text)
            else:
                await ctx.run_node(agent, node_input="")
        return Event(output="Retrying failed agents...", route="retry")
    else:
        error_msg = f"Validation failed after retry for agents: {[name for name, _ in failed_agents]}"
        ctx.state["validation_error"] = error_msg
        ctx.state["retrying_agents"] = []
        return Event(output=error_msg, route="fail")

@node
def handle_validation_error(ctx: Context, node_input: str):
    raise ValueError(node_input)

report_generator_agent = LlmAgent(
    name="report_generator",
    model=model_name,
    mode="single_turn",
    instruction="""You are a Career Consultant.
    Combine all the analysis results from state:
    - Parsed Resume: {parsed_resume}
    - ATS Analysis: {ats_analysis}
    - Skill Gap: {skill_gap}
    - Grammar Review: {grammar_review}
    - Interview Prep: {interview_prep}
    - Cover Letter: {cover_letter}
    - Career Coach Recommendation: {career_coach}
    - Resume Improvement History (if generated): {improvement_history}
    
    Produce a comprehensive report. In the JSON output matching FinalReport schema:
    - executive_summary: A high-level overview.
    - career_coach_recommendation: Directly map the CareerCoachOutput object from {career_coach}.
    - resume_info: Direct map from {parsed_resume}.
    - ats_score: Direct map of the ats_compatibility_score from {ats_analysis}.
    - strengths: Direct map of strengths from {ats_analysis} or {career_coach}.
    - weaknesses: Direct map of weaknesses from {ats_analysis} or {career_coach}.
    - missing_skills: Direct map of missing skills from {skill_gap}.
    - grammar_suggestions: List of spelling/grammar suggestions from {grammar_review}.
    - professional_improvements: List of tone and layout suggestions.
    - interview_questions: Tailored HR/technical/project questions from {interview_prep}.
    - cover_letter: Direct map of cover letter text from {cover_letter}.
    - improvement_history: Direct map of {improvement_history}.
    - final_confidence_score: Calculate the average of all specialist agents' confidence scores.
    - sources: List all search query terms used by the skill gap agent, browser MCP resources, and local files accessed.
    - ats_agent_report: Directly map {ats_analysis}.
    - skill_gap_agent_report: Directly map {skill_gap}.
    - grammar_agent_report: Directly map {grammar_review}.
    - cover_letter_agent_report: Directly map {cover_letter}.
    
    Then save this report using the provided tools:
    1. Save to SQLite DB using the sqlite MCP tool `store_analysis_report`.
       Pass:
         - resume_filename: {resume_filename}
         - ats_score: (extract the ats_compatibility_score integer from ATS Analysis)
         - job_role: {job_role}
         - report_data_json: (JSON string of the final report contents matching the FinalReport schema)
    2. Save to filesystem using the filesystem MCP tool `save_report_file`.
       Save the report to `reports/{resume_filename}_report.md`. (You must write a beautifully styled, complete markdown report using the custom layout requested).
    
    Output must match the FinalReport schema.""",
    output_schema=FinalReport,
    output_key="final_report",
    tools=[filesystem_mcp_tool, sqlite_mcp_tool]
)


validation_join = JoinNode(name="validation_join")

# Define graph workflow
career_copilot_workflow = Workflow(
    name="career_copilot_workflow",
    edges=[
        ('START', init_state),
        (init_state, read_resume_node),
        (read_resume_node, resume_parser_agent),
        
        # Parallel Execution of specialist agents
        (resume_parser_agent, ats_analysis_agent),
        (resume_parser_agent, grammar_review_agent),
        (resume_parser_agent, skill_gap_agent),
        (resume_parser_agent, interview_prep_agent),
        (resume_parser_agent, check_job_desc),
        
        # Join all parallel execution paths
        (ats_analysis_agent, validation_join),
        (grammar_review_agent, validation_join),
        (skill_gap_agent, validation_join),
        (interview_prep_agent, validation_join),
        (check_job_desc, validation_join),
        
        # Validation flow
        (validation_join, validation_node),
        (validation_node, {
            "retry": validation_node,
            "pass": career_coach_agent,
            "fail": handle_validation_error
        }),
        (career_coach_agent, report_generator_agent)
    ],
    input_schema=WorkflowInput,
    output_schema=FinalReport
)
