import { colors } from '../theme';
import './logo';

// Shown on launch while YouTube Music connects and the moods & genres list loads.
export function Splash({
  width,
  height,
  status,
  leaving,
}: {
  width: number;
  height: number;
  status: string;
  leaving: boolean;
}) {
  // The big logo is 56 columns by 6 rows; small terminals get a one-line one.
  const compact = width < 60 || height < 12;
  return (
    <box
      width="100%"
      height="100%"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
    >
      <logo key={compact ? 'compact' : 'big'} compact={compact} leaving={leaving} />
      <box height={compact ? 1 : 2} />
      <text fg={colors.muted}>{leaving ? ' ' : status}</text>
    </box>
  );
}
