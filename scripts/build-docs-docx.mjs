#!/usr/bin/env node
/**
 * Generation des documents Word (.docx) de documentation.
 *
 * Source : README.md et docs/*.md (rediges en francais).
 * Sortie : docs/*.docx, un fichier par document + une compilation complete.
 *
 * Usage : npm run docs:word
 *
 * Le convertisseur couvre le sous-ensemble Markdown utilise par la
 * documentation : titres, paragraphes, listes (imbriquees), tableaux, blocs de
 * code, citations, regles horizontales et mise en forme en ligne
 * (gras, code, liens, italique). Aucune dependance binaire n'est requise
 * (pas de Pandoc, pas de Word installe sur le serveur de build).
 */
import fs from "node:fs";
import path from "node:path";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  LevelFormat,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "docs");
const BRAND = "#1259A8";
const BRAND_DARK = "#122B52";
const BRAND_MID = "#194384";
const INK = "#1F2937";
const MUTED = "#5B6B82";
const BORDER = "D9E2EC";
const CODE_BG = "F4F7FB";
const HEAD_BG = "EFF5FC";

const DOCUMENTS = [
  {
    source: "README.md",
    output: "01_Presentation_et_Installation.docx",
    title: "Présentation et installation",
    subtitle:
      "Périmètre fonctionnel, pile technique, installation locale, variables d'environnement et commandes.",
    part: "Partie 1",
  },
  {
    source: "docs/ARCHITECTURE.md",
    output: "02_Architecture_technique.docx",
    title: "Architecture technique",
    subtitle:
      "Décisions structurantes, organisation du code, modèle de données, isolation multi-entreprises, sécurité et IA.",
    part: "Partie 2",
  },
  {
    source: "docs/API.md",
    output: "03_API_REST_v1.docx",
    title: "API REST v1",
    subtitle: "Authentification, format des réponses, endpoints, exports et exemples d'intégration.",
    part: "Partie 3",
  },
  {
    source: "docs/DEPLOYMENT.md",
    output: "04_Deploiement_et_Exploitation.docx",
    title: "Déploiement et exploitation",
    subtitle:
      "Build autonome, reverse proxy TLS, service systemd, sauvegardes, mise à jour, supervision et dépannage.",
    part: "Partie 4",
  },
  {
    source: "docs/USER_GUIDE.md",
    output: "05_Guide_Utilisateur.docx",
    title: "Guide utilisateur",
    subtitle:
      "Prise en main, rôles et responsabilités, usage des douze modules, console plateforme et bonnes pratiques.",
    part: "Partie 5",
  },
  {
    source: "docs/TEST_RESULTS.md",
    output: "06_Resultats_de_Verification.docx",
    title: "Résultats de vérification",
    subtitle: "Contrôles statiques, tests automatisés, vérifications d'exécution et correctifs appliqués.",
    part: "Partie 6",
  },
];

const COMBINED = {
  output: "00_SHALO_COM_SPACE_Documentation_complete.docx",
  title: "Documentation complète",
  subtitle:
    "Présentation, architecture, API, déploiement, guide utilisateur et résultats de vérification.",
};

// ---------------------------------------------------------------------------
// Mise en forme en ligne
// ---------------------------------------------------------------------------

function inlineRuns(text, options = {}) {
  const baseSize = options.size ?? 21;
  const baseColor = options.color ?? INK;
  const runs = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|\*[^*\n]+\*)/g;
  let lastIndex = 0;
  let match;

  const pushPlain = (value) => {
    if (!value) return;
    runs.push(new TextRun({ text: value, size: baseSize, color: baseColor, font: options.font }));
  };

  while ((match = pattern.exec(text)) !== null) {
    pushPlain(text.slice(lastIndex, match.index));
    const token = match[0];

    if (token.startsWith("**")) {
      runs.push(
        new TextRun({
          text: token.slice(2, -2),
          bold: true,
          size: baseSize,
          color: options.color ?? BRAND_DARK,
          font: options.font,
        })
      );
    } else if (token.startsWith("`")) {
      runs.push(
        new TextRun({
          text: token.slice(1, -1),
          font: "Consolas",
          size: Math.max(baseSize - 2, 15),
          color: "#0F3D6E",
        })
      );
    } else if (token.startsWith("[")) {
      const linkText = token.slice(1, token.indexOf("]"));
      const url = token.slice(token.indexOf("](") + 2, -1);
      runs.push(
        new TextRun({
          text: linkText,
          bold: true,
          size: baseSize,
          color: url.startsWith("#") ? baseColor : BRAND,
          font: options.font,
        })
      );
      if (!url.startsWith("#") && url !== linkText) {
        runs.push(new TextRun({ text: ` (${url})`, size: Math.max(baseSize - 3, 15), color: MUTED }));
      }
    } else if (token.startsWith("*")) {
      runs.push(
        new TextRun({ text: token.slice(1, -1), italics: true, size: baseSize, color: baseColor, font: options.font })
      );
    }
    lastIndex = pattern.lastIndex;
  }
  pushPlain(text.slice(lastIndex));
  return runs.length ? runs : [new TextRun({ text: "", size: baseSize })];
}

// ---------------------------------------------------------------------------
// Tableaux
// ---------------------------------------------------------------------------

function splitRow(line) {
  const cells = [];
  let current = "";
  let inCode = false;
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  for (const char of trimmed) {
    if (char === "`") inCode = !inCode;
    if (char === "|" && !inCode) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function buildTable(rows) {
  const [header, , ...body] = rows;
  const columns = Math.max(...rows.map((row) => splitRow(row).length));
  const width = Math.floor(100 / columns);

  const headerCells = splitRow(header);
  const tableHeader = new TableRow({
    tableHeader: true,
    children: Array.from({ length: columns }, (_, index) =>
      new TableCell({
        width: { size: width, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.CLEAR, fill: HEAD_BG, color: "auto" },
        margins: { top: 90, bottom: 90, left: 110, right: 110 },
        children: [
          new Paragraph({
            spacing: { before: 0, after: 0, line: 260 },
            children: inlineRuns(headerCells[index] ?? "", { size: 19, color: BRAND_DARK }),
          }),
        ],
      })
    ),
  });

  const tableBody = body.map(
    (row) =>
      new TableRow({
        children: Array.from({ length: columns }, (_, index) =>
          new TableCell({
            width: { size: width, type: WidthType.PERCENTAGE },
            margins: { top: 80, bottom: 80, left: 110, right: 110 },
            children: [
              new Paragraph({
                spacing: { before: 0, after: 0, line: 260 },
                children: inlineRuns(splitRow(row)[index] ?? "", { size: 19 }),
              }),
            ],
          })
        ),
      })
  );

  const border = { style: BorderStyle.SINGLE, size: 4, color: BORDER };
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border },
    rows: [tableHeader, ...tableBody],
  });
}

// ---------------------------------------------------------------------------
// Conversion d'un fichier Markdown
// ---------------------------------------------------------------------------

function codeBlock(lines) {
  const children = [];
  lines.forEach((line, index) => {
    children.push(
      new TextRun({
        text: line || " ",
        font: "Consolas",
        size: 17,
        color: "#12324F",
        break: index === 0 ? 0 : 1,
      })
    );
  });
  return new Paragraph({
    shading: { type: ShadingType.CLEAR, fill: CODE_BG, color: "auto" },
    spacing: { before: 80, after: 200, line: 240 },
    indent: { left: 240, right: 120 },
    border: {
      left: { style: BorderStyle.SINGLE, size: 12, color: BRAND, space: 8 },
    },
    children,
  });
}

function convertMarkdown(source, meta, options = {}) {
  const lines = source.split(/\r?\n/);
  const blocks = [];
  let index = 0;
  let orderedListId = 0;
  let titleSeen = false;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    // Bloc de code
    if (line.trimStart().startsWith("```")) {
      const codeLines = [];
      index += 1;
      while (index < lines.length && !lines[index].trimStart().startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }
      index += 1;
      blocks.push(codeBlock(codeLines));
      continue;
    }

    // Tableau
    if (line.trimStart().startsWith("|")) {
      const rows = [];
      while (index < lines.length && lines[index].trimStart().startsWith("|")) {
        rows.push(lines[index].trim());
        index += 1;
      }
      const hasSeparator = rows.length > 1 && /^\|[\s:|-]+\|?$/.test(rows[1]);
      if (hasSeparator) {
        blocks.push(buildTable(rows));
        blocks.push(new Paragraph({ spacing: { after: 80 }, children: [] }));
      } else {
        for (const row of rows) {
          blocks.push(new Paragraph({ children: inlineRuns(row) }));
        }
      }
      continue;
    }

    // Titres
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2].trim();
      if (level === 1 && !titleSeen) {
        titleSeen = true;
        index += 1;
        continue;
      }
      const map = {
        1: HeadingLevel.HEADING_1,
        2: HeadingLevel.HEADING_2,
        3: HeadingLevel.HEADING_3,
        4: HeadingLevel.HEADING_4,
        5: HeadingLevel.HEADING_5,
        6: HeadingLevel.HEADING_6,
      };
      blocks.push(
        new Paragraph({
          heading: map[level],
          spacing: { before: level <= 2 ? 320 : 240, after: level <= 2 ? 140 : 100 },
          children: inlineRuns(text, { size: level === 1 ? 34 : level === 2 ? 27 : 23 }),
        })
      );
      index += 1;
      continue;
    }

    // Regle horizontale
    if (/^-{3,}\s*$/.test(line)) {
      blocks.push(
        new Paragraph({
          spacing: { before: 120, after: 220 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: BORDER, space: 1 } },
          children: [],
        })
      );
      index += 1;
      continue;
    }

    // Citation
    if (line.trimStart().startsWith(">")) {
      const quote = [];
      while (index < lines.length && lines[index].trimStart().startsWith(">")) {
        quote.push(lines[index].trimStart().replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push(
        new Paragraph({
          indent: { left: 320, right: 160 },
          spacing: { before: 80, after: 200, line: 280 },
          border: { left: { style: BorderStyle.SINGLE, size: 12, color: "B6D1F0", space: 10 } },
          children: inlineRuns(quote.join(" "), { color: "#40506A" })
        })
      );
      continue;
    }

    // Listes
    const listItem = /^(\s*)([-*]|\d+\.)\s+(.*)$/.exec(line);
    if (listItem) {
      const level = Math.min(Math.floor(listItem[1].length / 2), 2);
      const ordered = /\d/.test(listItem[2]);
      const text = listItem[3];
      index += 1;

      if (ordered) {
        if (level === 0) orderedListId += 1;
        blocks.push(
          new Paragraph({
            numbering: { reference: "ordered", level, instance: Math.max(orderedListId, 1) },
            spacing: { after: 70, line: 280 },
            children: inlineRuns(text),
          })
        );
      } else {
        blocks.push(
          new Paragraph({
            bullet: { level },
            spacing: { after: 70, line: 280 },
            children: inlineRuns(text),
          })
        );
      }
      continue;
    }

    // Paragraphe (regroupe les lignes consecutives)
    const paragraph = [line.trim()];
    index += 1;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^(#{1,6}\s|```|\||>|\s*([-*]|\d+\.)\s|^-{3,}\s*$)/.test(lines[index])
    ) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push(
      new Paragraph({
        spacing: { after: 140, line: 300 },
        children: inlineRuns(paragraph.join(" ")),
      })
    );
  }

  return { blocks, meta };
}

// ---------------------------------------------------------------------------
// Pages de garde, en-tetes et pieds de page
// ---------------------------------------------------------------------------

function cover({ part, title, subtitle, version }) {
  return [
    new Paragraph({ spacing: { before: 1200, after: 0 }, children: [] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [
        new TextRun({ text: "BATIANA TECH", bold: true, size: 22, color: BRAND, characterSpacing: 60 }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 480 },
      children: [new TextRun({ text: "Communiquer · Créer · Partager · Développer", size: 18, color: MUTED, italics: true })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 160 },
      children: [new TextRun({ text: "SHALO COM SPACE", bold: true, size: 56, color: BRAND_DARK })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 520 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: BRAND, space: 12 } },
      children: [new TextRun({ text: "Plateforme de communication digitale et de marketing intelligent", size: 20, color: MUTED })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [new TextRun({ text: part ?? "Documentation", size: 20, color: MUTED, characterSpacing: 25 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [new TextRun({ text: title, bold: true, size: 40, color: BRAND_MID })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 720 },
      children: [new TextRun({ text: subtitle ?? "", size: 21, color: MUTED })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [new TextRun({ text: version, size: 19, color: INK })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [new TextRun({ text: "Éditeur : BATIANA TECH", size: 19, color: MUTED })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [new TextRun({ text: "Document généré depuis les sources Markdown du projet", size: 17, color: MUTED, italics: true })],
    }),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

function makeHeader(title) {
  return new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { after: 0 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: BORDER, space: 6 } },
        children: [
          new TextRun({ text: "SHALO COM SPACE  ·  ", size: 15, color: MUTED }),
          new TextRun({ text: title, size: 15, color: BRAND, bold: true }),
        ],
      }),
    ],
  });
}

function makeFooter() {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 0 },
        children: [
          new TextRun({ text: "BATIANA TECH  ·  SHALO COM SPACE  ·  document interne et confidentiel  ·  page ", size: 15, color: MUTED }),
          new TextRun({ children: [PageNumber.CURRENT], size: 15, color: MUTED }),
        ],
      }),
    ],
  });
}

const STYLES = {
  default: {
    document: {
      run: { font: "Calibri", size: 21, color: INK },
      paragraph: { spacing: { line: 300, before: 0, after: 140 } },
    },
  },
  paragraphStyles: [
    {
      id: "Heading1",
      name: "Heading 1",
      basedOn: "Normal",
      next: "Normal",
      quickFormat: true,
      run: { font: "Calibri", size: 32, bold: true, color: BRAND_DARK },
      paragraph: { spacing: { before: 320, after: 140, line: 280 }, outlineLevel: 0 },
    },
    {
      id: "Heading2",
      name: "Heading 2",
      basedOn: "Normal",
      next: "Normal",
      quickFormat: true,
      run: { font: "Calibri", size: 27, bold: true, color: BRAND_MID },
      paragraph: {
        spacing: { before: 300, after: 120, line: 280 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: BORDER, space: 4 } },
        outlineLevel: 1,
      },
    },
    {
      id: "Heading3",
      name: "Heading 3",
      basedOn: "Normal",
      next: "Normal",
      quickFormat: true,
      run: { font: "Calibri", size: 23, bold: true, color: "#1E54A1" },
      paragraph: { spacing: { before: 240, after: 90, line: 280 }, outlineLevel: 2 },
    },
    {
      id: "Heading4",
      name: "Heading 4",
      basedOn: "Normal",
      next: "Normal",
      quickFormat: true,
      run: { font: "Calibri", size: 21, bold: true, color: "#334155" },
      paragraph: { spacing: { before: 200, after: 80, line: 280 }, outlineLevel: 3 },
    },
  ],
};

const NUMBERING = {
  config: [
    {
      reference: "ordered",
      levels: [
        {
          level: 0,
          format: LevelFormat.DECIMAL,
          text: "%1.",
          alignment: AlignmentType.START,
          style: { paragraph: { indent: { left: 480, hanging: 260 } } },
        },
        {
          level: 1,
          format: LevelFormat.LOWER_LETTER,
          text: "%2.",
          alignment: AlignmentType.START,
          style: { paragraph: { indent: { left: 900, hanging: 260 } } },
        },
        {
          level: 2,
          format: LevelFormat.LOWER_ROMAN,
          text: "%3.",
          alignment: AlignmentType.START,
          style: { paragraph: { indent: { left: 1320, hanging: 260 } } },
        },
      ],
    },
  ],
};

function buildDocument({ blocks, title }) {
  return new Document({
    creator: "BATIANA TECH",
    title,
    description: "Documentation de la plateforme SHALO COM SPACE",
    subject: title,
    keywords: "SHALO COM SPACE, BATIANA TECH, documentation, architecture, API, déploiement, guide utilisateur",
    styles: STYLES,
    numbering: NUMBERING,
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1100, bottom: 1000, left: 1050, right: 1050 },
            size: { width: 11906, height: 16838 },
          },
        },
        headers: { default: makeHeader(title) },
        footers: { default: makeFooter() },
        children: blocks,
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

async function main() {
  if (!fs.existsSync(OUT_DIR)) {
    console.error("Dossier docs/ introuvable.");
    process.exit(1);
  }

  const now = new Date();
  const month = [
    "janvier",
    "février",
    "mars",
    "avril",
    "mai",
    "juin",
    "juillet",
    "août",
    "septembre",
    "octobre",
    "novembre",
    "décembre",
  ][now.getMonth()];
  const version = `Version 1.0 · ${month} ${now.getFullYear()}`;

  const published = [];
  const combinedBlocks = [];

  for (const doc of DOCUMENTS) {
    const file = path.join(ROOT, doc.source);
    if (!fs.existsSync(file)) {
      console.warn(`Source absente : ${doc.source}`);
      continue;
    }
    const source = fs.readFileSync(file, "utf8");
    const { blocks } = convertMarkdown(source, doc);

    const document = buildDocument({
      title: doc.title,
      blocks: [...cover({ ...doc, version }), ...blocks],
    });
    const buffer = await Packer.toBuffer(document);
    const target = path.join(OUT_DIR, doc.output);
    fs.writeFileSync(target, buffer);
    published.push({ file: doc.output, size: buffer.length });

    combinedBlocks.push(
      new Paragraph({
        spacing: { after: 80 },
        children: [new TextRun({ text: doc.part, size: 18, color: BRAND, bold: true, characterSpacing: 30 })],
      })
    );
    combinedBlocks.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        pageBreakBefore: true,
        spacing: { before: 0, after: 160 },
        children: [new TextRun({ text: doc.title, bold: true, size: 34, color: BRAND_DARK })],
      })
    );
    combinedBlocks.push(
      new Paragraph({
        spacing: { after: 320 },
        children: [new TextRun({ text: doc.subtitle ?? "", size: 20, color: MUTED, italics: true })],
      })
    );
    combinedBlocks.push(...blocks);
  }

  // Sommaire de la compilation
  const tocBlocks = [
    ...cover({ part: "Documentation complète", ...COMBINED, version }),
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: "Sommaire", bold: true, size: 32, color: BRAND_DARK })],
    }),
  ];
  for (const doc of DOCUMENTS) {
    tocBlocks.push(
      new Paragraph({
        bullet: { level: 0 },
        spacing: { after: 90, line: 280 },
        children: [
          new TextRun({ text: `${doc.part} — ${doc.title}`, bold: true, size: 21, color: BRAND_MID }),
          new TextRun({ text: ` : ${doc.subtitle}`, size: 20, color: MUTED }),
        ],
      })
    );
  }
  tocBlocks.push(
    new Paragraph({
      spacing: { before: 320 },
      children: [
        new TextRun({
          text: "Chaque partie correspond à un document Word autonome publié dans le même dossier, ainsi qu'à sa source Markdown.",
          size: 19,
          color: MUTED,
          italics: true,
        }),
      ],
    })
  );

  const combined = buildDocument({
    title: "SHALO COM SPACE — Documentation complète",
    blocks: [...tocBlocks, ...combinedBlocks],
  });
  const combinedBuffer = await Packer.toBuffer(combined);
  const combinedPath = path.join(OUT_DIR, COMBINED.output);
  fs.writeFileSync(combinedPath, combinedBuffer);
  published.push({ file: COMBINED.output, size: combinedBuffer.length });

  console.log("Documents Word générés dans docs/ :");
  for (const item of published) {
    console.log(`  - ${item.file} (${Math.round(item.size / 1024)} Ko)`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
