declare module "lucide-react" {
  import { FC, SVGProps } from "react";
  export interface IconProps extends SVGProps<SVGSVGElement> {
    size?: number | string;
    strokeWidth?: number | string;
    absoluteStrokeWidth?: boolean;
    color?: string;
  }
  export type Icon = FC<IconProps>;
  export const Building2Icon: Icon;
  export const CheckCircle2Icon: Icon;
  export const CheckIcon: Icon;
  export const ChevronDownIcon: Icon;
  export const ChevronLeftIcon: Icon;
  export const ChevronRightIcon: Icon;
  export const ChevronUpIcon: Icon;
  export const CircleCheckIcon: Icon;
  export const CircleUserRoundIcon: Icon;
  export const ClockIcon: Icon;
  export const CommandIcon: Icon;
  export const DatabaseIcon: Icon;
  export const EllipsisVerticalIcon: Icon;
  export const FileTextIcon: Icon;
  export const FilesIcon: Icon;
  export const InfoIcon: Icon;
  export const LayoutDashboardIcon: Icon;
  export const Loader2Icon: Icon;
  export const LogOutIcon: Icon;
  export const MoreHorizontalIcon: Icon;
  export const OctagonXIcon: Icon;
  export const PanelLeftIcon: Icon;
  export const PlayIcon: Icon;
  export const RefreshCwIcon: Icon;
  export const Settings2Icon: Icon;
  export const SettingsIcon: Icon;
  export const TriangleAlertIcon: Icon;
  export const UserIcon: Icon;
  export const XIcon: Icon;
}
