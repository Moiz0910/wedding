# Wedding invitation site (envelope + invitation codes)

Flow: envelope > enter code > your event page. Guest data comes from Microsoft Access.

## Folders
- `index.html`, `style.css`, `app.js`: the website (edit names at the top of `app.js`)
- `access-export/`: the 3 CSV files exported from Access (Events, Invitations, Guests)
- `tools/build.py`: turns the CSVs into encrypted files in `data/`
- `codes.csv`: your list of codes to send out (never uploaded to GitHub)

## Update workflow
1. Edit guests in Access. Export Events, Invitations and Guests as CSV (UTF-8) into `access-export/`.
2. Run `python tools/build.py`
3. Commit and push. GitHub Pages updates in about a minute.

Test locally with `python -m http.server` and open http://localhost:8000 (browsers block the code check on file://).
