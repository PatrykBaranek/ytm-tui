import type { View } from '../hooks/use-navigation';
import { fit } from '../lib/format';
import { colors } from '../theme';

// "Home › Rock › Classic Rock", dropping the oldest steps when it doesn't fit. A search isn't
// somewhere inside home, so its trail starts at the search.
export function breadcrumb(stack: View[], width: number) {
  const steps = stack[1]?.kind === 'search' ? stack.slice(1) : stack;
  const titles = steps.map((view) => view.title);
  for (let skip = 0; skip < titles.length - 1; skip++) {
    const text = [...(skip ? ['…'] : []), ...titles.slice(skip)].join(' › ');
    if (Bun.stringWidth(text) <= width) return text;
  }
  return fit(titles.at(-1) ?? '', width).trimEnd();
}

const TAB_GAP = '   ';

// Every tab if they fit, or else only the open one between arrows that say there are more. The
// underline goes under the open tab, on the line below.
export function tabStrip(names: string[], active: string, width: number) {
  if (Bun.stringWidth(names.join(TAB_GAP)) <= width) {
    const before = names.slice(0, Math.max(0, names.indexOf(active)));
    return {
      start: '',
      shown: names,
      end: '',
      underlineAt: before.reduce(
        (x, name) => x + Bun.stringWidth(name) + TAB_GAP.length,
        0,
      ),
      underlineWidth: Bun.stringWidth(active),
    };
  }
  const name = fit(active, Math.max(1, width - 4)).trimEnd();
  return {
    start: '‹ ',
    shown: [name],
    end: ' ›',
    underlineAt: 2,
    underlineWidth: Bun.stringWidth(name),
  };
}

interface TabsProps {
  strip: ReturnType<typeof tabStrip>;
  active: string;
}

function Tabs({ strip, active }: TabsProps) {
  const isOpen = (name: string) => strip.shown.length === 1 || name === active;
  return (
    <text>
      <span fg={colors.muted}>{strip.start}</span>
      {strip.shown.flatMap((name, i) => [
        ...(i ? [<span key={`gap-${name}`}>{TAB_GAP}</span>] : []),
        <span key={name} fg={isOpen(name) ? colors.accent : colors.muted}>
          {isOpen(name) ? <strong>{name}</strong> : name}
        </span>,
      ])}
      <span fg={colors.muted}>{strip.end}</span>
    </text>
  );
}

interface TopBarProps {
  stack: View[];
  width: number;
  searching: boolean;
  // Home's tabs, in place of the trail of where you are.
  tabs?: { names: string[]; active: string };
  children: React.ReactNode; // the search input, always mounted so it keeps its text
}

// The first two lines: where you are and the two keys worth knowing, or the search box while
// searching; then the open tab's underline, or a blank line.
export function TopBar({ stack, width, searching, tabs, children }: TopBarProps) {
  const keys = width >= 40 ? '/ search   ? keys' : '? keys';
  const room = Math.max(0, width - 3 - Bun.stringWidth(keys));
  const strip = tabs && !searching ? tabStrip(tabs.names, tabs.active, room) : undefined;
  return (
    <box height={2} flexDirection="column" flexShrink={0}>
      <box height={1} flexDirection="row" paddingLeft={1} paddingRight={1}>
        {searching ? (
          <text fg={colors.accent} flexShrink={0}>
            {'/ '}
          </text>
        ) : (
          <box flexGrow={1} height={1}>
            {strip && tabs ? (
              <Tabs strip={strip} active={tabs.active} />
            ) : (
              <text fg={colors.fg}>{breadcrumb(stack, room)}</text>
            )}
          </box>
        )}
        <box flexGrow={1} height={1} visible={searching}>
          {children}
        </box>
        {!searching && (
          <text fg={colors.muted} flexShrink={0}>
            {keys}
          </text>
        )}
      </box>
      <box height={1} paddingLeft={1}>
        {strip && (
          <text fg={colors.accent}>
            {' '.repeat(strip.underlineAt) + '─'.repeat(strip.underlineWidth)}
          </text>
        )}
      </box>
    </box>
  );
}
