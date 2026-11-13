import { CONTEXT } from '../learning/shakespeare';
import {
  BLOCKS,
  BLOCK_WIDTH,
  BlockNode,
  Board,
  PortType,
  inferShapes,
  portType,
  World,
  worldOf,
} from './graph';

export interface Connector {
  type: PortType;
  size?: number;
  /** A formula while the concrete dimensions are not known yet. */
  label?: string;
}

export function nodeConnectors(
  node: BlockNode,
  inputSize?: number,
  outputSize?: number,
  incoming?: Connector,
  attached = false,
  world: World = 'images',
) {
  const definition = BLOCKS[node.kind];
  const knownInput = inputSize ?? (!attached && node.kind === 'dense' ? node.inputs : undefined);
  const inputType = portType(node.kind, 'input', world);
  const outputType = portType(node.kind, 'output', world);
  const fixedInput = node.kind === 'classifier';
  const input: Connector | undefined = definition.input
    ? {
        type: inputType!,
        size: fixedInput ? 10 : knownInput,
        ...(!fixedInput && incoming && incoming.type === inputType && incoming.label
          ? { label: incoming.label }
          : {}),
        ...(node.kind === 'flatten'
          ? {
              label:
                knownInput === undefined
                  ? 'N×N'
                  : `${Math.sqrt(knownInput)}×${Math.sqrt(knownInput)}`,
            }
          : {}),
      }
    : undefined;
  const size = outputSize ?? definition.inferWidth(node, knownInput);
  const output: Connector | undefined = definition.output
    ? {
        type: outputType!,
        size,
        ...(node.kind === 'flatten' && size === undefined ? { label: 'N·N' } : {}),
        ...(size === undefined &&
        (node.kind === 'activation' || node.kind === 'custom' || node.kind === 'softmax') &&
        input?.label
          ? { label: input.label }
          : {}),
      }
    : undefined;
  return { input, output };
}
/** Propagate formulas as well as concrete sizes through a partially built stack. */
export function inferConnectorShapes(board: Board) {
  const result = new Map<string, ReturnType<typeof nodeConnectors>>();
  const shapes = inferShapes(board);
  const nodes = new Map(board.nodes.map((n) => [n.id, n]));
  const incoming = new Map(board.edges.filter((e) => !e.port).map((e) => [e.to, e.from]));
  const visiting = new Set<string>();
  function visit(id: string): ReturnType<typeof nodeConnectors> | undefined {
    if (result.has(id)) return result.get(id);
    const node = nodes.get(id);
    if (!node || visiting.has(id)) return undefined;
    visiting.add(id);
    const source = incoming.get(id);
    const connector = source ? visit(source)?.output : undefined;
    const numeric = shapes.get(id);
    const ports = nodeConnectors(
      node,
      numeric?.input,
      numeric?.output,
      connector,
      source !== undefined,
      worldOf(board),
    );
    result.set(id, ports);
    visiting.delete(id);
    return ports;
  }
  for (const node of board.nodes) visit(node.id);
  return result;
}

interface Tooth {
  x: number;
  width: number;
  label?: string;
}

/** One geometry for both ends: a socket is the exact negative of its matching plug. */
export function connectorTeeth(connector: Connector, width: number): Tooth[] {
  const image = connector.type === 'image';
  const small = image ? 20 : 14;
  // Expanded frames keep the same connector footprint as ordinary blocks.
  const available = Math.min(width, BLOCK_WIDTH) - 40;
  const label =
    connector.label ??
    (image
      ? '28×28'
      : connector.type === 'tokens'
        ? `${CONTEXT} letters`
        : connector.type === 'sequence'
          ? `${CONTEXT}×${connector.size ?? 'N'}`
          : String(connector.size ?? 'N'));
  let widths: number[], labels: (string | undefined)[], gap: number;
  const minimumGap = 10;
  const capacity = Math.floor((available + minimumGap) / (small + minimumGap));
  if (!image && connector.size !== undefined && connector.size <= capacity) {
    widths = Array.from({ length: connector.size }, () => small);
    labels = widths.map(() => undefined);
    gap = Math.min(40, (available - widths.length * small) / Math.max(1, widths.length - 1));
  } else {
    const big = Math.max(30, 14 + label.length * 7.2) + (image ? 6 : 0);
    const count = Math.max(1, Math.floor((available - big) / 2 / (small + 5)) - 1);
    widths = [...Array<number>(count).fill(small), big, ...Array<number>(count).fill(small)];
    labels = widths.map((_, i) => (i === count ? label : undefined));
    gap = (available - widths.reduce((sum, w) => sum + w, 0)) / (widths.length - 1);
  }
  const total = widths.reduce((sum, w) => sum + w, 0) + gap * (widths.length - 1);
  let x = (width - total) / 2;
  return widths.map((w, i) => {
    const tooth = { x, width: w, label: labels[i] };
    x += w + gap;
    return tooth;
  });
}

/** Open contour, with no line across the root of a stud or the mouth of a socket. */
export function toothContour(type: PortType, tooth: Tooth, y: number, reverse = false): string {
  const { x, width: w } = tooth;
  const X = (v: number) => x + (reverse ? w - v : v);
  if (type === 'probabilities') {
    const sweep = reverse ? 1 : 0;
    if (!tooth.label) return `A${w / 2},14 0 0 ${sweep} ${X(w)},${y}`;
    return `A7,14 0 0 ${sweep} ${X(7)},${y + 14}H${X(w - 7)}A7,14 0 0 ${sweep} ${X(w)},${y}`;
  }
  if (type === 'image') return `v9H${X(3)}v10H${X(w - 3)}v-10H${X(w)}V${y}`;
  return `v9Q${X(0)},${y + 14} ${X(5)},${y + 14}H${X(w - 5)}Q${X(w)},${y + 14} ${X(w)},${y + 9}V${y}`;
}

/** A single closed outline keeps every join seamless, including transparent socket cutouts. */
export function blockOutline(
  width: number,
  height: number,
  input?: Connector,
  output?: Connector,
): string {
  const radius = Math.min(11, height / 2);
  let path = `M${radius},0`;
  for (const tooth of input ? connectorTeeth(input, width) : [])
    path += `H${tooth.x}${toothContour(input!.type, tooth, 0)}`;
  path += `H${width - radius}Q${width},0 ${width},${radius}V${height - radius}Q${width},${height} ${width - radius},${height}`;
  for (const tooth of output ? connectorTeeth(output, width).reverse() : [])
    path += `H${tooth.x + tooth.width}${toothContour(output!.type, tooth, height, true)}`;
  return path + `H${radius}Q0,${height} 0,${height - radius}V${radius}Q0,0 ${radius},0Z`;
}

export function connectorLabels(connector: Connector | undefined, width: number, y: number) {
  return connector
    ? connectorTeeth(connector, width)
        .filter((t) => t.label)
        .map((t) => ({
          x: t.x + t.width / 2,
          y: y + 11.5,
          text: t.label!,
        }))
    : [];
}

/** The same contour as the connector itself, for precise drag feedback on either end. */
export function connectorEdgePath(
  connector: Connector | undefined,
  width: number,
  y: number,
): string {
  return connector
    ? connectorTeeth(connector, width)
        .map((tooth) => `M${tooth.x},${y}${toothContour(connector.type, tooth, y)}`)
        .join('')
    : '';
}

/** A roomy opening with orange necks fused to the first socket and last output. */
export function recipeWellOutline(
  width: number,
  height: number,
  inset: number,
  neck: number,
  input?: Connector,
  output?: Connector,
): string {
  const inner = width - 2 * inset;
  let path = `M11,0H${inset}V${neck}`;
  for (const tooth of input ? connectorTeeth(input, inner) : [])
    path += `H${inset + tooth.x}${toothContour(input!.type, { ...tooth, x: inset + tooth.x }, neck)}`;
  path += `H${width - inset}V0H${width - 11}Q${width},0 ${width},11V${height - 11}Q${width},${height} ${width - 11},${height}H${width - inset}V${height - neck}`;
  for (const tooth of output ? connectorTeeth(output, inner).reverse() : [])
    path += `H${inset + tooth.x + tooth.width}${toothContour(output!.type, { ...tooth, x: inset + tooth.x }, height - neck, true)}`;
  return path + `H${inset}V${height}H11Q0,${height} 0,${height - 11}V11Q0,0 11,0Z`;
}
