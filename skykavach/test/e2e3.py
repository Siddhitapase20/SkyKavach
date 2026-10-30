import asyncio, sys
from playwright.async_api import async_playwright
OUT = sys.argv[1]
async def login(pg, name, role):
    if await pg.evaluate("document.querySelector('#login').hidden"): await pg.click('#userChip')
    await pg.fill('#loginName', name); await pg.click(f'#roleCards input[value={role}]', force=True); await pg.click('#loginForm button[type=submit]'); await pg.wait_for_timeout(400)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width':1440,'height':1000})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file:///home/claude/skykavach/dist/index.html'); await pg.wait_for_timeout(1000)
        await pg.screenshot(path=f'{OUT}/v3_login.png')
        ev = pg.evaluate
        vis = "[...document.querySelectorAll('#tabs button')].filter(b=>!b.hidden).map(b=>b.dataset.view).join(',')"
        for role in ['Guard','Police','Supervisor','Admin']:
            await login(pg, 'Test '+role, role)
            print(role, 'tabs:', await ev(vis), '| demo card:', not await ev("document.querySelector('#demoCard').hidden"), '| phones:', not await ev("document.querySelector('#phonesCard').hidden"), '| sup phone:', not await ev("document.querySelector('#phoneSup').hidden"))
        await login(pg, 'Dhanshree', 'Supervisor')
        # custom flight
        await pg.click('#cfDraw')
        box = await (await pg.query_selector('#map')).bounding_box()
        for fx,fy in [(0.05,0.9),(0.4,0.5),(0.66,0.2)]:
            await pg.mouse.click(box['x']+box['width']*fx, box['y']+box['height']*fy); await pg.wait_for_timeout(150)
        print('cf info:', await pg.inner_text('#cfInfo'))
        await pg.click('#cfFly'); await ev("SKAPP.S.speed=8")
        for i in range(60):
            await pg.wait_for_timeout(500)
            lv = await ev("(SKAPP.S.tracks.find(t=>t.cls==='drone')||{}).score?.level")
            if lv=='HIGH': break
        print('custom flight level:', lv, 'pattern:', await ev("SKAPP.S.tracks[0].pat.label"))
        print('scenInfo:', (await pg.inner_text('#scenInfo'))[:140].replace('\n',' | '))
        await ev("SKAPP.S.speed=1"); await pg.wait_for_timeout(800)
        await pg.screenshot(path=f'{OUT}/v3_live.png', full_page=True)
        # scenario explain
        await pg.click('#scenarios [data-sc=orbit]'); await pg.wait_for_timeout(400)
        print('orbit info:', (await pg.inner_text('#scenInfo'))[:160].replace('\n',' | '))
        # voice in marathi with no voices: clip fallback then toast
        await pg.click('#langSeg [data-lang=mr]'); await pg.click('#testSoundBtn'); await pg.wait_for_timeout(3000)
        print('voice note toast:', (await pg.inner_text('#toast'))[-170:].replace('\n',' | '))
        print('voice options:', await ev("[...document.querySelectorAll('#voiceSel option')].map(o=>o.textContent).join(' / ')"))
        await pg.click('#langSeg [data-lang=en]')
        # guard cannot use demo controls
        await login(pg, 'Ramesh', 'Guard')
        print('guard posture disabled:', await ev("document.querySelector('#postureSel').disabled"))
        # police sees evidence
        await login(pg, 'Inspector', 'Police')
        await ev("SKAPP.setView('evidence')"); await pg.wait_for_timeout(500)
        await pg.screenshot(path=f'{OUT}/v3_police.png')
        await login(pg, 'Admin A', 'Admin'); await ev("SKAPP.setView('users')"); await pg.wait_for_timeout(500)
        print('sessions rows:', await ev("document.querySelectorAll('#sessionList tr').length"), 'audit rows:', await ev("document.querySelectorAll('#accessLog tr').length"))
        await pg.screenshot(path=f'{OUT}/v3_users.png')
        for v in ['setup','shield','memory','redteam']:
            await ev(f"SKAPP.setView('{v}')"); await pg.wait_for_timeout(500); await pg.screenshot(path=f'{OUT}/v3_{v}.png', full_page=True)
        # guided demo smoke (fast)
        await ev("SKAPP.setView('live')"); await pg.click('#demoBtn'); steps=set()
        for i in range(200):
            await pg.wait_for_timeout(1000)
            c = await ev("document.querySelector('#demoCaption').hidden ? '' : document.querySelector('#demoCaption b').innerText")
            if c: steps.add(c.split('·')[0].strip())
            if i>5 and await ev("!document.querySelector('#demoBtn').textContent.includes('Stop')"): break
        print('demo steps seen:', sorted(steps), 'in', i, 's; role after:', await ev("SKAPP.S.role"))
        print('ERRORS', errs[:8])
        await b.close()
asyncio.run(main())
