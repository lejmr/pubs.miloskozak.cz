---
title: "pyhocon isn't always right. Here's how I measured it."
date: 2026-10-19
tags: [hocon, python, pyhocon, testing]
images: [/img/hocon-tokenizer-and-parser/zig-Hocon-social-card-1200x630.png]
draft: false
---

If your Python service reads `.conf` files, you probably use pyhocon. It's the HOCON library Python has had for a decade: `ConfigFactory.parse_file("app.conf")`, `conf.get_string("db.host")`, done.

I've used it in production for years, usually with Pydantic on top. Then I wanted to learn something new, ended up writing [a conformance suite for HOCON](/posts/hocon-conformance-suite/), and ran pyhocon through it. This post is about what came out for Python.

<!--more-->

## HOCON is worth having in Python

HOCON is basically JSON you can write by hand. It has comments, you don't need quotes, and nobody fights about trailing commas. It understands units like `30s` and `512MiB`. Files include other files. Later settings merge over earlier ones. Values can point to other keys, `${db.host}`, or to environment variables, `${?DB_POOL}`. You write one base file and a small file per environment on top:

```hocon
# app.conf
db { host = localhost, pool = 4 }
timeout = 30s
include "prod.conf"
```

```hocon
# prod.conf
db.host = db.example.org
db.pool = ${?DB_POOL}   # only when DB_POOL is set
```

I find that much nicer than juggling `.env` files, YAML anchors and `os.environ.get` calls.

## What pyhocon does with it

This is pyhocon 0.3.63, the current release:

```python
>>> from pyhocon import ConfigFactory
>>> ConfigFactory.parse_string("a = true foo")
ConfigTree([('a', 'Truefoo')])
```

The spec says unquoted values concatenate together with the whitespace between them, so this should be the string `"true foo"`. pyhocon turns `true` into a Python bool, calls `str()` on it and loses the space. `null` is worse:

```python
>>> ConfigFactory.parse_string("b = null bar")
ConfigTree([('b', '<pyhocon.config_tree.NoneValue object at 0x1046faa90>bar')])
```

And `a += b`, which the spec defines as appending `b` to the list `a`, gives you the string `" b"`.

You won't write these every day. But they are three of 131 cases where pyhocon disagrees with the spec, and plenty of the others are in substitutions, includes and object merging, which is what you use HOCON for in the first place.

## Where the numbers come from

HOCON has a specification, [HOCON.md](https://github.com/lightbend/config/blob/main/HOCON.md) in the [lightbend/config](https://github.com/lightbend/config) repository. It's careful and readable, but it's prose, and unlike TOML ([toml-test](https://github.com/toml-lang/toml-test)) or YAML ([yaml-test-suite](https://github.com/yaml/yaml-test-suite)) there was never a shared test suite. Every implementation reads the spec its own way.

So I went through the spec sentence by sentence and turned each rule into a small `.conf` file plus the JSON it must produce. There are 445 of them now. Each one says which part of the spec it's based on, so if you think a case is wrong, you can point at the sentence. How I built it and what it found in the Java reference implementation is in the [earlier post](/posts/hocon-conformance-suite/). The one case the spec doesn't answer is waiting on a spec pull request (lightbend/config#887).

I ran every HOCON parser I could find for Python against it, with the Java reference and the Rust parsers for comparison:

| library | language | spec suite |
|---|---|---|
| typesafe/config | Java | 90.1 % |
| py.hocon | Python | 89.2 % |
| rs.hocon | Rust | 89.2 % |
| hocon2 | Python | 86.7 % |
| hocon-rs | Rust | 84.5 % |
| hocon 0.9.0 | Rust | 71.7 % |
| pulse-pyhocon | Python (Rust, falls back to pyhocon) | 71.0 % |
| pyhocon-fix | Python | 71.0 % |
| pyhocon | Python | 70.6 % |
| dd-pyhocon | Python | 70.6 % |

pyhocon-fix and dd-pyhocon are forks of pyhocon. Several other packages on PyPI with HOCON in the name wrap pyhocon and have no parser of their own. Even the Java reference doesn't get to 100 %. The full report, with every library and every case, is a single HTML page: [the conformance report](https://htmlpreview.github.io/?https://github.com/lejmr/zig-hocon/blob/main/conformance/report.html).

## A drop-in replacement

Once I had the suite, I wrote a library against it. zig-hocon passes 444 of the 445 cases; the last one is the open spec question.

```sh
pip install zig-hocon
```

```python
from zig_hocon import ConfigFactory   # was: from pyhocon import ConfigFactory

conf = ConfigFactory.parse_file("app.conf")
conf.get_string("db.host")   # "db.example.org"
conf.get_int("db.pool")      # 4, or $DB_POOL when it is set
```

The API is pyhocon's, so in most projects switching is that one import. Where zig-hocon gives a different result, it's because pyhocon disagrees with the spec, and those differences are listed in [MIGRATING.md](https://github.com/lejmr/zig-hocon/blob/main/python/MIGRATING.md). There are wheels for Python 3.10 and newer, free-threaded builds and PyPy included, on macOS, Linux (glibc and musl) and Windows. No dependencies. Errors give you the file, line and column, with a caret under the mistake.

## Why the parser isn't written in Python

The core is written in Zig and compiled into a small C library. The Python package is a thin ctypes layer over it, and every decision about what a config means is made in the core. The same core could sit under Ruby, Go, Node or anything else that can call C, with the same 444 cases passing. Python just happens to be the first language with a binding. (If you're curious about the Zig side, [I wrote that up too](/posts/hocon-tokenizer-and-parser/).)

Full disclosure: most of the code is written with AI and reviewed by me. The [changelog](https://github.com/lejmr/zig-hocon/blob/main/CHANGELOG.md) says how much of each release is written by hand.

## It's also fast

A side effect of not parsing in Python. My configs at work are around 5 KB, and one of those loads in 0.14 ms with zig-hocon and 29 ms with pyhocon. At startup you won't notice. In a test suite that builds config for every test, or a CLI you run hundreds of times a day, you will. [BENCHMARK.md](https://github.com/lejmr/zig-hocon/blob/main/python/BENCHMARK.md) has the full numbers, from 1 KB to 10 MB, for every library above.

## Try it

If you use pyhocon, install [zig-hocon from PyPI](https://pypi.org/project/zig-hocon/), switch the import and run your tests. If something breaks and it isn't in [MIGRATING.md](https://github.com/lejmr/zig-hocon/blob/main/python/MIGRATING.md), please open an issue.

If you maintain a HOCON parser, in any language, run the suite against it. An adapter is a few lines, and I'll add your library to the table. And if you think one of the cases is wrong, tell me which sentence of the spec you read differently.
