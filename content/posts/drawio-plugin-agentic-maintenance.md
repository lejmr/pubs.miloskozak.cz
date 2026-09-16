---
title: "DokuWiki draw.io plugin revamp"
date: 2026-09-16
draft: true
tags: [ai, agents, claude-code, dokuwiki, maintenance, testing]
---

In 2018 I wrote a small [DokuWiki plugin](https://github.com/lejmr/dokuwiki-plugin-drawio) that embeds [draw.io](https://www.drawio.com) diagrams into wiki pages. Then life happened. Issues kept arriving, and every time I looked into my github profile I felt bad about it and did nothing because I stopped using it around year 2021. The plugin is still in the top 5 % of the DokuWiki plugin catalogue by popularity, people fork it and fix it for themselves.

So the experiment was not "can AI write a feature". It was: **can I set up a flow where agents integrate external changes, fix issues, and keep the thing alive, with me doing only the validation?**. And it would be me if I did not want to have basic features under tests, so I know exactly what is breaking and whatnot.

From whole process I have quite mixed feelings because I started Sunday evening, and Monday evening I triggered Fable 5 to speed things up since the whole previous work I handled via mobile during day, so I could not test things, and Claude was confident that everything was going just fine. When I got to the computer, I realized that everything works and nothing works at the same time.

<!--more-->

## The setup

Claude Code, one main session, and a rule I set on day one: implementation and discussion by cheaper agents, a domain sceptic reviewing every stream, and a final consistency pass by a strong model with high reasoning. Four streams ran side by side: a working dev environment (the old docker-compose pulled an image that no longer exists), a test suite and CI against three DokuWiki branches, the issue fixes, and a security audit.

The output volume was impressive. Twelve of thirteen issues closed with tests. A `SECURITY.md` with real findings (CSRF on the save endpoint, an ACL check on the wrong namespace, an existence oracle for protected media, an ODT export that leaked bytes the exporting user could not read). A third wave of features I had wanted for years: the diagram's XML stored as a `.drawio` next to the image, an advisory lock, search over diagram labels, a release button in GitHub Actions.

Then I opened the wiki and clicked.

## What was actually broken

- The "Edit with draw.io" button in the media manager threw on `JSINFO.id` being `null`. DokuWiki concatenates every plugin's JavaScript into one file, so the exception killed every plugin loaded after mine — including my own button. Five review layers had signed this off.
- Search did not find diagram text, ever. The indexer only runs when a page is viewed, nobody had viewed one after saving, and the tests planted index entries by hand.
- The admin page for bulk conversion "had never worked" — it turned out an editor plugin the agent had installed into *my* wiki for another test was breaking it.
- The manual checklist asked me to rename a diagram in a wiki without the move plugin, and to open a sample image nobody had seeded.

Every one of those had green tests. I said, in Czech and not politely, "did you even test this?" — and the honest answer was: the agents tested what they were told to test, and I had never told them what *tested* meant.

## What I prompted wrong

**1. I asked for outcomes and accepted lists.** "Fix all issues, give me a list of things to try." An agent will produce that list. Nothing in the request says the list must be *reachable* on a fresh wiki, so the checklist described a wiki that existed only in the agent's head, with a seeded image here and a pre-indexed page there.

**2. I let "tests pass" stand in for "it works".** The suite had 160 tests. Not one opened a browser, although headless Chrome was sitting on the machine the whole time. When I later asked to quantify the miss: one `ls` of the tool directory versus roughly seven agent runs and over a million tokens of review that could not have caught a JavaScript exception at load time, because none of them executed JavaScript.

**3. I stacked review instead of evidence.** Sceptic, arbiter, consistency pass — each layer read the previous layer's *claims*. Reviewers reviewing prose converge on the prose. What was missing was not another opinion but a literal command output somebody could disagree with.

**4. I mistook confidence for progress.** A strong model at high reasoning writes a beautiful summary. I read "verified end to end" and moved on. It had verified end to end *in PHPUnit*, with fixtures it planted itself, which is the same as verifying nothing about a user.

**5. I did not separate the plan from the execution.** The same agent decided what "done" meant and then declared itself done. Of course it passed.

## What changed

I switched the main session to a newer model (Fable), and this is where I have to be careful, because the tempting story is "the better model fixed it". That is not what happened. What I changed at the same time was the **contract**:

- **A validation plan written before anything is run**, by a different agent than the one executing it. Machine phases M0–M6: static checks, the suites, a *fresh container from scratch*, every context opened in a real headless browser, my server-side path replayed with `curl`, every `SECURITY.md` claim re-attacked, log diff at the end.
- **Evidence rules that a model cannot talk its way around.** Evidence is literal output — status code, DOM excerpt, `sha256` — not a paraphrase. A browser step passes only with *zero* console errors **and** a named positive element in the DOM; a clean console with the element missing is a fail, because function hoisting makes a dead script look alive. Nothing may be planted by hand; if a step only passes with help, it fails. Stop rules: abort on the first failure in the phases that matter.
- **Golden and extra test tiers.** Every feature has exactly one golden test that proves the happy path a user would take, run first and fast-failing in CI; everything else is "extra". Filesystem-delta assertions after every write path: here is the whole data directory before, here it is after, these three files and nothing else may differ.

The first executor run under that plan stopped at phase M5.4 with a real finding: the ODT export was cached per page, not per viewer, so whoever exported first decided what everyone after got. It also found a stray draw.io chunk inside the plugin's own placeholder image — shipped since 2020 — which the new bulk conversion happily offered to "recover" as a diagram. Neither would have surfaced from reading code. Both surfaced from a rule that says *run it from nothing and show me the bytes*.

> After that, batches passed. Not because the model got smarter, but because "done" finally meant something I could check!!!

## The flow I am going to keep for this project

- CI runs weekly against DokuWiki `stable`, `oldstable` and `master`, so a DokuWiki release that breaks the plugin shows up before the next issue does. 
- Releasing is a button: *Actions → Release → Run workflow* bumps the date, tags, runs the tests, builds the zip with `git archive` so development files never ship, and writes the changelog into the release. No local scripts; I can do it from my phone.
- The forks got looked at, and one fix (diagram names with dots) came straight from a fork I had never merged. Integrating external changes is now a task I can hand to an agent with the same validation plan, which was the original motivation.
- The merge itself: seventeen topical pull requests, each a single commit whose *tree* is a snapshot of the validated history, squash-merged in order with a script that checks after every merge that `master`'s tree is byte-identical to the expected one. No conflict resolution, no drift between what was clicked through and what shipped.

## Day two: the same process on a second dead project

The next morning I pointed the same setup at another repository I had abandoned: a Docker image of the iRedMail mail server, last built in 2021 on CentOS 7 (which no longer exists as a package mirror), 23 open issues, 69 thousand pulls on Docker Hub. This time the process was written down first, as a reusable skill, and the difference was visible within hours.

**The specification is a table, and it is written in the language of the person who runs the thing.** Not "Postfix accepts on 587 with STARTTLS" but "a user sends mail to another server and it arrives"; not "Dovecot quota plugin enabled" but "when I set a 1 MB quota, the next message over it gets a `552`, never silent loss". Twenty-one rows like that, each with the exact observation (a command from outside the container, from a fresh `compose up`, nothing planted), the literal expected output, and who checks it - machine or me. I approved the table once. Every test is one row; every release note is that table with PASS next to each line. The tests know nothing about what is inside the container - only SMTP, IMAP, HTTPS, ActiveSync, CalDAV and one `admin` command - so the same suite would run against a completely different mail server. That is what makes it a specification rather than a test suite.

**Two servers side by side, real DNS, real DKIM.** The suite starts two mail servers and a CoreDNS sidecar, publishes each server's DKIM key into the zone, and sends mail from one to the other. `dkim=pass` in the receiver's headers is real. It found, in order: a `sed` that rewrote binary Postfix databases, backups that contained zero mail (tar archived a symlink), a restart that reset every password to a placeholder, plaintext IMAP open to the network, quotas never checked for authenticated senders, the SSL "snakeoil" private key baked into the image for everyone (Trivy, not a human, found that one), and a spam filter whose "move to Junk" rule had been lost when a directory became a volume. None of these is a diagnosis I would have arrived at by reading code, and the sceptic agent that found most of them was told to break the thing, not to review it.

**Green must mean green.** The first CI gate printed `required rows not passing: [10]` and the job still succeeded - `python3 … | tee` returns the exit code of `tee`. There was also a set of "recorded, not required" rows, which kept the badge green while five tests failed. I did not want a badge that lies: red when anything fails, and fix the failures instead of reclassifying them. So: `set -o pipefail`, every row required, a skipped test counts as a failure (a tool missing on the runner is a harness bug - run it from a container), and the release button refuses to publish unless all twenty-one pass. The last two rows to go green were viruses (ClamAV had to be on by default and Amavis had to filter *before* the queue so Postfix could actually answer `554`) and restoring a backup onto a fresh server (Dovecot kept talking to tables that had just been replaced - restart the services after a restore, don't wait and hope).

**The snapshot that erased three merges.** On the first project the pull requests were landed as "snapshot trees": one commit whose tree is exactly the validated state, squash-merged, with a check that master's tree matches afterwards. It is a good technique - it means what was clicked through is what ships, byte for byte. It has one precondition that got violated: the snapshot must contain the current master. One branch had been started before three other PRs merged; its tree lacked them; the squash silently reverted them; the tree check passed, because the tree was exactly the stale one it had been asked for. The landing script now refuses a source that is not a descendant of master. Every rule in the skill has a story like this behind it.

**The honest outcome.** Halfway through, while deciding how the mail server should evolve, I looked at what exists today and found [Stalwart](https://stalw.art) - a single binary that does what eleven daemons in my image do. The right call was not to pretend otherwise: the refresh shipped as version 1.8.8 for the people who still run the old image, with a README that says, in the first paragraph, to use Stalwart for anything new. Maintaining software honestly sometimes means telling users to leave.

## If you take one thing

Write the definition of *done* before you ask for the work. It sounds easy, but in this type of development it means, you must go over features and distil the specification, formalize it, and then let agent execute against that. All that can be prompt, but you should validate the structure. Everything else such as model choice, reviewer count, reasoning effort is noise compared to that.

The second day added the operational half of that sentence: the definition of done is a table in the user's words, the tests are that table and nothing else, the badge is red when any line of it is not proven, and the process that produced it lives outside the repository - a skill I can hand to a cheaper model on the next dead project - while the repository keeps only its own facts. The second project needed no strong model for the work itself, only for writing that table.

## What is going to be the future for this project?


To be honest, nothing is going to change much from my side, I still won't be using the plugin, but I am hopeful I have put together enough automation such that integration of features is going to be simpler hence faster and this repository will not go stale again. And if it does, it now carries six years of fixes and ideas, integrated.
