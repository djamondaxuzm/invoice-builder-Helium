import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow
} from '@mui/material';
import { useState } from 'react';

export const ReportTable = ({
  label,
  columns,
  rows,
  onFirstCell
}: {
  label: string;
  columns: string[];
  rows: { key: string; cells: string[] }[];
  onFirstCell?: (key: string) => void;
}) => {
  const [page, setPage] = useState(0);
  const currentPage = Math.min(page, Math.max(0, Math.ceil(rows.length / 25) - 1));
  return (
    <>
      <TableContainer>
        <Table size="small" aria-label={label}>
          <TableHead>
            <TableRow>
              {columns.map((column, index) => (
                <TableCell key={index}>{column}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.slice(currentPage * 25, currentPage * 25 + 25).map(row => (
              <TableRow key={row.key}>
                {row.cells.map((cell, index) => (
                  <TableCell key={index} sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {index === 0 && onFirstCell ? (
                      <Button size="small" onClick={() => onFirstCell(row.key)}>
                        {cell}
                      </Button>
                    ) : (
                      cell
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        component="div"
        count={rows.length}
        rowsPerPage={25}
        rowsPerPageOptions={[25]}
        page={currentPage}
        onPageChange={(_, value) => setPage(value)}
      />
    </>
  );
};
