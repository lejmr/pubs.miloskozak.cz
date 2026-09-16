---
title: "My used-to-be-loved projects, refreshed with Claude"
date: 2026-09-16
tags: [ai, agents, claude-code, dokuwiki, maintenance, testing]
---

In 2018 I wrote a small [DokuWiki plugin](https://github.com/lejmr/dokuwiki-plugin-drawio) that embeds [draw.io](https://www.drawio.com) diagrams into wiki pages. Then life happened. Issues kept arriving, and every time I looked into my github profile I felt bad about it and did nothing, because I stopped using it around 2021. The plugin is still in the top 5 % of the DokuWiki plugin catalogue by popularity, people fork it and fix it for themselves. Download counts are still rising as people are still using it.

So the experiment was not "can AI write a feature". It was: **can I set up a flow where agents integrate external changes, fix issues, and keep the thing alive, with me doing only the validation?** And it would not be me if I did not want the basic features under tests, so I know exactly what is breaking and what is not.

I have mixed feelings about how it went. I started on Sunday evening and ran the first day from my phone, so I could not test anything, and Claude was confident everything was going fine. When I got to the computer, I realised that everything works and nothing works at the same time.

<!--more-->

## Monday evening: a very tidy pile of nothing

The numbers looked great. Twelve of thirteen issues closed, each with a test. A `SECURITY.md` with findings that were real (CSRF on the save endpoint, an ACL check against the wrong namespace). Features I had wanted for years: the diagram XML stored next to the image so an optimiser cannot eat it, an advisory lock, searchable labels, a release button.

Then I opened the wiki and clicked.

The "Edit with draw.io" button threw `TypeError: Cannot read properties of null` on `JSINFO.id`. DokuWiki glues every plugin's JavaScript into one file, so that exception killed every plugin loaded after mine in that file. Including my own button. Five layers of review had signed it off.

Search never found text inside diagrams either. The indexer only runs when somebody views a page, nobody had viewed one after saving, and the tests were writing index entries by hand. And the checklist I was told to follow asked me to rename a diagram in a wiki with no move plugin installed, and to click an image nobody had ever created.

All of it had green tests. I wrote back, in Czech and not politely, asking whether anyone had actually tried it.

The honest answer: the agents tested exactly what they were told to test. I never told them what *tested* meant.

## What I prompted wrong

I asked for results and accepted a checklist as the proof. "Fix all the issues, give me a list of things to try" gets you exactly that: a list. Nothing in that sentence says the list has to be doable on a wiki that starts empty, so I got a checklist for a wiki that existed only in the agent's head.

I let "tests pass" stand for "it works". 160 tests, not one of them opened a browser, and headless Chrome was sitting on that machine all along. One `ls` and one page load would have killed the JavaScript bug on day one. Instead it survived seven agent runs and about a million tokens of review, none of which can execute a line of JavaScript.

Then came the reviewers, stacked instead of asked for evidence: sceptic, arbiter, consistency pass, each one reading the previous one's claims. Reviewers reading prose end up agreeing with the prose.

I read "verified end to end" and believed it. It had been verified end to end in PHPUnit, with fixtures the agent planted itself.

And the one I like least: the agent that decided what "done" meant was the same agent that then declared itself done.

## The skill that came out of it

Somewhere in the middle of this I stopped patching symptoms and wrote the process down. It lives in my `~/.claude/skills/` now and I plan to use it more often:

- The definition of done is a table, in the words of the person who runs the thing, agreed before anything gets built. It tracks the features over time: it grows when I add one, and rows disappear when a behaviour changes.
- Each row says how it is observed (the exact command or click), what the output must literally be, and whether the machine checks it or I do.
- Tests are those rows, one to one. They only speak public interfaces, so they survive swapping out whatever sits underneath.
- Fresh environment, nothing planted. If a step only passes after somebody helps it, it failed.
- Anything with an interface gets opened in a real browser with the console captured. A clean console with the expected element missing is still a fail. Ask me how I know.
- Whoever builds does not check. Implementer, sceptic, executor, and me only where a human is really needed.
- Evidence means literal output. "Verified" with nothing underneath counts as not verified.
- Green means green. Anything failing or skipped turns CI red, and it gets fixed, not reclassified.
- Nothing goes outward without me saying so: no push, no merge, no release, no closing issues.

Nine bullets and eight of them are there because I got burned in the first two days.

## Tuesday: the same skill, a dead mail server

Next morning I was thinking to myself: refresh iredmail-docker, or archive it? Same story as the plugin. It is stale and it still has a lot of users. So, let's give it a try, and I pointed Claude Code at another repository I had abandoned: a [Docker image of iRedMail](https://github.com/lejmr/iredmail-docker), last built in 2021 on CentOS 7, 23 open issues, 69 thousand pulls on Docker Hub. CentOS 7 has no package mirror anymore, so the thing could not even be built.

This time the table came first. Twenty-one rows, written the way somebody running a mail server would say it. Not "Postfix accepts on 587 with STARTTLS" but "a user sends mail to another server and it arrives". Not "quota plugin enabled" but "when I set a 1 MB quota, the message over the limit gets refused and is never silently lost".

What came out of it boots two mail servers and a DNS sidecar, publishes each server's DKIM key into the zone and sends mail between them, so the `dkim=pass` in the receiver's headers is real. Then a sceptic agent, briefed to break it rather than review it, went through the image. Backups that contained zero mail, because tar had archived a symlink. A restart that put every password back to its build-time placeholder. Plaintext IMAP listening on the network. Quotas never enforced for authenticated senders. The shared "snakeoil" private key baked into the image for everybody who ever pulled it. I would not have found those by reading code. I'm not sure I would have found them at all.

Halfway through I also found [Stalwart](https://stalw.art), one binary doing roughly what eleven daemons do in my image. That changed the goal. The refresh shipped as [1.8.8](https://github.com/lejmr/iredmail-docker/releases/tag/1.8.8) for people who already run the old thing, and the README now tells everybody else to go use Stalwart. Stalwart looks beautiful. It speaks JMAP, so you can put your own webmail, calendar and contacts on top of it and have your private space far more easily than with iRedMail. Although, with both of them dockerized, most users will not notice the difference!


## What it cost

Three days of wall clock over two repositories. My side: 289 messages, most of them typed on a phone, and four rounds of clicking through a five-step checklist. That was the only part the machine could not do for me.

The machine's side, counted from the transcripts, not guessed: 89 agents, 7 234 shell commands, 7.1 million tokens written, 3.1 billion tokens read back out of cache, because every turn re-reads the whole conversation. At list prices, around **$1 250**.

| model | role | output | cache read | cost |
|---|---|---|---|---|
| Sonnet 5 | the implementers and sceptics, 89 agents | 4.3 M | 2 069 M | $556 |
| Opus 5 | main conversation on day one, plus the reviews | 1.6 M | 557 M | $384 |
| Fable 5.1 | main conversation from day two on | 1.2 M | 520 M | $309 |
| Haiku 4.5 | odd jobs | 0.01 M | 4.7 M | $1 |

That surprised me. The cheap model is the biggest line on the bill, because 89 Sonnet agents re-reading their own context outweigh the expensive session I was typing into, and over ninety per cent of the money went on cache reads rather than thinking. Fewer agents with better briefs, then. Not a cheaper model.

## What I am not promising

Write down what *done* means before you ask for the work. Sounds obvious, it isn't. It means going through the features, distilling a specification out of them, formalising it, and only then letting an agent run against it. All of that can live in a prompt, but the structure is yours to validate. Model choice, number of reviewers, reasoning effort, all noise next to that.

I promise nothing about the future of either project. I did put automated pipelines into both: tests on every change, a weekly rebuild against current dependencies, a release button I can press from a phone, and a watchdog that goes red and mails me when something actually needs a human. That should keep them healthy on their own for a while. If they do go quiet again, they carry six years of fixes and ideas now, integrated.
