import uuid
from typing import Annotated

from fastapi import APIRouter, File, UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError

from app.config import settings
from app.deps import Db
from app.errors import api_error
from app.models import Upload
from app.schemas import UploadDto
from app.timeutil import utcnow

router = APIRouter(tags=["uploads"])

MAX_BYTES = 10 * 1024 * 1024
MAX_SIDE = 1600
CHUNK = 1024 * 1024
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}


def too_large():
    return api_error(413, "FILE_TOO_LARGE", "Plik jest większy niż 10 MB")


def unsupported():
    return api_error(415, "UNSUPPORTED_FILE", "Obsługiwane formaty: JPG, PNG, WebP")


@router.post("/uploads", response_model=UploadDto, status_code=201)
def create_upload(db: Db, file: Annotated[UploadFile, File()]):
    if file.size is not None and file.size > MAX_BYTES:
        raise too_large()
    read = 0
    while chunk := file.file.read(CHUNK):
        read += len(chunk)
        if read > MAX_BYTES:
            raise too_large()
    file.file.seek(0)

    # The format is taken from the bytes, not from the client's Content-Type.
    try:
        with Image.open(file.file) as img:
            if img.format not in ALLOWED_FORMATS:
                raise unsupported()
            # Phone photos carry rotation in EXIF; bake it in so the stored
            # image and its CLIP embedding are upright.
            img = ImageOps.exif_transpose(img).convert("RGB")
            img.thumbnail((MAX_SIDE, MAX_SIDE))
            upload_id = str(uuid.uuid4())
            file_name = f"{upload_id}.jpg"
            settings.media_dir.mkdir(parents=True, exist_ok=True)
            img.save(settings.media_dir / file_name, "JPEG", quality=88)
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
        raise unsupported() from None

    upload = Upload(id=upload_id, file_name=file_name, created_at=utcnow())
    db.add(upload)
    db.commit()
    return UploadDto(upload_id=upload.id, image_url=upload.image_url)
