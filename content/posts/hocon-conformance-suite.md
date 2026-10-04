---
title: "I built a HOCON conformance suite. It found bugs in the reference implementation."
date: 2026-10-04
tags: [hocon, testing, zig, parsing]
draft: true
---

I have used [HOCON](https://github.com/lightbend/config/blob/main/HOCON.md) in production for years. I like the format because it is readable and it composes, so one config can be shared across multiple environments. As a Python developer, my ultimate combo for config management is [Pydantic](https://pydantic.dev) + [pyhocon](https://github.com/chimpler/pyhocon).

I like to try new things, so this June my eyes landed on [Zig](https://ziglang.org/). I wanted to go back to the roots of programming and see what a modern "C" feels like. After reading the language reference I needed a project, and knowing the Java and Python implementations of HOCON don't fully agree, it gave me an idea: "Zig has a native C interface, so why not write HOCON in Zig and expose it through C shim? Then every language can share one implementation. Magic!"

What a simple project I have picked, right?

Writing the tokenizer, the abstract syntax tree, the config and the resolution is the beautiful part. But right after the first implementation works, the question comes: am I really compatible? Luckily there is a [written spec](https://github.com/lightbend/config/blob/main/HOCON.md) and a whole internet of examples. Well, it turned out the spec and the reference implementation do not always agree. Here is a basic config that contains an error:

```hocon
hosts = [db1, db2] db3
```

The [spec says](https://github.com/lightbend/config/blob/main/HOCON.md#string-value-concatenation) an array next to a string in a concatenation is invalid. [lightbend/config](https://github.com/lightbend/config) 1.4.9, the reference implementation, the one the spec was written for, gives you this:

```json
{"hosts":["db1","db2"]}
```

No error, no warning. `db3` is gone. Write it the other way round, `db3 [db1, db2]`, and you get the error you were promised.

So before going further with the parser, I wrote down what HOCON is supposed to do. That became a [conformance suite](https://github.com/lejmr/zig-hocon/tree/main/conformance): 445 cases, each one a sentence of the spec turned into a config file and the value it must produce. lightbend/config 1.4.9 passes 90% of them, pyhocon 70%. My Zig parser, zig-hocon, 56%, and from here on it is built against the suite.

<!--more-->

## Method

The spec is prose, so I turned it into data. Each sentence that says *must*, *is* or *is invalid* becomes the smallest config file that exercises it, plus a JSON sidecar with the value it must produce:

```
suite/string-value-concatenation/010-object-then-scalar-drops-the-scalar.conf
suite/string-value-concatenation/010-object-then-scalar-drops-the-scalar.json
```

```json
{
  "spec": "HOCON.md#string-value-concatenation",
  "rule": "string-value-concatenation.12",
  "why": "it is invalid for arrays or objects to appear in a string value concatenation; typesafe/config accepts this one silently and discards the trailing x, losing data with no diagnostic, while erroring on the same pair in the other order",
  "error": "ObjectInStringConcatenation",
  "java": "lenient",
  "java_expect": {"a": {"b": 1}},
  "java_since": {"version": "main", "by": "lightbend/config#862"}
}
```

The expected values were seeded from lightbend/config 1.4.9 through a small [oracle script](https://github.com/lejmr/zig-hocon/tree/main/tools/oracle) that takes a config on stdin and prints JSON. Then every row was read against the sentence it stands for. Where the two agree, fine. Where they don't, the spec decides `expect`, and the row also records what Java actually does (`java_expect` or `java_error`). The spec is the reference, Java is the oracle for reality.

So there are two scores per implementation. **Spec mode**: does it do what HOCON says. **Java mode**: does it do what lightbend/config does, which is the bar if you just need production configs to keep parsing.

| 445 cases | spec mode | java mode |
|---|---|---|
| lightbend/config 1.4.9 | 90% (399) | 99% (442) |
| pyhocon 0.3.63 | 70% (312) | 66% (295) |
| zig-hocon | 56% (251) | 59% (261) |

Java misses three rows of its own mode because those are open questions: a row I could not decide from the spec text is marked for review and counts as neither a pass nor a fail.

The suite is not finished and does not pretend to be. It has a case for 272 of the 287 rules in [its inventory](https://github.com/lejmr/zig-hocon/blob/main/conformance/maintaining/RULES.md), one rule per normative sentence of the spec, and [COVERAGE.md](https://github.com/lejmr/zig-hocon/blob/main/conformance/maintaining/COVERAGE.md) lists the 15 it does not. Specifically, some parts around includes, lists from environment variables, numeric keys as arrays. That is the best I've been able to do alone so far.

None of this is specific to HOCON. Any format whose spec is prose and whose truth is one implementation has the same gap: JSON had [JSONTestSuite](https://github.com/nst/JSONTestSuite), TOML has [toml-test](https://github.com/toml-lang/toml-test), YAML has [yaml-test-suite](https://github.com/yaml/yaml-test-suite). The part I have not seen elsewhere is the second column: every row where the spec and the reference implementation part ways says which way (`diverges`, `unsupported` or `lenient`), so you can score against either one.

Full disclosure: the parser itself (tokenizer, parser, value graph, conversion and the public API) is written by hand, learning Zig was the point. I used Claude for the tooling around it: the oracle wrappers, the conformance runner and report generator, and drafting part of the conformance cases. Expected values never come from a model. They come from running lightbend/config and are then checked by hand against the spec text.

The 43 rows where spec and Java part ways are the interesting part. Three of them, in increasing order of how much they surprised me.

## Three findings
### 1. The trailing text that disappears

The example from the top. An object or an array followed by text on the same line:

```hocon
server = { port = 8080 } debug
```

1.4.9 returns `{"server":{"port":8080}}`. The spec says this is an error. pyhocon gets this one right and refuses. A forgotten comma or a stray word after a closing bracket is exactly the typo you make at the end of a long day, and the reference implementation quietly eats it.

This one is fixed: [lightbend/config#862](https://github.com/lightbend/config/pull/862) is merged and rejects it. It is not in a release yet.

### 2. Renaming an unrelated key changes the result

This is the one that made me sit down. It looks like an edge case, but it is the usual layering pattern: a shared file takes a value from the environment if it is set (`${?DB_PORT}`), and the file that includes it holds the default. Two files:

```hocon
# child.conf
x.y = ${?DB_PORT}
a = ${x.y}
```

```hocon
# main.conf
common { include "child.conf" }
x.y = 0
zzz = ${?common.x}
```

The spec has a rule for this: substitutions in an included file are first looked up relative to where the file was included (`common.x.y`), and if nothing is there, at the original path (`x.y`). `DB_PORT` is not set in the environment, so `${?DB_PORT}` is undefined, `common.x.y` never exists, the lookup falls back, and `common.a` is `0`.

```
# lightbend/config 1.4.9:
UnresolvedSubstitution: child.conf: 2: Could not resolve substitution to a value: ${common.x.y}
```

Now rename `zzz` to `o24bbd`. Nothing else changes.

```json
{"common":{"a":0,"x":{}},"o24bbd":{},"x":{"y":0}}
```

It resolves. The root object in lightbend/config is a `HashMap`, and the order its keys come out in is the order they get resolved. `o24bbd` is not a joke, it is a name picked to land before `a` in that map. A key named `first` fails just like `zzz`. Which key you happen to have elsewhere in the file decides whether your config loads.

pyhocon gets this one right. The fix is [lightbend/config#863](https://github.com/lightbend/config/pull/863), still open.

### 3. A value that is overwritten still gets evaluated

```hocon
w = [${does-not-exist}]
r = { x = 1 }
w = ${r}
```

In HOCON a later value for the same key replaces the earlier one, unless both are objects, in which case they merge. A list never merges. So the list in `w` is dead the moment `w = ${r}` appears, and the spec says it must never be evaluated. The answer is `{"w":{"x":1},"r":{"x":1}}`.

1.4.9 evaluates the dead list anyway and fails on `${does-not-exist}`. Add a fourth line `zzz = ${w.x}` and it still fails. Name that line `o24bbd = ${w.x}` instead, and it resolves. Same disease as story 2: the order of resolution leaks into the result.

pyhocon gets this right too. It resolves substitutions differently, against a half-built tree, and that same approach is why it hangs forever on some hidden-substitution inputs. The Java fix is [#865](https://github.com/lightbend/config/pull/865), open.

While building the suite I sent several fixes upstream. Four are already merged ([#860](https://github.com/lightbend/config/pull/860), [#861](https://github.com/lightbend/config/pull/861), [#862](https://github.com/lightbend/config/pull/862), [#864](https://github.com/lightbend/config/pull/864)); two are still open ([#863](https://github.com/lightbend/config/pull/863), [#865](https://github.com/lightbend/config/pull/865)).


## Why implementations drift

None of this is negligence. The spec was written alongside one implementation, and for years that implementation *was* the test suite. Where the prose is vague, the code decided, and every other implementation (pyhocon, the Rust crates, the Go and .NET ones) read the prose, hit an edge case, and decided again on its own. Without a shared, runnable set of cases, those decisions never get compared. They just pile up.

Stories 2 and 3 are the same mechanism. HOCON resolves substitutions against a merged tree, the spec describes the tree, and the implementation walks it in some order. When the order is not pinned down, the result depends on it. Nobody can see that from the prose. You see it when two implementations run the same file and print different things.

## Check your parser against it

The suite is data, not code. A runner is a directory walk and a JSON compare, and it needs a POSIX shell and python3. To test your own implementation, write an adapter: take a path, print compact JSON, exit non-zero when you reject the input. For pyhocon that is the whole thing:

```python
#!/usr/bin/env python3
import json, sys
from pyhocon import ConfigFactory
print(json.dumps(ConfigFactory.parse_file(sys.argv[1])))
```

pyhocon loops forever on a few of the cases, so for a full run wrap it in a timeout, the way [oracle.sh](https://github.com/lejmr/zig-hocon/blob/main/conformance/adapters/oracle.sh) does.

```sh
conformance/run.sh --text -- ./my-adapter.sh          # spec mode, human-readable
conformance/run.sh --text --java -- ./my-adapter.sh   # what lightbend/config does
```

`--text` prints a readable report, with each failing row's rule, the expected value and what your parser returned. Without it you get a JSON result you can commit to `conformance/reports/`, and your implementation shows up in the table. For anything compiled, the adapter is one `exec` line ([example.sh](https://github.com/lejmr/zig-hocon/blob/main/conformance/adapters/example.sh)).

If you think a row is wrong, you are probably the person I need. [Open an issue](https://github.com/lejmr/zig-hocon/issues) with the case path and the sentence of the spec you read differently. A case that is wrong about the spec is worth more to me than a passing score, because every implementation tested against it inherits the mistake.

## One implementation, held to the suite

The suite tells you whether implementations agree. It does not make them agree. That part is the original Zig idea: one core, exposed through the C ABI, so any language that speaks C can bind to the same code. Then "the same HOCON in every language" is not a promise each port has to keep. [zig-hocon](https://github.com/lejmr/zig-hocon) is not there yet: 56% of the suite, no substitution resolution, no includes, no C shim. But from here on it is built against the suite, so the better the suite gets, the better every parser tested against it gets, mine included.

## Conclusion

> Config should be boring!

I think config should be data on disk that composes: includes, overrides, and substitutions here and there. Types and validation belong in the program that reads it: Pydantic, [Serde](https://serde.rs) or a [Zig struct](https://ziglang.org/documentation/0.16.0/#struct). HOCON does the composing part well, and it is the configuration format of many projects. If you want types, constraints and functions in the config itself, which you will appreciate when sharing config files across multiple languages, [Pkl](https://pkl-lang.org) is the honest choice.

For everything else, HOCON just needs to mean the same thing everywhere. The suite says what that is. Come and tell me where it is wrong.
 