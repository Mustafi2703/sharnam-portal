/** Empty band cells — keep section/subsection rows aligned with data column groups. */
import { mbColClass, bbsColClass, monitoringColClass } from "./costSheetColumns";

export function mbBandEmpty(index: number, key: string | number) {
  return (
    <td key={key} className={mbColClass(index, { extra: "text-left" })}>
      {"\u00a0"}
    </td>
  );
}

export function bbsBandEmpty(index: number, key: string | number) {
  return (
    <td key={key} className={bbsColClass(index, { extra: "text-left" })}>
      {"\u00a0"}
    </td>
  );
}

export function monitoringBandEmpty(index: number, key: string | number) {
  return (
    <td key={key} className={monitoringColClass(index, { extra: "text-left" })}>
      {"\u00a0"}
    </td>
  );
}

export const MB_DATA_COLS = 12;
export const BBS_DATA_COLS = 16;
export const MON_DATA_COLS = 40;
