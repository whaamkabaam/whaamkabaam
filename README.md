<picture>
  <source media="(max-width: 500px)" srcset="https://raw.githubusercontent.com/whaamkabaam/whaamkabaam/output/coach-narrow.svg">
  <img alt="the year card. the complaint 'i can't see what you build', answered with where the last year's contributions went: mostly the coach, then summerup, klips and ponda, drawn as stacked bands under one rising curve, with the public-repo line flat along the floor, the live discord member count, and the date. the exact numbers are printed on the card." src="https://raw.githubusercontent.com/whaamkabaam/whaamkabaam/output/coach.svg">
</picture>

i build an aim coach. you tell it how your aim feels and it reshapes your mouse acceleration curve. this is the whole product, at full size:

<picture>
  <source media="(max-width: 500px)" srcset="https://raw.githubusercontent.com/whaamkabaam/whaamkabaam/output/demo-narrow.svg">
  <img alt="the coach in one exchange. a player writes 'my flicks overshoot'. the coach answers 'pulled your close range back.' and the sensitivity curve's fast end drops from the dashed old shape to the gold new one, slow end unchanged." src="https://raw.githubusercontent.com/whaamkabaam/whaamkabaam/output/demo.svg">
</picture>

1,500+ clients, 9,000+ curves coached. the discord count is on the card, live. i peaked #956 on the eu valorant ladder, which is the only reason anyone let me near their sensitivity in the first place.

**[whaamkabaam.com](https://whaamkabaam.com)** the coach. describe the problem, get a curve back.

**[plox](https://github.com/whaamkabaam/plox)** a lox interpreter in python, tree walking, 68 tests. written to find out what a parser actually does.

**ponda** saved tiktoks and reels turned into memory you can query. bun, postgres, gemini. not public yet.

**[summerup](https://summerup.berlin)** a week-long startup hackathon at code berlin, which i help run. the rule is sell it before you build it.

before the coach: gaming automation and small ml models, which is where the curve math came from. before that: a minecraft channel at ten, a 30+ page instagram network sold at fifteen. the shape has not changed much.

software engineering at code university berlin. spent summer 2026 at the stanford international honors program.

[discord](https://discord.gg/whaam) · [tiktok](https://tiktok.com/@whaamkabaam) · [twitch](https://twitch.tv/whaamkabaam)

<!--
the cards are svgs on the output branch of this repo, a desktop and a phone cut of each. nothing is proxied through a third party that can go down. the per-project split appears only when a token that can see the private repos is present; without it the card falls back to private vs public.

the date on the card is the last day github had data for when the job last ran. it is not a promise that it refreshes. if this ever stops, you will watch that date go stale instead of reading a claim.

it commits as github-actions[bot] onto a branch that is not the default, so redrawing the card never adds to the number the card draws.

two weights of inter, subset and base64'd into each file. about 35 kb per card, 20 of it font, 19 over the wire. the build fails on any character that is not in the subset.

if you came to copy it: https://github.com/whaamkabaam/whaamkabaam (scripts/render.mjs)
-->
