# Датасет военных потерь

`lost.csv`: одна строка на объект из базы strat wojennych MKiDN (dzielautracone.gov.pl):

| колонка | пример |
| --- | --- |
| `title` | Portret młodzieńca |
| `artist` | Rafael Santi |
| `source_url` | ссылка на запись в базе |
| `image_file` | `raphael-portret.jpg` (файл лежит в `images/`) |

Картинки ужимаем до 800 px по длинной стороне. Индексация: `python -m scripts.index_lost` из папки `backend/`.
