import { NavLink as RouterNavLink } from "react-router-dom";

export default function NavLink({
  to,
  children,
}: {
  to: string;
  children: React.ReactNode;
}) {
  return (
    <RouterNavLink
      to={to}
      className={({ isActive }) =>
        `px-3 py-2 rounded-md text-sm transition-colors ${
          isActive
            ? "bg-primary/20 text-primary"
            : "text-white/80 hover:bg-white/5 hover:text-white"
        }`
      }
    >
      {children}
    </RouterNavLink>
  );
}
