import os
import sys
import dotenv

dotenv.load_dotenv()

# Configure environment for Google AI Studio (developer API key)
os.environ["GOOGLE_GENAI_USE_VERTEXAI"] = "False"
if "GEMINI_API_KEY" in os.environ and "GOOGLE_API_KEY" not in os.environ:
    os.environ["GOOGLE_API_KEY"] = os.environ["GEMINI_API_KEY"]

# Import the actual workflow to expose it as root
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from agents.agent_workflow import career_copilot_workflow

from google.adk.apps import App

root_agent = career_copilot_workflow
app = App(root_agent=root_agent, name="app")
