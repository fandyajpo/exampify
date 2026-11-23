/**
 * Phase 1 seed fixture (`MVP_ROADMAP.md` §4.2): one curriculum, two levels, two subject
 * groups, seven subjects, two chapters and three topics each, with one published study
 * resource per topic.
 *
 * Plain data with no imports, so both the Next runtime and the standalone seed script can
 * read it. Content is deliberately generic placeholder material: real subject content is
 * content-operations work (`docs/README.md`, known gaps).
 */

export type SeedTopic = {
  slug: string;
  title: string;
  summary: string;
  minutes: number;
  objectives: string[];
};

export type SeedChapter = {
  slug: string;
  title: string;
  summary: string;
  topics: SeedTopic[];
};

export type SeedSubject = {
  slug: string;
  levelSlug: string;
  groupSlug: string;
  name: string;
  summary: string;
  color: string;
  icon: string;
  chapters: SeedChapter[];
};

export const SEED_CURRICULUM = {
  slug: "cambridge-international",
  name: "Cambridge International",
  shortName: "CAIE",
  descriptionMd:
    "Study material, lessons and practice written against the Cambridge International syllabus, for IGCSE and AS & A Level candidates.",
} as const;

export const SEED_LEVELS = [
  {
    slug: "igcse",
    name: "IGCSE",
    descriptionMd:
      "Cambridge IGCSE subjects, organised by chapter and topic so a revision session has a defined end.",
  },
  {
    slug: "as-and-a-level",
    name: "AS & A Level",
    descriptionMd:
      "Cambridge AS & A Level subjects for candidates moving from broad IGCSE knowledge to exam-specific depth.",
  },
] as const;

export const SEED_GROUPS = [
  { slug: "science", name: "Science", iconKey: "flask", color: "leaf" },
  { slug: "mathematics", name: "Mathematics", iconKey: "sigma", color: "cobalt" },
] as const;

const topic = (
  slug: string,
  title: string,
  summary: string,
  objectives: string[],
): SeedTopic => ({ slug, title, summary, minutes: 25, objectives });

export const SEED_SUBJECTS: SeedSubject[] = [
  {
    slug: "biology",
    levelSlug: "igcse",
    groupSlug: "science",
    name: "Biology",
    summary:
      "Cells, transport, enzymes and ecology, explained from the syllabus definitions outward so each topic can be read on its own.",
    color: "lime",
    icon: "leaf",
    chapters: [
      {
        slug: "cells-and-transport",
        title: "Cells and transport",
        summary: "The cell as the unit of life, and how substances move across its membrane.",
        topics: [
          topic("cell-structure", "Cell structure", "Organelles and their functions in plant and animal cells.", [
            "Label the organelles of a plant and an animal cell",
            "Relate each organelle to its function",
          ]),
          topic("diffusion-and-osmosis", "Diffusion and osmosis", "Passive movement of particles and water across membranes.", [
            "Define diffusion, osmosis and active transport",
            "Predict the direction of water movement across a membrane",
          ]),
          topic("enzymes", "Enzymes", "Biological catalysts and the factors that change their rate.", [
            "Describe the effect of temperature and pH on enzyme activity",
            "Explain enzyme specificity in terms of the active site",
          ]),
        ],
      },
      {
        slug: "ecology",
        title: "Ecology",
        summary: "Energy flow, nutrient cycles and the effect of human activity on ecosystems.",
        topics: [
          topic("food-chains", "Food chains and energy flow", "Trophic levels and the loss of energy between them.", [
            "Construct a food chain from a described habitat",
            "Explain why energy is lost between trophic levels",
          ]),
          topic("carbon-cycle", "The carbon cycle", "How carbon moves between the atmosphere, organisms and the ground.", [
            "Describe the processes that add and remove carbon dioxide",
            "Explain the role of decomposers",
          ]),
          topic("human-impact", "Human impact on ecosystems", "Deforestation, pollution and conservation.", [
            "Describe two effects of deforestation",
            "Explain one conservation measure and its limitation",
          ]),
        ],
      },
    ],
  },
  {
    slug: "chemistry",
    levelSlug: "igcse",
    groupSlug: "science",
    name: "Chemistry",
    summary:
      "Particles, bonding and reactions, with the definitions and equations the mark scheme expects stated explicitly.",
    color: "leaf",
    icon: "flask",
    chapters: [
      {
        slug: "particles-and-bonding",
        title: "Particles and bonding",
        summary: "States of matter, atomic structure and the three bonding types.",
        topics: [
          topic("states-of-matter", "States of matter", "Particle arrangement and the changes between states.", [
            "Describe the arrangement and movement of particles in each state",
            "Explain melting and boiling in terms of energy",
          ]),
          topic("atomic-structure", "Atomic structure", "Protons, neutrons, electrons and the periodic table.", [
            "Deduce proton, neutron and electron numbers from notation",
            "Relate group and period to electron configuration",
          ]),
          topic("ionic-bonding", "Ionic bonding", "Electron transfer and the properties of ionic lattices.", [
            "Draw dot-and-cross diagrams for common ionic compounds",
            "Explain the melting point of an ionic solid",
          ]),
        ],
      },
      {
        slug: "rates-and-equilibria",
        title: "Rates and equilibria",
        summary: "Collision theory, reversible reactions and the conditions that shift them.",
        topics: [
          topic("rate-of-reaction", "Rate of reaction", "Measuring rate and the factors that change it.", [
            "Describe a method for measuring rate by gas volume",
            "Explain the effect of concentration on rate",
          ]),
          topic("reversible-reactions", "Reversible reactions", "Equilibrium and Le Chatelier's principle.", [
            "State the characteristics of a system at equilibrium",
            "Predict the effect of a change in conditions on equilibrium",
          ]),
          topic("redox", "Redox reactions", "Oxidation, reduction and identifying agents.", [
            "Assign oxidation states in a compound",
            "Identify the oxidising and reducing agent in an equation",
          ]),
        ],
      },
    ],
  },
  {
    slug: "physics",
    levelSlug: "igcse",
    groupSlug: "science",
    name: "Physics",
    summary:
      "Forces, motion and electricity, with the equations and units written the way exam questions demand them.",
    color: "sky",
    icon: "atom",
    chapters: [
      {
        slug: "forces-and-motion",
        title: "Forces and motion",
        summary: "Speed, acceleration and Newton's laws with worked calculations.",
        topics: [
          topic("speed-and-acceleration", "Speed and acceleration", "Describing motion with distance-time and velocity-time graphs.", [
            "Calculate speed and acceleration from given data",
            "Interpret the gradient of a motion graph",
          ]),
          topic("newtons-laws", "Newton's laws", "Force, mass and acceleration, including resultant forces.", [
            "State Newton's second law and apply F = ma",
            "Describe the effect of friction on motion",
          ]),
          topic("momentum", "Momentum", "Momentum, impulse and conservation in collisions.", [
            "Calculate momentum and impulse",
            "Apply conservation of momentum to a collision",
          ]),
        ],
      },
      {
        slug: "electricity",
        title: "Electricity",
        summary: "Circuits, resistance and electrical energy.",
        topics: [
          topic("current-and-voltage", "Current and voltage", "Series and parallel circuits with measurements.", [
            "Describe how current and voltage behave in series and parallel",
            "Use a circuit diagram to predict meter readings",
          ]),
          topic("resistance", "Resistance", "Ohm's law and the factors affecting resistance.", [
            "Calculate resistance from V and I",
            "Describe how length affects the resistance of a wire",
          ]),
          topic("electrical-energy", "Electrical energy", "Power, energy transfer and the cost of electricity.", [
            "Calculate power using P = VI",
            "Calculate the cost of running an appliance",
          ]),
        ],
      },
    ],
  },
  {
    slug: "mathematics",
    levelSlug: "igcse",
    groupSlug: "mathematics",
    name: "Mathematics",
    summary:
      "Algebra, geometry and statistics, worked step by step with the method marks named before the answer.",
    color: "cobalt",
    icon: "sigma",
    chapters: [
      {
        slug: "algebra",
        title: "Algebra",
        summary: "Expressions, equations, sequences and functions.",
        topics: [
          topic("expanding-and-factorising", "Expanding and factorising", "Removing and inserting brackets, including quadratics.", [
            "Expand a product of two binomials",
            "Factorise a quadratic expression",
          ]),
          topic("solving-equations", "Solving equations", "Linear and simultaneous equations with worked methods.", [
            "Solve a linear equation with fractions",
            "Solve simultaneous equations by elimination",
          ]),
          topic("sequences", "Sequences", "Nth-term rules for arithmetic and quadratic sequences.", [
            "Find the nth term of an arithmetic sequence",
            "Recognise a quadratic sequence from its differences",
          ]),
        ],
      },
      {
        slug: "geometry-and-measures",
        title: "Geometry and measures",
        summary: "Angles, area, volume and trigonometry.",
        topics: [
          topic("angle-rules", "Angle rules", "Angles in triangles, quadrilaterals and parallel lines.", [
            "Apply the angle sum of a triangle",
            "Use alternate and corresponding angles",
          ]),
          topic("area-and-volume", "Area and volume", "Compound shapes, prisms and surface area.", [
            "Calculate the area of a compound shape",
            "Calculate the volume of a prism",
          ]),
          topic("trigonometry", "Trigonometry", "Sine, cosine and tangent in right-angled triangles.", [
            "Choose the correct ratio for a given triangle",
            "Find a missing side or angle",
          ]),
        ],
      },
    ],
  },
  {
    slug: "biology",
    levelSlug: "as-and-a-level",
    groupSlug: "science",
    name: "Biology",
    summary:
      "Cell biology, biological molecules and transport at AS depth, written for candidates arriving from IGCSE.",
    color: "mauve",
    icon: "leaf",
    chapters: [
      {
        slug: "biological-molecules",
        title: "Biological molecules",
        summary: "The four macromolecule classes and the tests used to identify them.",
        topics: [
          topic("carbohydrates", "Carbohydrates", "Monosaccharides, disaccharides and polysaccharides.", [
            "Describe the formation of a glycosidic bond",
            "Relate polysaccharide structure to function",
          ]),
          topic("proteins", "Proteins", "Amino acids, peptide bonds and levels of structure.", [
            "Describe the formation of a peptide bond",
            "Explain how primary structure determines protein shape",
          ]),
          topic("enzyme-kinetics", "Enzyme kinetics", "Rate calculations and the effect of inhibitors.", [
            "Interpret a rate-of-reaction graph",
            "Distinguish competitive from non-competitive inhibition",
          ]),
        ],
      },
      {
        slug: "transport",
        title: "Transport",
        summary: "Membranes, water potential and the mammalian transport system.",
        topics: [
          topic("membrane-structure", "Membrane structure", "The fluid mosaic model and membrane transport.", [
            "Describe the fluid mosaic model",
            "Compare facilitated diffusion with active transport",
          ]),
          topic("water-potential", "Water potential", "Osmosis, plasmolysis and water potential calculations.", [
            "Define water potential",
            "Predict cell behaviour in a given solution",
          ]),
          topic("gas-exchange", "Gas exchange", "Surface area, diffusion gradients and transport surfaces.", [
            "Relate surface area to volume ratio to gas exchange",
            "Describe the features of an efficient exchange surface",
          ]),
        ],
      },
    ],
  },
  {
    slug: "chemistry",
    levelSlug: "as-and-a-level",
    groupSlug: "science",
    name: "Chemistry",
    summary:
      "Atomic structure, bonding and organic chemistry at AS depth, including the calculations that carry the marks.",
    color: "amber",
    icon: "flask",
    chapters: [
      {
        slug: "atoms-and-stoichiometry",
        title: "Atoms and stoichiometry",
        summary: "Moles, formulae and reacting masses.",
        topics: [
          topic("the-mole", "The mole", "Avogadro's constant and molar calculations.", [
            "Calculate moles from mass, gas volume or concentration",
            "Use Avogadro's constant in a calculation",
          ]),
          topic("empirical-formulae", "Empirical formulae", "Determining formulae from percentage composition.", [
            "Calculate an empirical formula from mass data",
            "Relate empirical to molecular formula",
          ]),
          topic("reacting-masses", "Reacting masses", "Stoichiometry and limiting reagents.", [
            "Calculate the mass of product from a balanced equation",
            "Identify the limiting reagent in a reaction",
          ]),
        ],
      },
      {
        slug: "organic-chemistry",
        title: "Organic chemistry",
        summary: "Nomenclature, isomerism and reaction mechanisms.",
        topics: [
          topic("nomenclature", "Nomenclature", "Naming alkanes, alkenes and functional groups.", [
            "Name a compound from its displayed formula",
            "Identify a functional group from its structure",
          ]),
          topic("isomerism", "Isomerism", "Structural and stereoisomerism.", [
            "Draw two structural isomers of a given formula",
            "Explain why a molecule has a cis and a trans form",
          ]),
          topic("addition-reactions", "Addition reactions", "Electrophilic addition and its intermediates.", [
            "Describe the mechanism of electrophilic addition",
            "Explain Markovnikov's rule",
          ]),
        ],
      },
    ],
  },
  {
    slug: "mathematics",
    levelSlug: "as-and-a-level",
    groupSlug: "mathematics",
    name: "Mathematics",
    summary:
      "Pure mathematics at AS depth: differentiation, integration and trigonometry, with every method step shown.",
    color: "plum",
    icon: "sigma",
    chapters: [
      {
        slug: "calculus",
        title: "Calculus",
        summary: "Differentiation and integration of polynomials and simple functions.",
        topics: [
          topic("differentiation", "Differentiation", "Gradients, tangents and stationary points.", [
            "Differentiate a polynomial",
            "Find and classify a stationary point",
          ]),
          topic("integration", "Integration", "Indefinite and definite integrals with area applications.", [
            "Integrate a polynomial",
            "Calculate the area under a curve between two points",
          ]),
          topic("chain-rule", "The chain rule", "Differentiating composite functions.", [
            "Apply the chain rule to a composite function",
            "Differentiate a function given in parametric form",
          ]),
        ],
      },
      {
        slug: "trigonometry-and-vectors",
        title: "Trigonometry and vectors",
        summary: "Identities, equations and vector geometry.",
        topics: [
          topic("trig-identities", "Trigonometric identities", "Pythagorean identities and double-angle formulae.", [
            "Simplify an expression using an identity",
            "Solve a trigonometric equation in a given interval",
          ]),
          topic("radians", "Radians", "Arc length, sector area and small-angle approximations.", [
            "Convert between degrees and radians",
            "Calculate arc length and sector area",
          ]),
          topic("vectors", "Vectors", "Vector arithmetic and the scalar product.", [
            "Add and subtract column vectors",
            "Use the scalar product to find an angle",
          ]),
        ],
      },
    ],
  },
];
