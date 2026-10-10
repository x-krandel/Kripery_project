from fastapi import HTTPException


def api_error(status: int, code: str, message: str) -> HTTPException:
    return HTTPException(status_code=status, detail={"code": code, "message": message})


def format_pln(amount: int) -> str:
    return f"{amount:,}".replace(",", " ") + " zł"


def no_user() -> HTTPException:
    return api_error(401, "NO_USER", "Wybierz użytkownika demo")


NOT_FOUND_ARTWORK = "Nie znaleziono dzieła"
NOT_FOUND_AUCTION = "Nie znaleziono aukcji"
NOT_FOUND_UPLOAD = "Nie znaleziono przesłanego pliku"


def not_found(message: str) -> HTTPException:
    return api_error(404, "NOT_FOUND", message)


def not_owner() -> HTTPException:
    return api_error(403, "NOT_OWNER", "To dzieło należy do innego użytkownika")
