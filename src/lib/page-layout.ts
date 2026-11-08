// Where each row of a sectioned page goes, and which row an arrow key lands on. Pure, so the
// screen and the key handling can't disagree.

export interface Block {
  title: string;
  items: number[]; // indexes into the page's rows
}

export interface Cell {
  item: number;
  x: number;
  y: number;
  width: number;
  section: number;
}

export interface Heading {
  text: string;
  x: number;
  y: number;
  width: number;
}

export interface PageLayout {
  cells: Cell[];
  headings: Heading[];
  height: number;
}

export type Direction = 'up' | 'down' | 'left' | 'right';

const COLUMN_GAP = 3;

// Each row of blocks sits side by side, in equal columns, with a blank line under it.
export function layoutBlocks(rows: Block[][], width: number): PageLayout {
  const cells: Cell[] = [];
  const headings: Heading[] = [];
  let y = 0;
  let section = 0;
  for (const row of rows) {
    const gaps = COLUMN_GAP * (row.length - 1);
    const columnWidth = Math.max(1, Math.floor((width - gaps) / row.length));
    let bottom = y;
    row.forEach((block, column) => {
      const x = column * (columnWidth + COLUMN_GAP);
      headings.push({ text: block.title, x, y, width: columnWidth });
      let line = y + 1;
      for (const item of block.items)
        cells.push({ item, x, y: line++, width: columnWidth, section });
      section++;
      bottom = Math.max(bottom, line);
    });
    y = bottom + 1;
  }
  return { cells, headings, height: Math.max(0, y - 1) };
}

// The smallest by each key in turn.
function closest(cells: Cell[], ...keys: ((cell: Cell) => number)[]) {
  return cells.reduce<Cell | undefined>((best, cell) => {
    if (!best) return cell;
    for (const key of keys) {
      const difference = key(cell) - key(best);
      if (difference !== 0) return difference < 0 ? cell : best;
    }
    return best;
  }, undefined);
}

// The row the key moves to, or the same row if there is nowhere to go.
export function moveInPage(cells: Cell[], selected: number, direction: Direction) {
  const from = cells.find((cell) => cell.item === selected);
  if (!from) return cells[0]?.item ?? selected;

  if (direction === 'up' || direction === 'down') {
    const sign = direction === 'down' ? 1 : -1;
    const ahead = cells.filter((cell) => (cell.y - from.y) * sign > 0);
    // Under a left column the next stop is what's below it, even if the column beside it runs on.
    const below = ahead.filter(
      (cell) => cell.x < from.x + from.width && from.x < cell.x + cell.width,
    );
    const center = (cell: Cell) => cell.x + cell.width / 2;
    return (
      closest(
        below.length ? below : ahead,
        (cell) => Math.abs(cell.y - from.y),
        (cell) => Math.abs(center(cell) - center(from)),
      )?.item ?? selected
    );
  }

  const sign = direction === 'right' ? 1 : -1;
  const beside = cells.filter(
    (cell) => cell.y === from.y && (cell.x - from.x) * sign > 0,
  );
  const target =
    closest(beside, (cell) => Math.abs(cell.x - from.x)) ??
    cells.find((cell) => cell.section === from.section + sign);
  return target?.item ?? selected;
}
