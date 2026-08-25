/* The pookalam: ten concentric rings of petals, one ring per question.
   Correct answers bloom in full colour, wrong answers in a muted tone — so the
   finished artwork IS the score. Pure inline SVG, no libraries.

   Ring geometry: petal count scales with radius so petal width stays roughly
   constant, which is what makes it read as a dense floral rangoli rather than a
   sunburst. ~360 petals total; SVG handles that without breaking a sweat. */

const NS = 'http://www.w3.org/2000/svg';
const CENTRE = 120;
const RING_COUNT = 10;

/* Six-colour cycle drawn from a Kerala festival palette. */
const PALETTE = [
  '#F5C518', // turmeric
  '#F08C00', // marigold
  '#FFFDF7', // white jasmine
  '#9B1B5A', // magenta
  '#1E5B3A', // forest green
  '#A8201A'  // temple red
];

/* ONE muted tone for every wrong answer, not a desaturated twin per hue.
   Per-hue muting failed on the white jasmine ring: its desaturated version was
   also pale, so "you got this wrong" didn't read at all. A single grey-taupe
   means any dull ring = a missed question, countable at a glance. */
const MUTED = '#CBC3B4';

function ringSpec(i) {
  const base = 12 + i * 10;                              // inner edge of the ring
  const count = Math.max(8, Math.round((2 * Math.PI * base) / 10));
  return { base, count, length: 11, halfWidth: 3.6, colour: PALETTE[i % PALETTE.length] };
}

/* Full kolam guide art — all ring boundaries + 12 radial spokes + a small
   six-petal lotus at the intersection of every spoke.

   This is how a pookalam artist actually prepares the ground: chalk circles for
   ring boundaries, then lines dividing each ring into equal sections, then small
   flower marks at every intersection so each petal has an anchor point. The
   result reads as "rich craft-work in progress", not a plain bullseye. */
function addGuides(svg) {
  /* All 11 ring boundaries (inner edge of each ring + outer boundary of ring 10) */
  for (let i = 0; i <= RING_COUNT; i++) {
    const r = i === RING_COUNT ? 114 : 12 + i * 10;
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', CENTRE);
    c.setAttribute('cy', CENTRE);
    c.setAttribute('r', r);
    c.setAttribute('class', 'kalam-guide');
    svg.appendChild(c);
  }

  /* 12 radial spokes at 30° intervals — divides each ring into 12 petal cells.
     Starting at -90° (12 o'clock) so a spoke always points straight up. */
  for (let deg = 0; deg < 360; deg += 30) {
    const θ = (deg - 90) * Math.PI / 180;
    const line = document.createElementNS(NS, 'line');
    line.setAttribute('x1', CENTRE);
    line.setAttribute('y1', CENTRE);
    line.setAttribute('x2', +(CENTRE + Math.cos(θ) * 114).toFixed(2));
    line.setAttribute('y2', +(CENTRE + Math.sin(θ) * 114).toFixed(2));
    line.setAttribute('class', 'kalam-spoke');
    svg.appendChild(line);
  }

  /* Small diamond marks where each spoke crosses each ring — the "nail holes"
     a kolam artist presses to anchor each flower position. Only on the outer
     four rings so the centre stays legible. */
  const SPOKE_ANGLES = Array.from({ length: 12 }, (_, k) => (k * 30 - 90) * Math.PI / 180);
  for (let i = 7; i <= RING_COUNT; i++) {
    const r = 12 + i * 10 + 5;
    for (const θ of SPOKE_ANGLES) {
      const x = CENTRE + Math.cos(θ) * r;
      const y = CENTRE + Math.sin(θ) * r;
      const dot = document.createElementNS(NS, 'circle');
      dot.setAttribute('cx', x.toFixed(2));
      dot.setAttribute('cy', y.toFixed(2));
      dot.setAttribute('r', '1.5');
      dot.setAttribute('class', 'kalam-guide-dot');
      svg.appendChild(dot);
    }
  }
}

/* A teardrop petal with its base at the origin and tip pointing "up"
   (negative y). Positioned by translating to the ring radius, then rotated
   about the pookalam centre. SVG applies transforms right-to-left, so
   rotate(...) translate(...) means "translate first, then rotate". */
function petalPath(L, w) {
  return `M0,0 C${w},${-L * 0.25} ${w * 0.8},${-L * 0.8} 0,${-L} ` +
         `C${-w * 0.8},${-L * 0.8} ${-w},${-L * 0.25} 0,0 Z`;
}

const Pookalam = {
  svg: null,
  rings: [],

  /* Build all ten rings in the un-bloomed state. Outermost ring is appended
     first so that inner rings layer on top of it. */
  build(svg) {
    this.svg = svg;
    this.rings = [];
    svg.textContent = '';
    svg.setAttribute('viewBox', '0 0 240 240');

    // bare earth + a faint guide circle: reads as "waiting", not "broken"
    const earth = document.createElementNS(NS, 'circle');
    earth.setAttribute('cx', CENTRE);
    earth.setAttribute('cy', CENTRE);
    earth.setAttribute('r', 114);
    earth.setAttribute('class', 'kalam-earth');
    svg.appendChild(earth);
    addGuides(svg);

    const groups = [];
    for (let i = RING_COUNT - 1; i >= 0; i--) {
      const spec = ringSpec(i);
      const g = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'ring');
      const d = petalPath(spec.length, spec.halfWidth);

      for (let p = 0; p < spec.count; p++) {
        const angle = (360 / spec.count) * p;

        /* Position lives on a wrapper <g> as a transform ATTRIBUTE, while the
           bloom animation scales the inner <path> via a CSS transform. They
           must be on different elements: a CSS `transform` overrides the SVG
           transform attribute outright, so animating the same node would throw
           every petal back to the origin. */
        const pos = document.createElementNS(NS, 'g');
        pos.setAttribute('transform',
          `rotate(${angle} ${CENTRE} ${CENTRE}) translate(${CENTRE} ${CENTRE - spec.base})`);

        const petal = document.createElementNS(NS, 'path');
        petal.setAttribute('d', d);
        petal.setAttribute('class', 'petal');
        petal.style.setProperty('--i', p);

        pos.appendChild(petal);
        g.appendChild(pos);
      }
      svg.appendChild(g);
      groups[i] = g;
    }
    this.rings = groups;

    /* Centre lotus — six tiny petals arranged like a flower, each a small
       teardrop outline. This is what a proper kolam has at the origin:
       a lotus bud, not a plain circle. The petals keep the .kalam-seed class
       so .kalam-seed.lit turns them red when ring 0 blooms. */
    const lotusGroup = document.createElementNS(NS, 'g');
    lotusGroup.setAttribute('class', 'kalam-seed');
    for (let p = 0; p < 6; p++) {
      const angle = p * 60;
      const pos = document.createElementNS(NS, 'g');
      pos.setAttribute('transform',
        `rotate(${angle} ${CENTRE} ${CENTRE}) translate(${CENTRE} ${CENTRE - 5})`);
      const petal = document.createElementNS(NS, 'path');
      petal.setAttribute('d', petalPath(8, 2.2));
      petal.setAttribute('class', 'kalam-lotus-petal');
      pos.appendChild(petal);
      lotusGroup.appendChild(pos);
    }
    /* Small filled circle at the very centre anchors the lotus */
    const centDot = document.createElementNS(NS, 'circle');
    centDot.setAttribute('cx', CENTRE);
    centDot.setAttribute('cy', CENTRE);
    centDot.setAttribute('r', '3.5');
    centDot.setAttribute('class', 'kalam-lotus-dot');
    lotusGroup.appendChild(centDot);
    svg.appendChild(lotusGroup);
    this.seed = lotusGroup;
  },

  /* How full the pookalam is, 0 -> 1. CSS reads this to grow the artwork from
     quiet-and-small to large-and-prominent as rings fill, so an empty disc
     never outranks the question it sits above. */
  setFill() {
    const lit = this.svg ? this.svg.querySelectorAll('.ring.bloomed').length : 0;
    if (this.svg) this.svg.style.setProperty('--kalam-fill', (lit / RING_COUNT).toFixed(3));
  },

  /* Bloom ring `i`. `correct` picks the saturated or muted colour. */
  bloomRing(i, correct) {
    const g = this.rings[i];
    if (!g) return;
    const fill = correct ? ringSpec(i).colour : MUTED;

    g.classList.add('bloomed');
    g.querySelectorAll('.petal').forEach(p => {
      /* Inline style, not setAttribute('fill'): a stylesheet rule beats a
         presentation attribute in SVG, so an attribute would lose to any
         `.petal { fill: ... }` rule. Inline style wins. */
      p.style.fill = fill;
      /* The stroke is what gives the white jasmine ring definition against a
         cream background — without it those petals vanish. */
      p.style.stroke = 'rgba(0,0,0,.18)';
      p.style.strokeWidth = '0.5';
    });
    if (i === 0) this.seed.classList.add('lit');
    this.setFill();
  },

  /* Re-paint an entire result set at once, without animation. Used when
     restoring the finished pookalam on the results screen. */
  paintAll(results) {
    results.forEach((r, i) => this.bloomRing(i, r));
  },

  reset() {
    if (this.svg) { this.build(this.svg); this.setFill(); }
  }
};
