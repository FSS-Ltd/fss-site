import {
  Bell,
  Building2,
  CircleDot,
  CircleHelp,
  ClipboardList,
  CreditCard,
  FileSignature,
  FileText,
  FolderKanban,
  HandHeart,
  House,
  LayoutDashboard,
  ListChecks,
  PanelsTopLeft,
  Settings,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import styles from "./portal-shell.module.css";

const navigationIcons: Record<string, LucideIcon> = {
  agreements: FileSignature,
  billing: CreditCard,
  clients: Building2,
  delivery: PanelsTopLeft,
  documents: FileText,
  "getting-started": ListChecks,
  help: CircleHelp,
  home: House,
  notifications: Bell,
  overview: LayoutDashboard,
  "portal-access": ShieldCheck,
  projects: FolderKanban,
  requests: ClipboardList,
  services: Sparkles,
  settings: Settings,
  welcome: HandHeart,
};

export function PortalNavigationIcon({
  itemId,
}: Readonly<{
  itemId: string;
}>): React.JSX.Element {
  const Icon = navigationIcons[itemId] ?? CircleDot;

  return (
    <Icon
      aria-hidden="true"
      className={styles.navigationIcon}
      data-navigation-icon={itemId}
      size={16}
      strokeWidth={1.75}
    />
  );
}
