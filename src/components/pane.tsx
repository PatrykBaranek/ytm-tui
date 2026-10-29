import { colors } from '../theme';

export function Pane({
  title,
  width,
  height,
  focused,
  children,
}: {
  title: string;
  width: number;
  height?: number;
  focused: boolean;
  children: React.ReactNode;
}) {
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
