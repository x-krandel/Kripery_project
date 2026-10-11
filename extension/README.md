# Rodowód: kontekst dzieła

Rozszerzenie otwiera panel boczny Chrome i bez klucza API szuka zwięzłego kontekstu dzieł w Wikipedii oraz katalogach The Met i Art Institute of Chicago. Skanuje widoczne obrazy, podpisy, tytuł i autora strony, a potem pokazuje krótkie streszczenia oraz kilka podobnych rekordów muzealnych.

## Uruchomienie

1. Otwórz `chrome://extensions` w Chrome, włącz tryb dewelopera i wybierz **Załaduj rozpakowane** dla folderu `extension/`.
2. Odśwież kartę z dziełem. Otwórz panel Rodowód (ikona z literą R na pasku rozszerzeń); skanowanie uzupełni tytuł i autora z treści strony oraz podpisu wybranego obrazu.
3. Wybierz obraz z listy, aby zobaczyć streszczenie dzieła, biogram autora i podobne obiekty muzealne. Możesz poprawić tytuł/autora w sekcji korekty i wybrać **Szukaj ponownie**.

Wyszukiwanie ogranicza liczbę zapytań: jedno trafienie Wikipedii na język dla dzieła i autora oraz do dwóch rekordów na muzeum. Daty i techniki pochodzą z wykrytych danych strony lub rekordów muzealnych; podobny rekord nie potwierdza tożsamości obrazu.

## Prywatność i ograniczenia

Rozszerzenie nie wysyła obrazu ani klucza API. Wysyła zapytania tekstowe do publicznych API Wikipedii i muzeów. Prywatne, nieznane lub współczesne prace mogą nie mieć odpowiednich rekordów; w takim przypadku można poprawić wykryty tytuł lub autora.

## Wygląd

Panel korzysta z tych samych kolorów i krojów co serwis Rodowód (`frontend/src/index.css`): Cormorant Garamond w nagłówkach i Manrope w tekście. Fonty leżą w `fonts/` (licencja SIL Open Font License 1.1, pliki `OFL-*.txt`), więc panel nie pobiera niczego z Google Fonts. Ikony są w `icons/`.
