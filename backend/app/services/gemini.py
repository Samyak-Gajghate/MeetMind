import google.generativeai as genai
from app.config import settings
from app.schemas.gemini import GeminiProcessedResponse
import json

genai.configure(api_key=settings.GEMINI_API_KEY)

system_instruction = """
You are an expert meeting analyst. Your task is to process meeting transcripts and extract a comprehensive summary, key decisions, and action items.
IMPORTANT: You must return the output STRICTLY as a JSON object matching this JSON Schema:
{
  "type": "object",
  "properties": {
    "summary": {"type": "string"},
    "action_items": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "description": {"type": "string"},
          "owner_name": {"type": ["string", "null"]},
          "due_date": {"type": ["string", "null"], "format": "date", "description": "YYYY-MM-DD"},
          "priority": {"type": "string", "enum": ["low", "medium", "high"]}
        },
        "required": ["description", "priority"]
      }
    },
    "decisions": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "description": {"type": "string"}
        },
        "required": ["description"]
      }
    }
  },
  "required": ["summary", "action_items", "decisions"]
}
"""

def get_model():
    return genai.GenerativeModel(
        model_name=settings.GEMINI_MODEL,
        system_instruction=system_instruction,
        generation_config={"response_mime_type": "application/json"}
    )

async def process_meeting_transcript(transcript_text: str) -> GeminiProcessedResponse:
    model = get_model()
    # Prompt injection mitigation: wrap carefully.
    user_prompt = f"Please process the following transcript.\n\n<transcript>\n{transcript_text}\n</transcript>"
    
    response = model.generate_content(user_prompt)
    try:
        result_dict = json.loads(response.text)
        return GeminiProcessedResponse(**result_dict)
    except Exception as e:
        raise ValueError(f"Failed to parse or validate Gemini response: {str(e)}")
