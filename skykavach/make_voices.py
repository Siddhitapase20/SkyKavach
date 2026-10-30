"""Record every SkyKavach alert in natural native voices (run once, needs internet).

  pip install edge-tts
  python make_voices.py

Creates dist/voices/mr/*.mp3 (Marathi: Aarohi) and dist/voices/hi/*.mp3 (Hindi: Swara).
After that the app speaks proper Marathi and Hindi even offline and in Chrome.
Change VOICES below to use male voices: mr-IN-ManoharNeural, hi-IN-MadhurNeural.
"""
import asyncio, json, pathlib
import edge_tts

VOICES = {'mr': 'mr-IN-AarohiNeural', 'hi': 'hi-IN-SwaraNeural'}
ROOT = pathlib.Path(__file__).parent / 'dist' / 'voices'


async def main():
    phrases = json.loads((ROOT / 'phrases.json').read_text(encoding='utf-8'))
    done = 0
    for p in phrases:
        out = ROOT / p['lang'] / f"{p['key']}.mp3"
        out.parent.mkdir(parents=True, exist_ok=True)
        if out.exists() and out.stat().st_size > 0:
            continue
        await edge_tts.Communicate(p['text'], VOICES[p['lang']], rate='-5%').save(str(out))
        done += 1
        if done % 20 == 0:
            print(f'{done} clips recorded…')
    print(f'Done: {done} new clips in {ROOT}')

asyncio.run(main())
