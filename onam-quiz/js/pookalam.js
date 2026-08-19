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

/* Faint concentric guide circles, like the chalk lines an artist lays down
   before placing any flowers. Reads as "prepared ground" rather than the
   loading-skeleton look that plain dashed petal outlines produce. */
function addGuides(svg) {
  for (let i = 1; i < RING_COUNT; i += 3) {
    const r = 12 + i * 10 + 5;
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', CENTRE);
    c.setAttribute('cy', CENTRE);
    c.setAttribute('r', r);
    c.setAttribute('class', 'kalam-guide');
    svg.appendChild(c);
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

    // centre seed — the "something is meant to go here" cue
    const seed = document.createElementNS(NS, 'circle');
    seed.setAttribute('cx', CENTRE);
    seed.setAttribute('cy', CENTRE);
    seed.setAttribute('r', 9);
    seed.setAttribute('class', 'kalam-seed');
    svg.appendChild(seed);
    this.seed = seed;
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
