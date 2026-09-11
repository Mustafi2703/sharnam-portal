import { Link, type LinkProps } from "react-router-dom";
import { isToolWindow, openModuleToolWindow, withToolWindowParam } from "../lib/moduleToolWindow";

type Props = LinkProps & {
  /** From the hub / main desk, open this path in a dedicated tool window. */
  newWindow?: boolean;
  windowLabel?: string;
};

/** In-app link that keeps `?win=1` when the tool is already in its own window. */
export function ToolLink({ to, newWindow = true, windowLabel, onClick, ...rest }: Props) {
  const href = typeof to === "string" ? to : undefined;
  const next = href ? withToolWindowParam(href) : to;

  return (
    <Link
      to={next}
      onClick={(e) => {
        if (newWindow && href && !isToolWindow()) {
          e.preventDefault();
          const w = openModuleToolWindow(href, windowLabel || "tool");
          if (!w) window.location.assign(withToolWindowParam(href, true));
        }
        onClick?.(e);
      }}
      {...rest}
    />
  );
}
