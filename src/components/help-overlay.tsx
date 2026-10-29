import { fit } from '../lib/format';
import { colors } from '../theme';

type Section = [title: string, keys: [key: string, action: string][]];

const LEFT: Section[] = [
  [
    'Browse',
    [
      ['enter', 'open a mood, genre or playlist'],
      ['esc / backspace', 'back'],
      ['↑ ↓ / j k', 'move'],
      ['pgup / pgdn', 'move a page'],
      ['/', 'search; ↑ ↓ picks a suggestion'],
      ['tab', 'switch between list and queue'],
    ],
  ],
  [
    'Songs',
    [
      ['enter', 'play; in a playlist, the rest follows'],
      ['a', 'add to up next'],
      ['A', 'add the whole playlist'],
      ['s', 'shuffle the playlist'],
    ],
  ],
  [
    'Queue',
    [
      ['enter', 'play now'],
      ['d / x / delete', 'remove'],
    ],
  ],
];

const RIGHT: Section[] = [
  [
    'Playback',
    [
      ['space', 'pause / resume'],
      ['n / p', 'next / previous'],
      ['← →', 'seek 10 seconds'],
      ['+ / -', 'volume'],
      ['r', 'autoplay on / off'],
    ],
  ],
  [
    'App',
    [
      ['?', 'show / hide these keys'],
      ['q / ctrl+c', 'quit'],
    ],
  ],
];

const KEY_WIDTH = 17;
const ACTION_WIDTH = 38;
const COLUMN_WIDTH = KEY_WIDTH + ACTION_WIDTH;

interface ColumnProps {
  sections: Section[];
}

function Column({ sections }: ColumnProps) {
  return (
    <box flexDirection="column" width={COLUMN_WIDTH}>
      {sections.map(([title, keys], i) => (
        <box key={title} flexDirection="column" marginTop={i ? 1 : 0}>
          <text fg={colors.accent}>
            <strong>{title}</strong>
          </text>
          {keys.map(([key, action]) => (
            <text key={key}>
              <span fg={colors.fg}>{fit(key, KEY_WIDTH)}</span>
              <span fg={colors.muted}>{fit(action, ACTION_WIDTH)}</span>
            </text>
          ))}
        </box>
      ))}
    </box>
  );
}

interface HelpOverlayProps {
  width: number;
}

// Every key, on a panel over the app; `?` opens it and any key closes it.
export function HelpOverlay({ width }: HelpOverlayProps) {
  // Two columns side by side when they fit, otherwise one under the other.
  const wide = width >= COLUMN_WIDTH * 2 + 9;
  return (
    <box
      position="absolute"
      left={0}
      top={0}
      width="100%"
      height="100%"
      alignItems="center"
      justifyContent="center"
    >
      <box
        title="keys"
        border
        borderColor={colors.borderFocused}
        backgroundColor={colors.overlay}
        paddingLeft={2}
        paddingRight={2}
        flexDirection="column"
      >
        <box flexDirection={wide ? 'row' : 'column'}>
          <Column sections={LEFT} />
          {wide ? <box width={3} /> : <box height={1} />}
          <Column sections={RIGHT} />
        </box>
        <text fg={colors.muted} marginTop={1}>
          press any key to close
        </text>
      </box>
    </box>
  );
}
