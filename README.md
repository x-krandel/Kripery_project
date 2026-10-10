# Rodowód

**Każde dzieło ma swój rodowód.** Platforma aukcyjna dla kolekcjonerów, w której każde dzieło ma cyfrowy paszport pochodzenia, a każdy nowy lot jest automatycznie sprawdzany w bazie polskich strat wojennych.

BEST Hacks 2026 · Code for Culture · kategoria: **Sztuka**

## Problem

- Na rynku sztuki historia dzieła (proweniencja) ginie przy każdej sprzedaży: rachunki, katalogi i rodzinne opowieści zostają w szufladach.
- W polskiej bazie strat wojennych MKiDN figuruje ponad 65 000 dzieł. Część z nich wciąż wypływa na aukcjach — także w Polsce.
- Kupujący nie ma prostego sposobu, żeby sprawdzić, skąd pochodzi obraz i czy jego historia nie została „poprawiona”.

## Rozwiązanie

1. **Paszport dzieła** — każde wydarzenie (powstanie, wystawa, konserwacja, zmiana właściciela) to wpis w łańcuchu SHA-256. Zmiana dowolnego wpisu wstecz natychmiast zmienia status na czerwony. Kod QR na odwrociu prowadzi do publicznego paszportu.
2. **Weryfikacja w bazie strat wojennych** — zdjęcie nowego dzieła porównujemy (embeddingi CLIP + pgvector) z obiektami z bazy MKiDN. Przy dużym podobieństwie publikacja jest wstrzymywana.
3. **Licytacje na żywo** — oferty w czasie rzeczywistym (WebSocket), a po sprzedaży nowy właściciel automatycznie dopisuje się do paszportu.
4. **AI-katalogowanie** — model wizyjny podpowiada tytuł, autora, epokę i technikę na podstawie zdjęcia.

## Architektura

```text
React (Vite, TS, Tailwind)  ──REST + WebSocket──▶  FastAPI  ──▶  PostgreSQL + pgvector
                                                      ├──▶  CLIP (embeddingi obrazów)
                                                      └──▶  Vision LLM (opis dzieła)
```

## Uruchomienie

Instrukcja krok po kroku: [docs/RUN.md](docs/RUN.md). Kontrakt API: [docs/contract.md](docs/contract.md), decyzje backendu: [docs/backend-notes.md](docs/backend-notes.md).

## Struktura

```text
backend/    FastAPI: kontrakt DTO, łańcuch paszportu, weryfikacja strat, aukcje
frontend/   aplikacja React — 6 ekranów
data/       demo/ — obrazy demo, lost/ — zbiór strat wojennych do indeksacji
docs/       uruchomienie, kontrakt API, notatki backendu
```

## Źródła danych

- Baza strat wojennych MKiDN — dzielautracone.gov.pl
- Obrazy demo: domena publiczna (Polona, Rijksmuseum, Met)
