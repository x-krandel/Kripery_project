# Kripery: kontekst dzieła

Rozszerzenie otwiera panel boczny Chrome. Pozwala wybrać widoczny obraz ze strony lub plik z urządzenia, a następnie wysyła obraz do Gemini Flash z Google Search grounding. Panel pokazuje analizę motywów, możliwą identyfikację, zweryfikowany kontekst i linki do źródeł.

## Uruchomienie

1. Uruchom backend projektu zgodnie z instrukcją w `docs/RUN.md`.
2. Otwórz `chrome://extensions` w Chrome i włącz tryb dewelopera.
3. Wybierz **Załaduj rozpakowane** i wskaż folder `extension/`.
4. Otwórz stronę z obrazami, kliknij ikonę Kripery na pasku przeglądarki i wybierz obraz z listy albo kliknij obraz na stronie.
5. W `extension/config.js` zastąp `WKLEJ_TUTAJ_NOWY_KLUCZ` nowym kluczem Gemini API. Nie używaj klucza, który został wcześniej udostępniony.
6. Odśwież rozszerzenie na `chrome://extensions` i odśwież kartę z obrazem.
7. Panel automatycznie skanuje widoczne obrazy i wybiera największy. Możesz też wybrać inny obraz albo dodać plik z urządzenia, a następnie wybrać **Odkryj historię obrazu**.

Wyszukiwanie używa modelu `gemini-2.5-flash` i narzędzia Google Search. Linki źródłowe są prezentowane osobno pod odpowiedzią. Wymagany jest aktywny klucz Google Gemini API z dostępem do tego modelu i Google Search grounding.

## Prywatność i ograniczenia

Obraz jest przesyłany do Google Gemini w celu analizy. Klucz wpisany do `config.js` jest częścią rozszerzenia i można go odczytać z jego plików. Ogranicz klucz limitami i dostępem wyłącznie do Generative Language API; rozwiązanie serwerowe jest właściwe dla produkcji. Strony Chrome z ograniczonym dostępem, takie jak `chrome://`, nie udostępniają obrazów rozszerzeniu. Wynik AI może się mylić; traktuj identyfikację jako trop i sprawdzaj podane źródła.