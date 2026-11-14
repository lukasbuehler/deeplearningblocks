/**
 * Draw the landing page's hero picture with the playground's own block outlines, so its studs and
 * sockets always match the app. Run after changing connector shapes:
 *
 *   npx tsx scripts/build-landing-art.ts
 */
import { writeFileSync } from 'node:fs';
import { blockOutline, connectorLabels, type Connector } from '../src/app/playground/block-connectors';
import { BLOCK_WIDTH } from '../src/app/playground/graph';

const INK = '#171717';
const W = BLOCK_WIDTH;
interface Piece {
  title: string;
  detail: string;
  color: string;
  height: number;
  input?: Connector;
  output?: Connector;
  art?: string;
  /** Lift a block off the stack, as if it is about to click into place. */
  lift?: { x: number; y: number; turn: number };
}
const image: Connector = { type: 'image' };
const pixels: Connector = { type: 'vector', size: 784 };
const scores: Connector = { type: 'vector', size: 10 };
const chances: Connector = { type: 'probabilities', size: 10 };

// A seven on a 7 × 7 pixel grid, and ten bars with the seven winning.
const seven = ['1111111', '0000011', '0000110', '0001100', '0011000', '0011000', '0011000']
  .flatMap((row, y) =>
    [...row].map((on, x) =>
      on === '1' ? `<rect x="${263 + x * 7}" y="${22 + y * 7}" width="7" height="7"/>` : '',
    ),
  )
  .join('');
const bars = [4, 2, 6, 9, 3, 5, 2, 62, 8, 4]
  .map(
    (h, i) =>
      `<rect x="${30 + i * 27}" y="${118 - h}" width="17" height="${h}" rx="2" fill="${i === 7 ? INK : '#fffdf1'}" stroke="${INK}" stroke-width="2"/>` +
      `<text x="${38.5 + i * 27}" y="134" text-anchor="middle" font-size="12" font-weight="800">${i}</text>`,
  )
  .join('');

const pieces: Piece[] = [
  {
    title: 'Handwritten digit',
    detail: 'A tiny picture',
    color: '#ffe14a',
    height: 96,
    output: image,
    art: `<rect x="257" y="16" width="61" height="61" rx="6" fill="${INK}"/><g fill="#fffdf1">${seven}</g>`,
  },
  { title: 'Flatten', detail: '28×28 pixels → 784 numbers', color: '#74a6ff', height: 82, input: image, output: pixels },
  { title: 'Dense', detail: '784 → 10 neurons', color: '#ff7770', height: 82, input: pixels, output: scores },
  { title: 'Softmax', detail: 'Scores → chances', color: '#ffacdf', height: 82, input: scores, output: chances },
  {
    title: 'Digit guess',
    detail: 'It’s a 7!',
    color: '#bc9aff',
    height: 146,
    input: chances,
    art: bars,
    lift: { x: 26, y: 34, turn: 4 },
  },
];

let y = 36;
const blocks = pieces.map((piece) => {
  const outline = blockOutline(W, piece.height, piece.input, piece.output);
  const labels = [
    ...connectorLabels(piece.input, W, 0),
    ...connectorLabels(piece.output, W, piece.height),
  ]
    .map((l) => `<text x="${l.x}" y="${l.y}" text-anchor="middle" font-size="11" font-weight="800">${l.text}</text>`)
    .join('');
  const top = y;
  y += piece.height;
  const lift = piece.lift;
  const move = lift
    ? `translate(${40 + lift.x} ${top + lift.y}) rotate(${lift.turn} ${W / 2} ${piece.height / 2})`
    : `translate(40 ${top})`;
  return `<g transform="${move}">
  <path d="${outline}" transform="translate(6 6)" fill="${INK}"/>
  <path d="${outline}" fill="${piece.color}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
  <text x="22" y="${piece.lift ? 40 : 46}" font-size="${piece.art && !piece.lift ? 24 : 27}" font-weight="900" letter-spacing="-0.5">${piece.title}</text>
  <text x="22" y="${piece.lift ? 64 : 70}" font-size="15" font-weight="650">${piece.detail}</text>
  ${piece.art ?? ''}${labels}
</g>`;
});

// Blocky, from the favicon, cheering the stack on.
const blocky = `<g transform="translate(398 18) scale(1.6) translate(-26.75 -13.25)" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round">
  <rect x="35" y="15" width="16" height="11" rx="3" fill="#ffe14a"/><rect x="64" y="15" width="16" height="11" rx="3" fill="#ffe14a"/>
  <rect x="32" y="26" width="57" height="49" rx="9" fill="${INK}"/><rect x="29" y="23" width="57" height="49" rx="9" fill="#ffe14a"/>
  <path d="M47 57Q58 66 69 57" fill="none" stroke-linecap="round"/>
  <g stroke="none"><ellipse cx="45" cy="42" rx="4.5" ry="6.5" fill="${INK}"/><ellipse cx="69" cy="42" rx="4.5" ry="6.5" fill="${INK}"/>
  <circle cx="37" cy="53" r="4" fill="#ff6962"/><circle cx="77" cy="53" r="4" fill="#ff6962"/></g>
</g>
<path d="M452 132C462 196 432 300 392 352" fill="none" stroke="${INK}" stroke-width="3" stroke-dasharray="7 7" stroke-linecap="round"/>
<path d="M386 334L390 356L410 344" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;

const height = y + 60;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 540 ${height}" font-family="'Avenir Next','Trebuchet MS','Segoe UI',sans-serif" fill="${INK}">
${blocks.join('\n')}
${blocky}
</svg>
`;
writeFileSync('public/landing-blocks.svg', svg);
console.log(`public/landing-blocks.svg 540 × ${height}`);
