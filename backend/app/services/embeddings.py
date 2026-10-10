import threading
from pathlib import Path

from PIL import Image, ImageOps

MODEL_NAME = "clip-ViT-B-32"

_model = None
_lock = threading.Lock()


def load_model() -> None:
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer

        _model = SentenceTransformer(MODEL_NAME, device="cpu")


def embed_image(path: Path) -> list[float]:
    load_model()
    with Image.open(path) as img:
        img = ImageOps.exif_transpose(img).convert("RGB")
        with _lock:
            vec = _model.encode(img, normalize_embeddings=True)
    return vec.tolist()
