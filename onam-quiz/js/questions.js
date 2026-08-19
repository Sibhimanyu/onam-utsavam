/* Quiz data and the per-game draw.

   A POOL of 16, not a fixed list of 10. Every game draws 10 at random and
   shuffles each question's options, so a second play is a genuinely different
   quiz rather than the same 10 in a new order. That matters here: the host runs
   several rounds on stage, and people replay to beat their score.

   Questions lean on story and specifics over name-that-thing trivia — the third
   step landing on Mahabali's head, the banana leaf tip pointing left, the boat
   trophy named after a prime minister. Facts are the widely documented ones;
   nothing hinges on a contested number.

   Shape is exactly what the brief asked for: { question, options, answer }.
   `answer` is the answer STRING, not an index, which is what makes shuffling
   options safe — correctness is matched by value, so the position can change
   freely. `area` is extra, used for the category label above each question. */

const QUESTION_POOL = [
  // ---- the Mahabali legend ----
  {
    area: "The legend",
    question: "Vamana asked Mahabali for land measured in three of what?",
    options: ["Paces of his own feet", "Chariot lengths", "Bowshots", "Royal cubits"],
    answer: "Paces of his own feet"
  },
  {
    area: "The legend",
    question: "Vamana's first two steps covered the earth and the heavens. Where did the third one land?",
    options: ["On Mahabali's own head", "In the western ocean", "On the peak of Mount Meru", "Back where it started"],
    answer: "On Mahabali's own head"
  },
  {
    area: "The legend",
    question: "Mahabali was granted one wish before he departed. What did he ask for?",
    options: [
      "To return and see his people once a year",
      "To keep one city of his kingdom",
      "To be remembered in every temple",
      "To choose the day of his return"
    ],
    answer: "To return and see his people once a year"
  },
  {
    area: "The legend",
    question: "Onam celebrates the homecoming of which mythical king?",
    options: ["Mahabali", "Ravana", "Bhagiratha", "Harishchandra"],
    answer: "Mahabali"
  },

  // ---- calendar and naming ----
  {
    area: "Calendar",
    question: "Chingam, the month Onam falls in, sits where in the Malayalam calendar?",
    options: ["It is the first month", "It is the last month", "It is the sixth month", "It falls mid-monsoon"],
    answer: "It is the first month"
  },
  {
    area: "Calendar",
    question: "The festival takes its name from a nakshatra, a star. Which one?",
    options: ["Thiruvonam", "Atham", "Chithira", "Avittam"],
    answer: "Thiruvonam"
  },
  {
    area: "Calendar",
    question: "Onam is the official state festival of which Indian state?",
    options: ["Kerala", "Tamil Nadu", "Karnataka", "Goa"],
    answer: "Kerala"
  },

  // ---- the pookalam ----
  {
    area: "Pookalam",
    question: "Which small white flower traditionally opens the pookalam on the first day?",
    options: ["Thumba (thumbappoo)", "Jasmine", "Lotus", "Marigold"],
    answer: "Thumba (thumbappoo)"
  },
  {
    area: "Pookalam",
    question: "Across the ten days of Onam, how does the pookalam change?",
    options: [
      "It grows larger, a ring added each day",
      "It is swept away and redrawn identically",
      "It shrinks toward a single flower",
      "It stays the same and only the flowers change"
    ],
    answer: "It grows larger, a ring added each day"
  },
  {
    area: "Pookalam",
    question: "The small conical idol placed at the centre of a pookalam is made of what?",
    options: ["Clay", "Sandalwood", "Brass", "Woven palm leaf"],
    answer: "Clay"
  },

  // ---- the sadya ----
  {
    area: "Sadya",
    question: "A banana leaf is laid for the sadya with its tapering tip pointing which way?",
    options: ["To the diner's left", "To the diner's right", "Straight away from the diner", "Toward the kitchen"],
    answer: "To the diner's left"
  },
  {
    area: "Sadya",
    question: "Which dish traditionally closes an Onam sadya?",
    options: ["Payasam", "Avial", "Thoran", "Pappadam"],
    answer: "Payasam"
  },

  // ---- vallam kali ----
  {
    area: "Vallam Kali",
    question: "Kerala's most famous snake-boat trophy is named after which Indian prime minister?",
    options: ["Jawaharlal Nehru", "Indira Gandhi", "Lal Bahadur Shastri", "Rajiv Gandhi"],
    answer: "Jawaharlal Nehru"
  },
  {
    area: "Vallam Kali",
    question: "A chundan vallam, the racing snake boat, is crewed by roughly how many people?",
    options: ["Around a hundred", "About a dozen", "Around thirty", "Just four"],
    answer: "Around a hundred"
  },

  // ---- folk performance ----
  {
    area: "Folk art",
    question: "Pulikali performers paint themselves as tigers. What does the performance depict?",
    options: ["A tiger hunt", "A tiger's wedding", "A tiger guarding a temple", "Tigers ploughing a field"],
    answer: "A tiger hunt"
  },
  {
    area: "Folk art",
    question: "Kaikottikali, the women's circle dance of Onam, goes by which other name?",
    options: ["Thiruvathirakali", "Kathakali", "Mohiniyattam", "Ottamthullal"],
    answer: "Thiruvathirakali"
  },

  // ---- the ten days ----
  {
    area: "The ten days",
    question: "How many days does Onam traditionally run?",
    options: ["Ten", "Three", "Five", "A fortnight"],
    answer: "Ten"
  },
  {
    area: "The ten days",
    question: "Which day opens the festival, when the first pookalam is laid?",
    options: ["Atham", "Thiruvonam", "Uthradam", "Avittam"],
    answer: "Atham"
  },
  {
    area: "The ten days",
    question: "Uthradam, the day before Thiruvonam, is best known as the day for what?",
    options: [
      "Last-minute shopping and preparation",
      "Fasting before the feast",
      "Dismantling the pookalam",
      "Racing the snake boats"
    ],
    answer: "Last-minute shopping and preparation"
  },
  {
    area: "The ten days",
    question: "The grand procession at Tripunithura that traditionally marks Onam's opening day is called what?",
    options: ["Athachamayam", "Vallam Kali", "Pulikali", "Thumbi thullal"],
    answer: "Athachamayam"
  },

  // ---- places ----
  {
    area: "Places",
    question: "Which temple near Kochi is the main centre of Onam worship, held to be Mahabali's old capital?",
    options: [
      "Thrikkakara Temple",
      "Guruvayur Temple",
      "Sabarimala",
      "Padmanabhaswamy Temple"
    ],
    answer: "Thrikkakara Temple"
  },
  {
    area: "Places",
    question: "The Nehru Trophy snake-boat race is rowed on which lake?",
    options: ["Punnamada Lake", "Vembanad backwaters at Kollam", "Sasthamkotta Lake", "Ashtamudi Lake"],
    answer: "Punnamada Lake"
  },
  {
    area: "Places",
    question: "Pulikali, the tiger dance, is most famously performed in which city?",
    options: ["Thrissur", "Kozhikode", "Kannur", "Alappuzha"],
    answer: "Thrissur"
  },

  // ---- more sadya ----
  {
    area: "Sadya",
    question: "A traditional Onam sadya contains which of these?",
    options: [
      "No meat or fish at all",
      "Fish but no meat",
      "Chicken as the centrepiece",
      "Beef on the final day"
    ],
    answer: "No meat or fish at all"
  },
  {
    area: "Sadya",
    question: "How is a sadya traditionally eaten?",
    options: [
      "With the right hand, no cutlery",
      "With a spoon and fork",
      "With chopsticks carved from palm",
      "Passed around in a shared bowl"
    ],
    answer: "With the right hand, no cutlery"
  },
  {
    area: "Sadya",
    question: "Upperi, a crisp sadya staple, is made by frying slices of what?",
    options: ["Raw banana", "Potato", "Jackfruit seed", "Yam leaf"],
    answer: "Raw banana"
  },

  // ---- customs and culture ----
  {
    area: "Customs",
    question: "Onakkodi refers to which Onam custom?",
    options: [
      "Giving new clothes",
      "Lighting the first lamp",
      "Sweeping the courtyard",
      "Sharing the first harvest"
    ],
    answer: "Giving new clothes"
  },
  {
    area: "Customs",
    question: "The Onavillu, offered at the Padmanabhaswamy Temple, is a ceremonial what?",
    options: ["Painted bow", "Brass lamp", "Silk umbrella", "Clay drum"],
    answer: "Painted bow"
  },
  {
    area: "Folk art",
    question: "Kummattikali dancers are known for wearing masks carved from what?",
    options: ["Wood", "Beaten copper", "Dried clay", "Woven cane"],
    answer: "Wood"
  },
  {
    area: "Customs",
    question: "Beyond Mahabali's return, Onam also celebrates what?",
    options: [
      "The harvest",
      "The start of the monsoon",
      "A naval victory",
      "The coronation of a king"
    ],
    answer: "The harvest"
  },
  {
    area: "Customs",
    question: "Vadamvali, one of the Onam games, is which contest?",
    options: ["Tug of war", "Archery", "Wrestling in mud", "A stilt race"],
    answer: "Tug of war"
  },
  {
    area: "The legend",
    question: "The much-loved Onam folk song beginning \"Maveli nadu vaneedum kaalam\" describes what?",
    options: [
      "Mahabali's reign, when all were equal",
      "The building of the first pookalam",
      "A storm that sank the snake boats",
      "The founding of Kerala's temples"
    ],
    answer: "Mahabali's reign, when all were equal"
  }
];

/* How many questions one game asks. The progress readout, the ring count and
   the leaderboard's "/N" all follow this, so the pookalam always has exactly
   one ring per question. */
const QUIZ_LENGTH = 10;

/* Fisher-Yates on a copy. Returns a new array; never mutates the input, so the
   pool itself stays stable across games. */
function shuffled(list) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = out[i];
    out[i] = out[j];
    out[j] = t;
  }
  return out;
}

/* Draw a fresh game: QUIZ_LENGTH questions from the pool in random order, each
   with its options shuffled ONCE, here.

   Shuffling options at draw time rather than at render time is the whole trick.
   Each question is re-rendered when it is answered (to show the correct answer
   and the feedback line), so shuffling during render would make the options
   visibly jump between the two renders of the same question. */
function buildQuiz() {
  return shuffled(QUESTION_POOL)
    .slice(0, QUIZ_LENGTH)
    .map(q => ({
      area: q.area,
      question: q.question,
      options: shuffled(q.options),
      answer: q.answer          // still the string, so shuffling above is safe
    }));
}

/* The active game. `let`, not `const` — newQuiz() swaps it for a fresh draw at
   the start of every round. Seeded at load so anything reading questions.length
   before the first game (the live join call does) sees the right number. */
let questions = buildQuiz();

function newQuiz() {
  questions = buildQuiz();
  return questions;
}
