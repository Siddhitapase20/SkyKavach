"""Builds two outputs from src/:
 dist/index.html      full standalone page (open locally or host anywhere; webcam-free, works offline except fonts)
 dist/skykavach.html  same page as content-only HTML for publishing as a Claude artifact
"""
import pathlib
src = pathlib.Path(__file__).parent / 'src'
dist = pathlib.Path(__file__).parent / 'dist'; dist.mkdir(exist_ok=True)
css = (src/'styles.css').read_text()
body = (src/'body.html').read_text()
js = '\n'.join((src/f).read_text() for f in ['engine.js', 'data.js', 'i18n.js', 'app.js'])
head = """<title>SkyKavach Command Centre</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="description" content="Site-aware drone threat detection for critical infrastructure. Detect. Judge. Prove.">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&family=Noto+Sans+Devanagari:wght@400;600&family=Rajdhani:wght@500;600;700&display=swap">
"""
content = f"{head}<style>\n{css}\n</style>\n{body}\n<script>\n{js}\n</script>\n"
(dist/'skykavach.html').write_text(content)
(dist/'index.html').write_text('<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n' + content.replace(body, '') .replace('<script>', '</head><body>\n' + body + '\n<script>', 1) + '</body></html>\n')
import subprocess
subprocess.run(['node', str(pathlib.Path(__file__).parent / 'tools_phrases.js')], cwd=pathlib.Path(__file__).parent, check=True)
print('built', len(content)//1024, 'KB')
