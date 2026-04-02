from app.core.supabase import supabase_client
from app.config import settings

def generate_upload_url(workspace_id: str, meeting_id: str, filename: str) -> dict:
    """
    Generate a signed URL for direct frontend upload.
    Returns the signed URL and the final storage path.
    """
    path = f"{workspace_id}/{meeting_id}/{filename}"
    res = supabase_client.storage.from_(settings.SUPABASE_BUCKET_NAME).create_signed_upload_url(path)
    
    # Depending on supabase SDK returned object structure
    if isinstance(res, dict):
        signed_url = res.get("signedUrl") or res.get("signed_url")
        token = res.get("token")
    else:
        signed_url = getattr(res, "signed_url", getattr(res, "signedUrl", str(res)))
        token = getattr(res, "token", None)
        
    return {
        "upload_url": signed_url,
        "token": token,
        "path": path,
        "full_supabase_uri": f"supabase://{settings.SUPABASE_BUCKET_NAME}/{path}"
    }

def delete_file(storage_uri: str) -> bool:
    """
    Deletes a file given its storage path.
    """
    path = storage_uri.replace(f"supabase://{settings.SUPABASE_BUCKET_NAME}/", "")
    try:
        supabase_client.storage.from_(settings.SUPABASE_BUCKET_NAME).remove([path])
        return True
    except Exception:
        return False
        
def generate_download_url(storage_uri: str, expires_in: int = 3600) -> str:
    path = storage_uri.replace(f"supabase://{settings.SUPABASE_BUCKET_NAME}/", "")
    res = supabase_client.storage.from_(settings.SUPABASE_BUCKET_NAME).create_signed_url(path, expires_in)
    
    if isinstance(res, dict):
        return res.get("signedUrl") or res.get("signed_url", "")
    return getattr(res, "signed_url", getattr(res, "signedUrl", str(res)))
