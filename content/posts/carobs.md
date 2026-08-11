---
title: "CAROBS: the OMNeT++ simulator behind my PhD"
date: 2016-09-29
tags: [phd, optical-networks, omnet, cpp, simulation]
---

*(Published as [lejmr/carobs](https://github.com/lejmr/carobs) — this post is its README with a bit of context.)*

> *A rock pile ceases to be a rock pile the moment a single man contemplates it, bearing within him the image of a cathedral.*
> — Antoine de Saint-Exupéry

This is the source of the all-optical network simulator I built during my PhD, based on the [OMNeT++](https://omnetpp.org) event-driven simulator. It implements [CAROBS](http://spectrum.library.concordia.ca/979415/1/NR71141.pdf), an Optical Burst Switching (OBS) framework that concatenates bursts into "cars" for better link utilization. CAROBS itself comes from Thomas Coutelen's 2010 Concordia thesis — I built on his architecture during my stay in Brigitte Jaumard's lab in Montreal.

To use a given network topology as efficiently as possible, the simulator applies the [stream-line effect](http://ieeexplore.ieee.org/document/1589625/) (SLE). On top of that, it combines SLE **r**outing and **w**avelength **a**ssignment with **g**rooming provided by the OBS framework — the GRWA algorithm, proposed in [my dissertation](https://dspace.cvut.cz/handle/10467/61383) (*Efficient Control Routing and Wavelength Assignment in Loss-Less Optical Burst Switching Networks*, CTU) — which this simulator was built to verify.

The thesis insisted on doing this the hard way — to quote the abstract: "Heuristics were not used because a rigorous method is necessary in order to formulate a claim on the loss-less OBS viability." Linear programming or nothing. (CPLEX and I spent a lot of quality time together.)

The details live in the paper it produced, written with Brigitte Jaumard (Concordia) and Leoš Boháč (CTU):

> M. Kozak, B. Jaumard, L. Bohac: [On the efficiency of stream line effect for contention avoidance in optical burst switching networks](https://doi.org/10.1016/j.osn.2015.03.002), Optical Switching and Networking, vol. 18, 2015.

People like to say OBS never left the lab. I'd say it was early: every O/E/O conversion costs power and latency, and that bill is coming due — Google already switches light in production ([OCS in Jupiter](https://dl.acm.org/doi/10.1145/3544216.3544265)), Microsoft's [Sirius](https://dl.acm.org/doi/10.1145/3387514.3406221) went after nanosecond optical switching, and as latency budgets shrink, the ideas behind OBS and OPS will get reinvented, probably under a new acronym. I'll write about it here when it happens.

It's C++ all the way down, and it simulates light. Every project I've done since has had worse latency.
