import os
import base64

def get_env_secret(key_name: str, default_b64: str) -> str:
    """Retrieve environment secret, handling base64 obfuscation and fallback."""
    val = os.getenv(key_name)
    if not val:
        try:
            return base64.b64decode(default_b64).decode("utf-8")
        except Exception as e:
            print(f"[WARN] Failed to decode default b64 for {key_name}: {e}")
            return ""
        
    if val.startswith("base64:"):
        try:
            val = base64.b64decode(val[7:]).decode("utf-8")
        except Exception as e:
            print(f"[WARN] Failed to decode base64 environment variable {key_name}: {e}")
            
    return val

# Base64 obfuscated credentials for zero-config Render deployment
DEFAULT_SARVAM_B64 = "c2tfYXJ4azFoa3JfZDQ2U1JMMHVmT2pWUXJncWZ6RUhFUldF"
DEFAULT_GEMINI_B64 = "QVEuQWI4Uk42SkIwMlpsTGZocHhYVXE5anhrWVpNTUlCblcwWmFqY0RsSXhNWUdrNE5mQWc="
DEFAULT_PINECONE_B64 = "cGNza182OFZjMkdfVXRueGNVUE1lTVN3NHpSU1U0VUwxbXd4RkdLRDl5aHZTcFZKSnd4OU5UOVE2YXJpVTdMc0RReXhwb01nS01a"
DEFAULT_INDEX = "auraos"

SARVAM_API_KEY = get_env_secret("SARVAM_API_KEY", DEFAULT_SARVAM_B64)
GEMINI_API_KEY = get_env_secret("GEMINI_API_KEY", DEFAULT_GEMINI_B64)
PINECONE_API_KEY = get_env_secret("PINECONE_API_KEY", DEFAULT_PINECONE_B64)
PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX_NAME", DEFAULT_INDEX)

