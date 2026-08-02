import type { ReactNode } from "react";

export type DocRow = [ReactNode, ReactNode];

// The only piece of the old docs kit worth keeping: six tables on the page are
// built from data, and writing thead/tbody six times is noise. It renders a
// bare <table> with no classes of its own — the element lands as a direct child
// of <Prose>, which owns every table style on the site. Nothing here styles
// anything, so there is no second opinion about how a docs table looks.
export function DocTable({ head, rows }: { head: DocRow; rows: DocRow[] }) {
  return (
    <table>
      <thead>
        <tr>
          <th>{head[0]}</th>
          <th>{head[1]}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([key, value], i) => (
          <tr key={i}>
            <td>{key}</td>
            <td>{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
