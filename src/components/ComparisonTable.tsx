export type ComparisonRow = {
  label: string;
  values: string[];
};

export type ComparisonTableProps = {
  headers: string[];
  rows: ComparisonRow[];
  note?: string;
};

export function ComparisonTable({ headers, rows, note }: ComparisonTableProps) {
  return (
    <div className="comparison-table-wrap">
      <table className="comparison-table">
        <thead>
          <tr>
            <th className="comparison-label-col">比較項目</th>
            {headers.map((h, i) => (
              <th key={h} className={i === 0 ? "comparison-col-a" : "comparison-col-b"}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={row.label} className={ri % 2 === 0 ? "comparison-row-even" : ""}>
              <td className="comparison-label-cell">{row.label}</td>
              {row.values.map((v, vi) => (
                <td key={vi}>{v}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {note && <p className="comparison-note">※ {note}</p>}
    </div>
  );
}
