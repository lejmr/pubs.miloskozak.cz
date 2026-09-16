---
title: "My used-to-be-loved projects, refreshed with Claude"
date: 2026-09-16
draft: true
tags: [ai, agents, claude-code, dokuwiki, maintenance, testing]
---

In 2018 I wrote a small [DokuWiki plugin](https://github.com/lejmr/dokuwiki-plugin-drawio) that embeds [draw.io](https://www.drawio.com) diagrams into wiki pages. Then life happened. Issues kept arriving, and every time I looked into my github profile I felt bad about it and did nothing, because I stopped using it around 2021. The plugin is still in the top 5 % of the DokuWiki plugin catalogue by popularity, people fork it and fix it for themselves.

So the experiment was not "can AI write a feature". It was: **can I set up a flow where agents integrate external changes, fix issues, and keep the thing alive, with me doing only the validation?** And it would not be me if I did not want the basic features under tests, so I know exactly what is breaking and what is not.

I have mixed feelings about how it went. I started on Sunday evening and ran the first day from my phone, so I could not test anything - and Claude was confident everything was going fine. When I got to the computer, I realised that everything works and nothing works at the same time.

<!--more-->

## Day one: green tests in front of a broken plugin

The output volume was impressive: twelve of thirteen issues closed with tests, a `SECURITY.md` with real findings, and features I had wanted for years - the diagram's XML stored next to the image, an advisory lock, searchable diagram labels, a release button.

Then I opened the wiki and clicked.

- The "Edit with draw.io" button threw on `JSINFO.id` being `null`. DokuWiki concatenates every plugin's JavaScript into one file, so the exception killed every plugin loaded after mine - including my own button. Five review layers had signed this off.
- Search never found diagram text: the indexer only runs when a page is viewed, nobody had viewed one after saving, and the tests planted index entries by hand.
- The manual checklist asked me to rename a diagram in a wiki without the move plugin, and to open a sample image nobody had seeded.

Every one of those had green tests. I asked, in Czech and not politely, whether anyone had actually tested it - and the honest answer was that the agents tested what they were told to test, and I had never told them what *tested* meant.

## What I prompted wrong

**1. I asked for outcomes and accepted lists.** "Fix all issues, give me a list of things to try." Nothing in that says the list must be *reachable* on a fresh wiki, so the checklist described a wiki that existed only in the agent's head.

**2. I let "tests pass" stand in for "it works".** The suite had 160 tests and not one opened a browser, although headless Chrome sat on the machine the whole time. That JavaScript bug would have died to one `ls` and one page load; instead it survived seven agent runs and a million tokens of review that could not execute JavaScript.

**3. I stacked review instead of evidence.** Sceptic, arbiter, consistency pass - each layer read the previous layer's *claims*. Reviewers reviewing prose converge on the prose.

**4. I mistook confidence for progress.** I read "verified end to end" and moved on. It had been verified end to end *in PHPUnit*, with fixtures the agent planted itself.

**5. I did not separate the plan from the execution.** The same agent decided what "done" meant and then declared itself done.

## The skill that came out of it

Somewhere in the middle of the first project I stopped fixing symptoms and wrote the process down instead, as a skill that lives outside the repositories and gets handed to whichever model does the work:

- **The definition of done is a table**, in the words of the person who runs the thing, agreed before anything is built.
- **Every row names the exact command or click that proves it**, the literal expected output, and who checks it - the machine or me.
- **The tests are those rows, one to one**, and they talk only to public interfaces, so they survive replacing whatever sits underneath.
- **Fresh environment, nothing planted by hand.** A step that only passes with help has failed.
- **Anything with an interface is opened in a real browser**, console captured. A clean console with the expected element missing is still a failure.
- **Whoever builds does not check.** Implementer, sceptic, executor - and me only where a human is genuinely needed.
- **Evidence is literal output.** "Verified" without the output underneath counts as not verified.
- **Green means green.** Any failing or skipped row turns CI red; fix it, never reclassify it.
- **Nothing outward without my explicit go**: no push, merge, release or closing of issues.

## Day two: the same skill on a dead mail server

The next morning I pointed it at another abandoned repository: a Docker image of the iRedMail mail server, last built in 2021 on CentOS 7, 23 open issues, 69 thousand pulls on Docker Hub. This time the table came first - twenty-one rows, written the way a person running a mail server would say them. Not "Postfix accepts on 587 with STARTTLS", but "a user sends mail to another server and it arrives"; not "quota plugin enabled", but "when I set a 1 MB quota, the next message over it is refused, never silently lost".

The suite that came out of it starts two mail servers and a DNS sidecar, publishes each server's DKIM key into the zone and sends mail between them, so `dkim=pass` in the receiver's headers is real. Against that, the sceptic agent - told to break the thing, not to review it - found backups that contained zero mail, a restart that reset every password to a placeholder, plaintext IMAP open to the network, quotas never enforced for authenticated senders, and the shared "snakeoil" private key baked into the image. None of those is a diagnosis I would have reached by reading code.

The one rule I had to enforce on the machine again was the badge. The first gate printed `required rows not passing: [10]` and the job still succeeded, because `python3 … | tee` returns the exit code of `tee`. I did not want a badge that lies: every row required, a skipped test counts as a failure, and the release button refuses to publish unless all twenty-one pass. Halfway through I also found [Stalwart](https://stalw.art), which does in one binary what eleven daemons in my image do - so the refresh shipped for the people who already run the old image, with a README that tells everyone else to use Stalwart instead.

## What it cost

Three days of wall clock across two repositories. On my side: 289 messages, most from my phone, and four rounds of clicking through a five-step checklist - the only work the machine could not do.

On the machine's side, counted from the transcripts rather than guessed: **89 agents**, **7 234 shell commands**, **7.1 million tokens written**, and **3.1 billion tokens read back from cache**, because every turn re-reads the whole conversation. At list prices, about **$1 250**:

| model | role | output | cache read | cost |
|---|---|---|---|---|
| Sonnet 5 | the implementers and sceptics - 89 agents | 4.3 M | 2 069 M | $556 |
| Opus 5 | the main conversation on day one, and the reviews | 1.6 M | 557 M | $384 |
| Fable 5.1 | the main conversation from day two on | 1.2 M | 520 M | $309 |
| Haiku 4.5 | odd jobs | 0.01 M | 4.7 M | $1 |

The cheap model is the expensive line: eighty-nine agents re-reading their own context outweigh one expensive session, and over ninety per cent of that bill is cache reads rather than thinking. The lever is fewer, better-briefed agents - not a cheaper model.

## The end, and what I am not promising

Write the definition of *done* before you ask for the work. It sounds easy, but in this kind of development it means going over the features, distilling the specification, formalising it, and only then letting an agent execute against it. All of that can be a prompt - but the structure is yours to validate. Model choice, reviewer count and reasoning effort are noise next to it.

I promise nothing about the future of either project. What I did put in are automated pipelines meant to keep them healthy on their own for a while: tests on every change, a weekly rebuild against current dependencies, a release button, and a watchdog that turns red and mails me when something actually needs a human. And if they do go stale again, they now carry six years of fixes and ideas, integrated.
