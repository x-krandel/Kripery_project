from fastapi import APIRouter

from app.config import settings
from app.deps import CurrentUser, Db
from app.errors import NOT_FOUND_UPLOAD, api_error, not_found
from app.models import Upload
from app.schemas import AiDescribeRequest, AiDescriptionDto
from app.services import ai_describe

router = APIRouter(tags=["ai"])


@router.post("/ai/describe", response_model=AiDescriptionDto)
def describe(db: Db, user: CurrentUser, req: AiDescribeRequest):
    # Login required (user is unused): every call spends LLM credits.
    upload = db.get(Upload, req.upload_id)
    if upload is None:
        raise not_found(NOT_FOUND_UPLOAD)
    try:
        return ai_describe.describe(settings.media_dir / upload.file_name)
    except Exception:
        raise api_error(502, "AI_UNAVAILABLE", "Automatyczny opis jest teraz niedostępny") from None
