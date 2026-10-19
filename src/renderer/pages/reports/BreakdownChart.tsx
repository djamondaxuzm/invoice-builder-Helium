import { Box, Typography, useTheme } from '@mui/material';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export const BreakdownChart = ({
  title,
  rows,
  formatValue
}: {
  title: string;
  rows: { name: string; value: number }[];
  formatValue: (value: number) => string;
}) => {
  const theme = useTheme();
  return (
    <Box sx={{ my: 2, minWidth: 0 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        {title}
      </Typography>
      <ResponsiveContainer width="100%" height={Math.max(220, rows.length * 36)}>
        <BarChart data={rows} layout="vertical" margin={{ right: 24 }} accessibilityLayer>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis
            type="number"
            tickFormatter={value => new Intl.NumberFormat(undefined, { notation: 'compact' }).format(value)}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={155}
            tick={{ fontSize: 12 }}
            tickFormatter={value => (String(value).length > 22 ? `${String(value).slice(0, 20)}…` : value)}
          />
          <Tooltip formatter={value => [formatValue(Number(value)), '']} />
          <Bar dataKey="value" fill={theme.palette.primary.main} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
};
