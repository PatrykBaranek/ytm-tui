import { colors } from '../theme';

interface PaneProps {
  title: string;
  width: number;
  height?: number;
  focused: boolean;
  children: React.ReactNode;
}

export function Pane({ title, width, height, focused, children }: PaneProps) {
  return (
    <box
      title={title}
      width={width}
      height={height}
      border
      borderColor={focused ? colors.borderFocused : colors.border}
      paddingLeft={1}
      paddingRight={1}
      flexDirection="column"
    >
      {children}
    </box>
  );
}
