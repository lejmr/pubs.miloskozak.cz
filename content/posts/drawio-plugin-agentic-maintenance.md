---
title: "My used-to-be-loved projects, refreshed with Claude"
date: 2026-09-16
tags: [ai, agents, claude-code, dokuwiki, maintenance, testing]
---

In 2018 I wrote a small [DokuWiki plugin](https://github.com/lejmr/dokuwiki-plugin-drawio) that embeds [draw.io](https://www.drawio.com) diagrams into wiki pages. Then life happened. Issues kept arriving, and every time I looked into my github profile I felt bad about it and did nothing, because I stopped using it around 2021. The plugin is still in the top 5 % of the DokuWiki plugin catalogue by popularity, people fork it and fix it for themselves.

So the experiment was not "can AI write a feature". It was: **can I set up a flow where agents integrate external changes, fix issues, and keep the thing alive, with me doing only the validation?** And it would not be me if I did not want the basic features under tests, so I know exactly what is breaking and what is not.

I have mixed feelings about how it went. I started on Sunday evening and ran the first day from my phone, so I could not test anything, and Claude was confident everything was going fine. When I got to the computer, I realised that everything works and nothing works at the same time.

<!--more-->

## Day one, or how I got a very tidy pile of nothing

By Monday evening the numbers looked great. Twelve of thirteen issues closed, each with a test. A `SECURITY.md` with findings that were real. Even features I had wanted for years: the diagram's XML stored next to the image so an optimiser can't eat it, an advisory lock, searchable labels, a release button.

Then I opened the wiki and clicked.

The "Edit with draw.io" button threw on `JSINFO.id` being `null`. That sounds small until you remember DokuWiki glues every plugin's JavaScript into one file: the exception killed every plugin after mine in that file, my own button included. Five layers of review had signed it off. Search never found text inside diagrams either, because the indexer only runs when somebody views a page, nobody had viewed one after saving, and the tests had been writing index entries by hand. And the checklist I was supposed to follow told me to rename a diagram in a wiki that had no move plugin installed, and to click an image nobody had ever created.

All of it had green tests.

I asked, in Czech and not politely, whether anyone had actually tried it. The honest answer was that the agents had tested exactly what they were told to test. I'd never told them what *tested* meant.

## What I prompted wrong

I asked for outcomes and took lists. "Fix all the issues, give me a list of things to try" produces a list, sure — but nothing in that sentence says the list has to be doable on a wiki that starts empty. So I got a checklist for a wiki that existed only in the agent's head.

I also let "tests pass" stand for "it works". There were 160 tests and not one of them opened a browser, while headless Chrome sat on that machine the whole time. One `ls` and one page load would have killed that JavaScript bug on day one. Instead it survived seven agent runs and about a million tokens of review, none of which could execute a line of JavaScript.

Then I stacked reviewers instead of asking for evidence. Sceptic, arbiter, consistency pass — each one read the previous one's claims, and reviewers reading prose end up agreeing with the prose.

I read "verified end to end" and believed it. It had been verified end to end in PHPUnit, with fixtures the agent had planted itself.

And the one I'd repeat least happily: the agent that decided what "done" meant was the same agent that then declared itself done.

## The skill that came out of it

Somewhere in the middle of this I stopped patching symptoms and wrote the process down. It lives outside the repositories now, as a skill I hand to whatever model is doing the work:

- The definition of done is a table, in the words of the person who runs the thing, agreed before anything gets built.
- Each row says how it is observed — the exact command or click — what the output must literally be, and whether the machine checks it or I do.
- Tests are those rows, one to one. They only speak public interfaces, so they survive swapping out whatever sits underneath.
- Fresh environment, nothing planted. If a step only passes after someone helps it, it failed.
- Anything with an interface gets opened in a real browser with the console captured. A clean console with the expected element missing is still a fail — that one cost me a day.
- Whoever builds doesn't check. Implementer, sceptic, executor, and me only where a human is genuinely required.
- Evidence means literal output. "Verified" with nothing underneath counts as not verified.
- Green means green: anything failing or skipped turns CI red, and it gets fixed rather than reclassified.
- Nothing goes outward — push, merge, release, closing issues — without me saying so.

Nine bullets, and eight of them exist because I got burned in the first two days.

## Day two: the same skill, a dead mail server

Next morning I pointed it at another repository I'd abandoned: a Docker image of the iRedMail mail server, last built in 2021 on CentOS 7, 23 open issues, 69 thousand pulls on Docker Hub.

This time the table came first. Twenty-one rows, written the way somebody running a mail server would actually say it. Not "Postfix accepts on 587 with STARTTLS" but "a user sends mail to another server and it arrives". Not "quota plugin enabled" but "when I set a 1 MB quota, the next message over the limit is refused and never silently lost".

What came out of that is a test suite that boots two mail servers and a DNS sidecar, publishes each server's DKIM key into the zone, and sends mail between them — so `dkim=pass` in the receiver's headers is the real thing and not a mock. Then a sceptic agent, whose brief was to break it rather than review it, went through the image and found: backups that contained zero mail, a restart that quietly reset every password to a build-time placeholder, plaintext IMAP listening on the network, quotas that were never enforced for authenticated senders, and the shared "snakeoil" private key baked into the image for everybody who ever pulled it. I would not have found any of those by reading code. I'm not sure I would have found them at all.

The badge needed enforcing one more time, though. The first gate printed `required rows not passing: [10]` and the job went green anyway, because `python3 … | tee` hands you the exit code of `tee`. So: every row required, a skipped test counts as failed, and the release button refuses to publish unless all twenty-one pass.

Halfway through I also found [Stalwart](https://stalw.art), which does in one binary roughly what eleven daemons do in my image. That changed the goal: the refresh shipped for the people who already run the old thing, and the README now tells everyone else to go use Stalwart.

## What it cost

Three days of wall clock across two repositories. From my side: 289 messages, most of them typed on a phone, and four rounds of clicking through a five-step checklist — the only part the machine genuinely couldn't do for me.

From the machine's side, counted from the transcripts rather than guessed: 89 agents, 7 234 shell commands, 7.1 million tokens written, and 3.1 billion tokens read back out of cache, because every single turn re-reads the whole conversation. At list prices that's around **$1 250**.

| model | role | output | cache read | cost |
|---|---|---|---|---|
| Sonnet 5 | the implementers and sceptics - 89 agents | 4.3 M | 2 069 M | $556 |
| Opus 5 | the main conversation on day one, and the reviews | 1.6 M | 557 M | $384 |
| Fable 5.1 | the main conversation from day two on | 1.2 M | 520 M | $309 |
| Haiku 4.5 | odd jobs | 0.01 M | 4.7 M | $1 |

Which surprised me: the cheap model is the biggest line on the bill. Eighty-nine Sonnet agents, each re-reading its own context on every turn, outweigh the expensive session I was talking to. Over ninety per cent of that number is cache reads, not thinking. If I wanted to spend less next time, the lever is fewer agents with better briefs, not a cheaper model.

## The end, and what I'm not promising

Write down what *done* means before you ask for the work. That sounds obvious, and it isn't: it means going through the features, distilling a specification out of them, formalising it, and only then letting an agent run against it. All of that can live in a prompt. The structure is the part you have to validate yourself. Model choice, number of reviewers, reasoning effort — noise, next to that.

I'm not promising anything about the future of either project. I did put automated pipelines into both of them: tests on every change, a weekly rebuild against current dependencies, a release button I can press from a phone, and a watchdog that goes red and mails me when something actually needs a human. That should keep them healthy on their own for a while. And if they do go quiet again, they now carry six years of fixes and ideas, integrated.
